/**
 * Deploy KeepAlive contracts to Stellar Testnet
 * Uses Node.js native TLS (works with WARP/proxy certificates)
 */
const { readFileSync } = require("fs");
const { execSync } = require("child_process");
const StellarSdk = require("@stellar/stellar-sdk");

const { Keypair, Networks, TransactionBuilder, Operation, Address, xdr, hash } = StellarSdk;
const { Server, assembleTransaction } = StellarSdk.rpc;

const RPC_URL = "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

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

    const server = new Server(RPC_URL);
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

    const simInstance = await server.simulateTransaction(uploadInstanceTx);
    if ("error" in simInstance) {
        console.error("❌ Simulation failed:", simInstance.error);
        process.exit(1);
    }

    const preparedInstance = assembleTransaction(uploadInstanceTx, simInstance).build();
    preparedInstance.sign(keypair);

    const sentInstance = await server.sendTransaction(preparedInstance);
    console.log(`   TX Hash: ${sentInstance.hash}`);

    const result1 = await pollTx(server, sentInstance.hash);
    const instanceHashBytes = result1.returnValue.value();
    const instanceWasmHash = Buffer.from(instanceHashBytes).toString("hex");
    console.log(`✅ Instance WASM Hash: ${instanceWasmHash}`);

    // === Step 2: Upload Factory WASM ===
    const account2 = await server.getAccount(publicKey);
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

    const simFactory = await server.simulateTransaction(uploadFactoryTx);
    if ("error" in simFactory) {
        console.error("❌ Simulation failed:", simFactory.error);
        process.exit(1);
    }

    const preparedFactory = assembleTransaction(uploadFactoryTx, simFactory).build();
    preparedFactory.sign(keypair);

    const sentFactory = await server.sendTransaction(preparedFactory);
    console.log(`   TX Hash: ${sentFactory.hash}`);

    const result2 = await pollTx(server, sentFactory.hash);
    const factoryHashBytes = result2.returnValue.value();
    const factoryWasmHash = Buffer.from(factoryHashBytes).toString("hex");
    console.log(`✅ Factory WASM Hash: ${factoryWasmHash}`);

    // === Step 3: Deploy Factory Contract ===
    const account3 = await server.getAccount(publicKey);
    console.log("\n🚀 Deploying Factory contract...");

    const deployTx = new TransactionBuilder(account3, {
        fee: "10000000",
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(
            Operation.createCustomContract({
                address: new Address(publicKey),
                wasmHash: Buffer.from(factoryHashBytes),
            })
        )
        .setTimeout(300)
        .build();

    const simDeploy = await server.simulateTransaction(deployTx);
    if ("error" in simDeploy) {
        console.error("❌ Simulation failed:", simDeploy.error);
        process.exit(1);
    }

    const preparedDeploy = assembleTransaction(deployTx, simDeploy).build();
    preparedDeploy.sign(keypair);

    const sentDeploy = await server.sendTransaction(preparedDeploy);
    console.log(`   TX Hash: ${sentDeploy.hash}`);

    const result3 = await pollTx(server, sentDeploy.hash);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ DEPLOYMENT COMPLETE!`);
    console.log(`   Instance WASM Hash: ${instanceWasmHash}`);
    console.log(`   Factory WASM Hash:  ${factoryWasmHash}`);
    console.log(`   Factory Contract:   ${result3.returnValue}`);
    console.log(`${"=".repeat(60)}`);
    console.log(`\n📝 Update these values in frontend/src/config/stellar.ts`);
}

main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
