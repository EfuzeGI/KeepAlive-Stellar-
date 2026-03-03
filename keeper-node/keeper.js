import { Keypair, Contract, TransactionBuilder, rpc, scValToNative, nativeToScVal, Operation, Networks, Horizon } from '@stellar/stellar-sdk';
import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { KEEPER_SECRET_KEY, RPC_URL, NETWORK_PASSPHRASE, TARGET_VAULT_ID } = process.env;
// Railway automatically provides process.env.PORT, fall back to 3002 for local dev
const KEEPER_PORT = process.env.PORT || process.env.KEEPER_PORT || 3002;
const REGISTRY_FILE = './smart-accounts.json';

if (!KEEPER_SECRET_KEY || !RPC_URL || !NETWORK_PASSPHRASE) {
    console.error("❌ Missing required .env variables.");
    process.exit(1);
}

const keeperKeypair = Keypair.fromSecret(KEEPER_SECRET_KEY);
const keeperPublicKey = keeperKeypair.publicKey();
const server = new rpc.Server(RPC_URL);


//  SMART ACCOUNT REGISTRY 


function loadRegistry() {
    if (!existsSync(REGISTRY_FILE)) return [];
    try { return JSON.parse(readFileSync(REGISTRY_FILE, 'utf-8')); }
    catch { return []; }
}

function saveRegistry(accounts) {
    writeFileSync(REGISTRY_FILE, JSON.stringify(accounts, null, 2));
}

function registerSmartAccount(contractId, owner, beneficiary) {
    const accounts = loadRegistry();
    if (accounts.find(a => a.contractId === contractId)) {
        return { success: false, message: "Already registered" };
    }
    accounts.push({
        contractId,
        owner: owner || "unknown",
        beneficiary: beneficiary || "unknown",
        registeredAt: new Date().toISOString(),
    });
    saveRegistry(accounts);
    console.log(`✅ Registered Smart Account: ${truncateKey(contractId)}`);
    return { success: true, message: "Registered" };
}


//  HTTP SERVER 


const httpServer = createServer((req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // GET /vaults — list registered smart accounts
    if (req.method === 'GET' && (req.url === '/vaults' || req.url === '/smart-accounts')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ accounts: loadRegistry() }));
        return;
    }

    // POST /register-smart-account — register new contract
    if (req.method === 'POST' && (req.url === '/register-smart-account' || req.url === '/register-vault')) {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const contractId = data.contract_id || data.wallet_id;
                if (!contractId) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: "contract_id required" }));
                    return;
                }
                const result = registerSmartAccount(contractId, data.owner, data.beneficiary);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(result));
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: "Invalid JSON" }));
            }
        });
        return;
    }

    // GET /public-key — frontend needs this to add Keeper as signer
    if (req.method === 'GET' && req.url === '/public-key') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ publicKey: keeperPublicKey }));
        return;
    }

    // GET /health
    if (req.method === 'GET' && req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: "ok", publicKey: keeperPublicKey, accounts: loadRegistry().length }));
        return;
    }

    // GET /inherited?address=...
    if (req.method === 'GET' && req.url?.startsWith('/inherited')) {
        const urlParams = new URL(`http://localhost${req.url}`).searchParams;
        const address = urlParams.get('address');
        if (!address) {
            res.writeHead(400); res.end("Missing address"); return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        const accounts = loadRegistry();
        const inherited = accounts.filter(a => a.beneficiary === address && a.signerTransferred === true);
        res.end(JSON.stringify({ inherited }));
        return;
    }

    res.writeHead(404);
    res.end("Not found");
});

httpServer.listen(KEEPER_PORT, () => {
    console.log(`\n${"—".repeat(42)}`);
    console.log(`  KEEPALIVE PROTOCOL — KEEPER AGENT`);
    console.log(`${"—".repeat(42)}`);
    console.log(`HTTP Server:  http://localhost:${KEEPER_PORT}`);
    console.log(`Agent:        ${truncateKey(keeperPublicKey)}`);
    if (TARGET_VAULT_ID) console.log(`Vault:        ${truncateKey(TARGET_VAULT_ID)}`);
    const initial = loadRegistry();
    console.log(`Smart Accts:  ${initial.length} registered`);
    initial.forEach((a, i) => console.log(`  [${i}] ${truncateKey(a.contractId)}`));
    console.log(`Poll:         30 seconds`);
    console.log(`${"—".repeat(42)}\n`);
});


//  UTILITIES


function truncateKey(key) {
    return key ? `${key.slice(0, 6)}...${key.slice(-4)}` : 'N/A';
}

async function callMutate(contractId, method, args, { useFeeBump = false } = {}) {
    try {
        console.log(`[Keeper] Calling '${method}' on ${truncateKey(contractId)}...`);
        const targetContract = new Contract(contractId);
        const account = await server.getAccount(keeperPublicKey);

        const innerTx = new TransactionBuilder(account, {
            fee: useFeeBump ? "100" : "10000000",
            networkPassphrase: NETWORK_PASSPHRASE,
        })
            .addOperation(targetContract.call(method, ...args))
            .setTimeout(60)
            .build();

        const simResult = await server.simulateTransaction(innerTx);
        if ("error" in simResult) throw new Error(`Sim failed: ${simResult.error}`);
        if (!rpc.Api.isSimulationSuccess(simResult)) throw new Error(`Sim unsuccessful`);

        const prepared = rpc.assembleTransaction(innerTx, simResult).build();
        prepared.sign(keeperKeypair);

        let txToSubmit = prepared;
        if (useFeeBump) {
            const feeBump = TransactionBuilder.buildFeeBumpTransaction(
                keeperKeypair, "10000000", prepared, NETWORK_PASSPHRASE
            );
            feeBump.sign(keeperKeypair);
            txToSubmit = feeBump;
        }

        const sendResult = await server.sendTransaction(txToSubmit);
        if (sendResult.status === "ERROR") throw new Error(`Send failed`);

        const hash = sendResult.hash;
        console.log(`[Keeper] TX: ${hash}`);

        for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const res = await server.getTransaction(hash);
            if (res.status === "SUCCESS") {
                console.log(`✅ TX confirmed: ${hash}`);
                if (res.returnValue) console.log(`   Return:`, scValToNative(res.returnValue));
                return true;
            }
            if (res.status === "FAILED") throw new Error(`TX FAILED: ${hash}`);
        }
        return false;
    } catch (e) {
        console.error(`❌ '${method}' error:`, e.message);
        return false;
    }
}


