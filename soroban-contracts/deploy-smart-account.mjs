/**
 * Deploy Smart Account Contract to Stellar Testnet
 */
import { readFileSync } from "fs";
import { execSync } from "child_process";
import * as StellarSdk from "@stellar/stellar-sdk";

const { Keypair, Networks, TransactionBuilder, Operation, Address } = StellarSdk;
const SorobanRpc = StellarSdk.SorobanRpc || StellarSdk.rpc;

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

async function main() {
    // Get secret key from stellar CLI
    let secretKey;
    try {
        secretKey = execSync("stellar keys show mykey", { encoding: "utf-8" }).trim();
        console.log("✅ Loaded key 'mykey' from stellar CLI");
    } catch {
        console.error("❌ Could not load key. Run: stellar keys generate --global mykey --network testnet --fund");
        process.exit(1);
    }

    const keypair = Keypair.fromSecret(secretKey);
    const publicKey = keypair.publicKey();
    console.log(`📍 Account: ${publicKey}`);

    const server = new SorobanRpc.Server(RPC_URL);
    let account = await server.getAccount(publicKey);

    // === Step 1: Upload Smart Account WASM ===
    console.log("\n📦 Uploading keepalive_smart_account.wasm...");
    const wasm = readFileSync("target/wasm32-unknown-unknown/release/keepalive_smart_account.wasm");
    console.log(`   Size: ${wasm.length} bytes`);

    const uploadTx = new TransactionBuilder(account, {
        fee: "10000000",
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(Operation.uploadContractWasm({ wasm: wasm }))
        .setTimeout(300)
        .build();

    const simUpload = await server.simulateTransaction(uploadTx);
    if (SorobanRpc.Api.isSimulationError(simUpload)) {
        console.error("❌ Simulation failed:", simUpload.error);
        process.exit(1);
    }

    const preparedUpload = SorobanRpc.assembleTransaction(uploadTx, simUpload).build();
    preparedUpload.sign(keypair);

    const sentUpload = await server.sendTransaction(preparedUpload);
    console.log(`   TX Hash: ${sentUpload.hash}`);

    let result = await pollTx(server, sentUpload.hash);
    // extract 32-byte wasm hash from ScVal
    const wasmHashBytes = result.returnValue.bytes();
    const wasmHash = wasmHashBytes.toString("hex");
    console.log(`✅ WASM Hash: ${wasmHash}`);

    // Refresh account sequence
    account = await server.getAccount(publicKey);

    // === Step 2: Deploy Contract ===
    console.log("\n🚀 Deploying Smart Account contract...");

    const deployTx = new TransactionBuilder(account, {
        fee: "10000000",
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(
            Operation.createCustomContract({
                address: new Address(publicKey),
                wasmHash: wasmHashBytes,
            })
        )
        .setTimeout(300)
        .build();

    const simDeploy = await server.simulateTransaction(deployTx);
    if (SorobanRpc.Api.isSimulationError(simDeploy)) {
        console.error("❌ Simulation failed:", simDeploy.error);
        process.exit(1);
    }

    const preparedDeploy = SorobanRpc.assembleTransaction(deployTx, simDeploy).build();
    preparedDeploy.sign(keypair);

    const sentDeploy = await server.sendTransaction(preparedDeploy);
    console.log(`   TX Hash: ${sentDeploy.hash}`);

    let result3 = await pollTx(server, sentDeploy.hash);

    // Extract contract ID from result
    const contractIdScVal = result3.returnValue;
    const contractId = StellarSdk.scValToNative(contractIdScVal);
    console.log(`\n${"═".repeat(60)}`);
    console.log(`✅ SMART ACCOUNT DEPLOYED!`);
    console.log(`   Contract ID: ${contractId}`);
    console.log(`${"═".repeat(60)}`);
}

async function pollTx(server, hash) {
    console.log("   ⏳ Waiting for confirmation...");
    for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        try {
            const txResult = await server.getTransaction(hash);
            if (txResult.status === "SUCCESS") {
                console.log("   ✅ Confirmed!");
                return txResult;
            } else if (txResult.status === "FAILED") {
                console.error("   ❌ Transaction failed:", JSON.stringify(txResult));
                process.exit(1);
            }
        } catch {
            // Not found yet, keep polling
        }
    }
    console.error("   ❌ Timeout waiting for transaction");
    process.exit(1);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
