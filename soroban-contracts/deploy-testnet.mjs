/**
 * Deploy KeepAlive contracts to Stellar Testnet
 * Uses Node.js native TLS (works with WARP/proxy certificates)
 */
const { readFileSync } = require("fs");
const { execSync } = require("child_process");
const StellarSdk = require("@stellar/stellar-sdk");
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
    const account = await server.getAccount(publicKey);

    // === Step 1: Upload Instance WASM ===
    console.log("\n📦 Uploading keepalive_instance.wasm...");
    const instanceWasm = readFileSync("target/wasm32-unknown-unknown/release/keepalive_instance.wasm");
    console.log(`   Size: ${instanceWasm.length} bytes`);

    const uploadInstanceTx = new TransactionBuilder(account, {
        fee: "10000000",
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(Operation.uploadContractWasm({ wasm: instanceWasm }))
        .setTimeout(300)
        .build();

    const simUploadInstance = await server.simulateTransaction(uploadInstanceTx);
    if (SorobanRpc.Api.isSimulationError(simUploadInstance)) {
        console.error("❌ Simulation failed:", simUploadInstance.error);
        process.exit(1);
    }

    const preparedUploadInstance = SorobanRpc.assembleTransaction(uploadInstanceTx, simUploadInstance).build();
    preparedUploadInstance.sign(keypair);

    const sentUploadInstance = await server.sendTransaction(preparedUploadInstance);
    console.log(`   TX Hash: ${sentUploadInstance.hash}`);

    let result = await pollTx(server, sentUploadInstance.hash);
    const instanceWasmHash = result.returnValue.toXDR("hex");
    console.log(`✅ Instance WASM Hash: ${instanceWasmHash}`);

    // Refresh account sequence
    const account2 = await server.getAccount(publicKey);

    // === Step 2: Upload Factory WASM ===
    console.log("\n📦 Uploading keepalive_factory.wasm...");
    const factoryWasm = readFileSync("target/wasm32-unknown-unknown/release/keepalive_factory.wasm");
    console.log(`   Size: ${factoryWasm.length} bytes`);

    const uploadFactoryTx = new TransactionBuilder(account2, {
        fee: "10000000",
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(Operation.uploadContractWasm({ wasm: factoryWasm }))
        .setTimeout(300)
        .build();

    const simUploadFactory = await server.simulateTransaction(uploadFactoryTx);
    if (SorobanRpc.Api.isSimulationError(simUploadFactory)) {
        console.error("❌ Simulation failed:", simUploadFactory.error);
        process.exit(1);
    }

    const preparedUploadFactory = SorobanRpc.assembleTransaction(uploadFactoryTx, simUploadFactory).build();
    preparedUploadFactory.sign(keypair);

    const sentUploadFactory = await server.sendTransaction(preparedUploadFactory);
    console.log(`   TX Hash: ${sentUploadFactory.hash}`);

    let result2 = await pollTx(server, sentUploadFactory.hash);
    const factoryWasmHash = result2.returnValue.toXDR("hex");
    console.log(`✅ Factory WASM Hash: ${factoryWasmHash}`);

    // Refresh account sequence
    const account3 = await server.getAccount(publicKey);

    // === Step 3: Deploy Factory Contract ===
    console.log("\n🚀 Deploying Factory contract...");
    const factoryWasmHashBytes = Buffer.from(factoryWasmHash, "hex");

    const deployTx = new TransactionBuilder(account3, {
        fee: "10000000",
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(
            Operation.createCustomContract({
                address: new Address(publicKey),
                wasmHash: factoryWasmHashBytes,
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
    const contractId = result3.returnValue;
    console.log(`\n${"═".repeat(60)}`);
    console.log(`✅ FACTORY CONTRACT DEPLOYED!`);
    console.log(`   Factory Contract: ${contractId}`);
    console.log(`   Instance WASM Hash: ${instanceWasmHash}`);
    console.log(`${"═".repeat(60)}`);
    console.log(`\n📝 Save these values in frontend/src/config/stellar.ts`);
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