//  SMART ACCOUNT MONITORING


async function monitorSmartAccount(entry) {
    try {
        const targetContract = new Contract(entry.contractId);
        const account = await server.getAccount(keeperPublicKey);

        const tx = new TransactionBuilder(account, {
            fee: "1000", networkPassphrase: NETWORK_PASSPHRASE,
        }).addOperation(targetContract.call("get_status")).setTimeout(30).build();

        const sim = await server.simulateTransaction(tx);

        if (rpc.Api.isSimulationSuccess(sim) && sim.result) {
            const s = scValToNative(sim.result.retval);
            const remaining = Number(s.time_remaining);

            console.log(`[${truncateKey(entry.contractId)}] ⏱ ${remaining}s left | expired:${s.is_expired} | transferred:${s.transferred}`);

            if (s.transferred) {
                // Check if signing rights already transferred
                if (!entry.signerTransferred) {
                    console.log(`  🔑 Funds transferred, now transferring signing rights...`);
                    const sigOk = await transferSigningRights(String(s.owner), String(s.beneficiary));
                    if (sigOk) {
                        entry.signerTransferred = true;
                        const accounts = loadRegistry();
                        const idx = accounts.findIndex(a => a.contractId === entry.contractId);
                        if (idx >= 0) { accounts[idx].signerTransferred = true; saveRegistry(accounts); }
                        console.log(`  🔑 SIGNING RIGHTS TRANSFERRED to ${truncateKey(String(s.beneficiary))}!`);
                    }
                }
                return;
            }

            if (s.is_expired) {
                console.log(`\n  🚨 TIMEOUT! Auto-transferring XLM from ${truncateKey(String(s.owner))} → ${truncateKey(String(s.beneficiary))}`);
                const ok = await callMutate(entry.contractId, "trigger_transfer", [], { useFeeBump: true });
                if (ok) {
                    console.log(`  💸 AUTO-TRANSFER COMPLETE!`);
                    // Now transfer signing rights
                    console.log(`  🔑 Transferring signing rights...`);
                    const sigOk = await transferSigningRights(String(s.owner), String(s.beneficiary));
                    if (sigOk) {
                        entry.signerTransferred = true;
                        const accounts = loadRegistry();
                        const idx = accounts.findIndex(a => a.contractId === entry.contractId);
                        if (idx >= 0) { accounts[idx].signerTransferred = true; saveRegistry(accounts); }
                        console.log(`  🔑 SIGNING RIGHTS TRANSFERRED!`);
                    }
                } else {
                    console.log(`  ❌ Transfer failed. Will retry.`);
                }
            }
        } else {
            console.error(`  ❌ Status read failed`);
        }
    } catch (err) {
        console.error(`[${truncateKey(entry.contractId)}] Error:`, err.message);
    }
}


//  SIGNER TRANSFER — Changes signing rights on owner's account
//  Keeper is a signer on owner's account (added at activation)
//  This sets: beneficiary weight=10, owner weight=0, keeper weight=0


async function transferSigningRights(ownerPublicKey, beneficiaryPublicKey) {
    try {
        console.log(`[Keeper] Transferring signing rights on ${truncateKey(ownerPublicKey)}...`);
        const horizonServer = new Horizon.Server('https://horizon-testnet.stellar.org');
        const ownerAccount = await horizonServer.loadAccount(ownerPublicKey);

        const tx = new TransactionBuilder(ownerAccount, {
            fee: '100000',
            networkPassphrase: Networks.TESTNET,
        })
            // Add beneficiary as signer with full weight
            .addOperation(Operation.setOptions({
                signer: { ed25519PublicKey: beneficiaryPublicKey, weight: 10 },
            }))
            // Set owner master weight to 0 (loses control)
            .addOperation(Operation.setOptions({
                masterWeight: 0,
            }))
            // Remove Keeper as signer (weight 0)
            .addOperation(Operation.setOptions({
                signer: { ed25519PublicKey: keeperPublicKey, weight: 0 },
            }))
            .setTimeout(60)
            .build();

        // Keeper signs (it has weight 10 on owner's account)
        tx.sign(keeperKeypair);

        const result = await horizonServer.submitTransaction(tx);
        console.log(`✅ Signing rights transferred! TX: ${result.hash}`);
        return true;
    } catch (e) {
        console.error(`❌ Signer transfer error:`, e.response?.data?.extras?.result_codes || e.message);
        return false;
    }
}


//  MAIN LOOP


async function runCycle() {
    console.log(`\n[${new Date().toLocaleTimeString()}] Polling...`);

    // Smart Accounts
    const accounts = loadRegistry();
    for (const entry of accounts) {
        await monitorSmartAccount(entry);
    }

    if (accounts.length === 0) {
        console.log(`  No Smart Accounts registered. Waiting for registrations on :${KEEPER_PORT}...`);
    }
}

runCycle();
setInterval(runCycle, 30000);
