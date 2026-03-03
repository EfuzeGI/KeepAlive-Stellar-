"use client";

/**
 * useSorobanDeploy — React hook for deploying a KeepAlive vault via the Factory.
 *
 * This hook encapsulates the complete Soroban transaction lifecycle:
 *   1. Build a `Contract.call("deploy", ...)` invocation
 *   2. `simulateTransaction()` for resource estimation
 *   3. `assembleTransaction()` to attach resource footprint + fees
 *   4. `signTransaction()` via Freighter
 *   5. `sendTransaction()` + poll `getTransaction()` for confirmation
 *   6. Parse return value (new instance Address)
 *
 * Usage:
 *   const { deploy, isDeploying, error, deployedAddress } = useSorobanDeploy();
 *   await deploy({ backup: "G...", intervalSec: 2592000 });
 */

import { useState, useCallback } from "react";
import {
    FACTORY_CONTRACT_ID,
    SOROBAN_RPC_URL,
    NETWORK_PASSPHRASE,
    isValidStellarAddress,
} from "@/config/stellar";

// ═══════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════

export interface DeployParams {
    /** Beneficiary / backup G... address */
    backup: string;
    /** Heartbeat timeout in seconds (default: 30 days = 2_592_000) */
    intervalSec?: number;
    /** Grace period in seconds (default: 24h = 86_400) */
    gracePeriodSec?: number;
    /** Authorized agent G... address (default: self) */
    agent?: string;
    /** Optional encrypted payload string for the beneficiary */
    securePayload?: string;
}

export interface DeployResult {
    /** Soroban contract C... address of the new vault instance */
    instanceAddress: string;
    /** Owner G... address */
    owner: string;
    /** Transaction hash */
    txHash: string;
}

type DeployState = {
    /** Currently deploying */
    isDeploying: boolean;
    /** Current step description */
    step: string;
    /** Error message if failed */
    error: string | null;
    /** Result after successful deploy */
    result: DeployResult | null;
};

// ═══════════════════════════════════════════════════════════════════
//  Hook
// ═══════════════════════════════════════════════════════════════════

