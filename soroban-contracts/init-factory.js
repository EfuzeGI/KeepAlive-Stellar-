/**
 * Initialize the KeepAlive Factory contract on testnet.
 * Calls: factory.init(admin, instance_wasm_hash, xlm_sac_id)
 */
const { execSync } = require("child_process");
const StellarSdk = require("@stellar/stellar-sdk");

const { Keypair, Networks, TransactionBuilder, Address, nativeToScVal, xdr } = StellarSdk;
const { Server, assembleTransaction } = StellarSdk.rpc;

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

const FACTORY_CONTRACT_ID = "CDZ7TXU2GRFICPM4CWSQEVZBODJHDWWXKBSZWXOONMMLAZTT226PFCBN";
const XLM_SAC_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";
const INSTANCE_WASM_HASH = "6730dcc335785bebb3adae47f06895c61691a5d1a70c1f27e891bacc9d10098e";

async function main() {
    // Load key
    const secretKey = execSync("stellar keys show mykey", { encoding: "utf-8" }).trim();
    const keypair = Keypair.fromSecret(secretKey);
    const publicKey = keypair.publicKey();
    console.log(`📍 Admin: ${publicKey}`);

    const server = new Server(RPC_URL);
    const account = await server.getAccount(publicKey);

    // Build init args
    const adminScVal = new Address(publicKey).toScVal();
    const wasmHashBytes = Buffer.from(INSTANCE_WASM_HASH, "hex");
    const wasmHashScVal = xdr.ScVal.scvBytes(wasmHashBytes);
    const tokenScVal = new Address(XLM_SAC_ID).toScVal();

    const contract = new StellarSdk.Contract(FACTORY_CONTRACT_ID);

    const tx = new TransactionBuilder(account, {
        fee: "10000000",
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(contract.call("init", adminScVal, wasmHashScVal, tokenScVal))
        .setTimeout(300)
        .build();

    console.log("📡 Simulating init transaction...");
    const sim = await server.simulateTransaction(tx);

    if ("error" in sim) {
        console.error("❌ Simulation failed:", sim.error);
        process.exit(1);
    }

    const prepared = assembleTransaction(tx, sim).build();
    prepared.sign(keypair);

    console.log("🚀 Sending init transaction...");
    const sent = await server.sendTransaction(prepared);
    console.log(`   TX Hash: ${sent.hash}`);

    // Poll for result
    console.log("   ⏳ Waiting for confirmation...");
    for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
            const result = await server.getTransaction(sent.hash);
            if (result.status === "SUCCESS") {
                console.log("\n✅ Factory initialized successfully!");
                console.log(`   Admin:          ${publicKey}`);
                console.log(`   Instance WASM:  ${INSTANCE_WASM_HASH}`);
                console.log(`   XLM SAC:        ${XLM_SAC_ID}`);
                console.log(`   Factory:        ${FACTORY_CONTRACT_ID}`);
                console.log(`\n🎉 Factory is ready to deploy vaults!`);
                return;
            } else if (result.status === "FAILED") {
                console.error("❌ Transaction failed:", JSON.stringify(result));
                process.exit(1);
            }
        } catch {
            // still pending
        }
    }
    console.error("❌ Timeout");
    process.exit(1);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
