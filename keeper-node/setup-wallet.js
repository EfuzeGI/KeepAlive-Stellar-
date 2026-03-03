import { Keypair } from "@stellar/stellar-sdk";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
    console.log("=== KeepAlive Keeper Wallet Setup ===");
    console.log("Generating new Stellar Keypair...");

    // Generate new keypair
    const pair = Keypair.random();
    const publicKey = pair.publicKey();
    const secretKey = pair.secret();

    console.log(`\nKeeper Public Key: ${publicKey}`);
    console.log("Funding account on Stellar Testnet (Friendbot)...");

    try {
        // Fund the account using Friendbot
        const response = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(publicKey)}`);
        if (!response.ok) {
            throw new Error(`Friendbot returned ${response.status}: ${await response.text()}`);
        }

        console.log("✅ Account successfully funded on Testnet!");

        // Write .env file
        const envContent = `KEEPER_SECRET_KEY="${secretKey}"
RPC_URL="https://soroban-testnet.stellar.org"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
TARGET_VAULT_ID="CAWVZS3TKEV2A4R2H2GDQ7LORSXWIRL5K62DK23PC53G7N2HQQ3D2RCP"
`;
        const envPath = path.join(__dirname, ".env");
        fs.writeFileSync(envPath, envContent);

        console.log(`\n✅ .env file created at ${envPath}`);
        console.log("You can now start the Keeper agent using: node keeper.js");

    } catch (err) {
        console.error("❌ Failed to fund account:", err.message);
        process.exit(1);
    }
}

main();