export function useSorobanDeploy() {
    const [state, setState] = useState<DeployState>({
        isDeploying: false,
        step: "",
        error: null,
        result: null,
    });

    const setStep = (step: string) =>
        setState((prev) => ({ ...prev, step }));

    const deploy = useCallback(
        async (params: DeployParams): Promise<DeployResult> => {
            setState({
                isDeploying: true,
                step: "Validating inputs...",
                error: null,
                result: null,
            });

            try {
                // ─── Validation ───────────────────────────────────
                if (!isValidStellarAddress(params.backup)) {
                    throw new Error(
                        `Invalid backup address: must be a Stellar G... public key (56 chars)`
                    );
                }

                // ─── Dynamic imports (avoid SSR) ──────────────────
                setStep("Loading Stellar SDK...");

                const StellarSdk = await import("@stellar/stellar-sdk");
                const {
                    Contract,
                    TransactionBuilder,
                    SorobanRpc,
                    Address,
                    nativeToScVal,
                    xdr,
                } = StellarSdk;

                const freighter = await import("@stellar/freighter-api");

                // ─── Check Freighter ──────────────────────────────
                setStep("Connecting to Freighter...");

                const { isConnected: connected } = await freighter.isConnected();
                if (!connected) {
                    throw new Error(
                        "Freighter wallet not found. Install from freighter.app"
                    );
                }

                const { address: ownerPublicKey } = await freighter.getAddress();
                if (!ownerPublicKey) {
                    throw new Error("No address from Freighter. Unlock your wallet.");
                }

                // ─── Build parameters ─────────────────────────────
                setStep("Preparing deploy transaction...");

                const intervalSec = params.intervalSec ?? 2_592_000; // 30 days
                const gracePeriodSec = params.gracePeriodSec ?? 86_400; // 24 hours
                const agentAddress = params.agent ?? ownerPublicKey;

                // Generate deterministic salt
                const encoder = new TextEncoder();
                const saltInput = encoder.encode(
                    ownerPublicKey + Date.now().toString()
                );
                const saltHash = await crypto.subtle.digest("SHA-256", saltInput);
                const saltBytes = new Uint8Array(saltHash);

                // Build ScVal arguments matching Factory.deploy() signature:
                // deploy(owner, backup, interval_sec, grace_period_sec, salt, agent, secure_payload)
                const contractArgs = [
                    new Address(ownerPublicKey).toScVal(),
                    new Address(params.backup).toScVal(),
                    nativeToScVal(intervalSec, { type: "u64" }),
                    nativeToScVal(gracePeriodSec, { type: "u64" }),
                    xdr.ScVal.scvBytes(Buffer.from(saltBytes)),
                    new Address(agentAddress).toScVal(),
                    params.securePayload
                        ? nativeToScVal(params.securePayload, { type: "string" })
                        : xdr.ScVal.scvVoid(),
                ];

                // ─── Build the transaction ────────────────────────
                const server = new SorobanRpc.Server(SOROBAN_RPC_URL);
                const contract = new Contract(FACTORY_CONTRACT_ID);
                const account = await server.getAccount(ownerPublicKey);

                const tx = new TransactionBuilder(account, {
                    fee: "10000000", // 1 XLM max fee
                    networkPassphrase: NETWORK_PASSPHRASE,
                })
                    .addOperation(contract.call("deploy", ...contractArgs))
                    .setTimeout(120) // 2 minute timeout
                    .build();

                // ─── Simulate for resource estimation ─────────────
                setStep("Simulating transaction...");

                const simResult = await server.simulateTransaction(tx);

                if ("error" in simResult) {
                    const errMsg =
                        (simResult as { error: string }).error ||
                        "Unknown simulation error";
                    throw new Error(`Simulation failed: ${errMsg}`);
                }

                if (!SorobanRpc.Api.isSimulationSuccess(simResult)) {
                    throw new Error(
                        "Simulation did not succeed. The contract may not be deployed or initialized."
                    );
                }

                // ─── Prepare (attach footprint + fees) ────────────
                setStep("Assembling transaction with resource limits...");

                const preparedTx = SorobanRpc.assembleTransaction(
                    tx,
                    simResult
                ).build();

                // ─── Sign via Freighter ───────────────────────────
                setStep("Awaiting signature in Freighter...");

                const signedXdr = await freighter.signTransaction(
                    preparedTx.toXDR(),
                    {
                        networkPassphrase: NETWORK_PASSPHRASE,
                    }
                );

                if (!signedXdr) {
                    throw new Error("Transaction signing was rejected by user");
                }

                const signedTx = TransactionBuilder.fromXDR(
                    signedXdr,
                    NETWORK_PASSPHRASE
                );

                // ─── Submit ───────────────────────────────────────
                setStep("Submitting transaction to Soroban RPC...");

                const sendResult = await server.sendTransaction(signedTx);

                if (sendResult.status === "ERROR") {
                    throw new Error(
                        `Transaction submission failed: ${JSON.stringify(sendResult)}`
                    );
                }

                const txHash = sendResult.hash;

                // ─── Poll for confirmation ────────────────────────
                setStep("Confirming on-chain (this may take 5-10 seconds)...");

                let getResult: StellarSdk.SorobanRpc.Api.GetTransactionResponse;
                const maxPolls = 30;

                for (let i = 0; i < maxPolls; i++) {
                    await new Promise((r) => setTimeout(r, 2000));
                    getResult = await server.getTransaction(txHash);

                    if (getResult.status === "SUCCESS") {
                        // ─── Parse return value ───────────────────
                        setStep("Parsing deployment result...");

                        let instanceAddress = "";
                        let owner = ownerPublicKey;

                        if (getResult.returnValue) {
                            try {
                                const native = StellarSdk.scValToNative(
                                    getResult.returnValue
                                );
                                // DeployResult struct: { instance_address, owner }
                                if (native && typeof native === "object") {
                                    instanceAddress =
                                        native.instance_address ||
                                        native.instanceAddress ||
                                        "";
                                    owner = native.owner || ownerPublicKey;
                                }
                            } catch {
                                // If parsing fails, the address may be in events
                                console.warn(
                                    "Could not parse return value, check events"
                                );
                            }
                        }

                        const result: DeployResult = {
                            instanceAddress,
                            owner,
                            txHash,
                        };

                        setState({
                            isDeploying: false,
                            step: "Deployment complete!",
                            error: null,
                            result,
                        });

                        return result;
                    }

                    if (getResult.status === "FAILED") {
                        throw new Error(
                            `Transaction failed on-chain. Hash: ${txHash}`
                        );
                    }

                    // NOT_FOUND = still pending, continue polling
                    setStep(
                        `Confirming on-chain (attempt ${i + 1}/${maxPolls})...`
                    );
                }

                throw new Error(
                    `Transaction timed out after ${maxPolls * 2}s. Hash: ${txHash}. ` +
                    `Check on stellar.expert/explorer/testnet/tx/${txHash}`
                );
            } catch (err) {
                const message =
                    err instanceof Error ? err.message : "Unknown deployment error";
                setState({
                    isDeploying: false,
                    step: "",
                    error: message,
                    result: null,
                });
                throw err;
            }
        },
        []
    );

    const reset = useCallback(() => {
        setState({
            isDeploying: false,
            step: "",
            error: null,
            result: null,
        });
    }, []);

    return {
        deploy,
        reset,
        isDeploying: state.isDeploying,
        step: state.step,
        error: state.error,
        result: state.result,
        deployedAddress: state.result?.instanceAddress ?? null,
    };
}
