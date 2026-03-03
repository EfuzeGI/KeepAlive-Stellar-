"use client";

import React, {
    createContext,
    useContext,
    useEffect,
    useState,
    useCallback,
    useRef,
    ReactNode,
} from "react";
import {
    FACTORY_CONTRACT_ID,
    SMART_ACCOUNT_WASM_HASH,
    SOROBAN_RPC_URL,
    NETWORK_PASSPHRASE,
    XLM_SAC_ID,
    stroopsToXlm,
    xlmToStroops,
    RPC_ENDPOINTS,
} from "@/config/stellar";

// ═══════════════════════════════════════════════════════════════════
//  Types
// ═══════════════════════════════════════════════════════════════════

interface VaultStatus {
    owner: string;
    backup: string;
    vault_balance: string; // stroops as string
    interval_sec: number;
    grace_period_sec: number;
    last_ping: number;
    time_remaining_sec: number;
    warning_triggered_at: number;
    warning_grace_remaining_sec: number;
    is_expired: boolean;
    is_warning_active: boolean;
    is_execution_ready: boolean;
    is_yielding: boolean;
    is_emergency: boolean;
    is_completed: boolean;
    has_secure_payload: boolean;
}

interface StellarContextType {
    publicKey: string | null;
    isConnected: boolean;
    isLoading: boolean;
    isSyncing: boolean;
    isTransactionPending: boolean;
    connectionError: string | null;
    vaultStatus: VaultStatus | null;
    instanceContractId: string | null;
    factoryContractId: string;
    connect: () => Promise<void>;
    disconnect: () => void;
    ping: () => Promise<void>;
    deposit: (amountXlm: string) => Promise<void>;
    withdraw: (amountXlm?: string) => Promise<void>;
    setupVault: (
        backup: string,
        intervalSec: number,
        gracePeriodSec?: number,
        securePayload?: string
    ) => Promise<void>;
    deploySmartAccount: (secretKey: string, beneficiary: string, timeoutSec: number) => Promise<string>;
    getBalance: (publicKey: string) => Promise<string>;
    triggerFallback: (confirmDeath: boolean) => Promise<void>;
    revealPayload: (ownerAddress?: string) => Promise<string | null>;
    updateBeneficiary: (newBackup: string) => Promise<void>;
    updateInterval: (newIntervalSec: number) => Promise<void>;
    updateGracePeriod: (newGraceSec: number) => Promise<void>;
    resetVault: () => Promise<void>;
    refreshStatus: (silent?: boolean) => Promise<void>;
}

const StellarContext = createContext<StellarContextType | null>(null);

// ═══════════════════════════════════════════════════════════════════
//  Polling & Cache
// ═══════════════════════════════════════════════════════════════════

const POLLING_INTERVAL = 30000; // 30 seconds
const STORAGE_KEY_INSTANCE = "keepalive_instance_contract_id";
const STORAGE_KEY_STATUS = "keepalive_vault_status";

const safeLocalStorage = {
    getItem: (key: string): string | null => {
        if (typeof window === "undefined") return null;
        try {
            return localStorage.getItem(key);
        } catch {
            return null;
        }
    },
    setItem: (key: string, value: string): void => {
        if (typeof window === "undefined") return;
        try {
            localStorage.setItem(key, value);
        } catch { }
    },
    removeItem: (key: string): void => {
        if (typeof window === "undefined") return;
        try {
            localStorage.removeItem(key);
        } catch { }
    },
};

// ═══════════════════════════════════════════════════════════════════
//  Freighter API Helpers
// ═══════════════════════════════════════════════════════════════════

/**
 * Dynamically import freighter-api to avoid SSR issues.
 * Install: npm install @stellar/freighter-api
 */
async function getFreighter() {
    const freighter = await import("@stellar/freighter-api");
    return freighter;
}

// ═══════════════════════════════════════════════════════════════════
//  Soroban RPC Helpers
// ═══════════════════════════════════════════════════════════════════

/**
 * Call a read-only (view) method on a Soroban contract via RPC.
 * Uses simulateTransaction which does NOT require signing.
 */
async function sorobanViewCall(
    contractId: string,
    method: string,
    args: unknown[] = [],
    sourcePublicKey?: string,
): Promise<unknown> {
    // Dynamic import to avoid SSR issues.
    // Install: npm install @stellar/stellar-sdk
    const StellarSdk = await import("@stellar/stellar-sdk");
    const { Contract, TransactionBuilder, Networks, Account, rpc } = StellarSdk;
    const { Server: SorobanServer, Api: SorobanApi, assembleTransaction } = rpc;

    const server = new SorobanServer(SOROBAN_RPC_URL);
    const contract = new Contract(contractId);

    // Build a simulation-only transaction
    // For view calls, we need a source account — use a dummy if not connected
    const source = sourcePublicKey || "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

    // Fetch account or use a dummy one for simulation
    let account: InstanceType<typeof Account>;
    try {
        const acc = await server.getAccount(source);
        account = acc;
    } catch {
        account = new Account(source, "0");
    }

    const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(contract.call(method, ...(args as any[])))
        .setTimeout(30)
        .build();

    const simResult = await server.simulateTransaction(tx);

    if ("error" in simResult) {
        throw new Error(`Simulation error: ${(simResult as { error: string }).error}`);
    }

    // Extract return value from simulation
    if (SorobanApi.isSimulationSuccess(simResult) && simResult.result) {
        return StellarSdk.scValToNative(simResult.result.retval);
    }

    return null;
}

/**
 * Build, simulate, sign (via Freighter), and submit a transaction.
 */
async function sorobanMutateCall(
    contractId: string,
    method: string,
    args: unknown[] = [],
    sourcePublicKey: string,
): Promise<unknown> {
    const StellarSdk = await import("@stellar/stellar-sdk");
    const { Contract, TransactionBuilder, rpc } = StellarSdk;
    const { Server: SorobanServer, assembleTransaction, Api: SorobanApi } = rpc;
    const freighter = await getFreighter();

    const server = new SorobanServer(SOROBAN_RPC_URL);
    const contract = new Contract(contractId);

    const account = await server.getAccount(sourcePublicKey);

    // Build the transaction
    const tx = new TransactionBuilder(account, {
        fee: "10000000", // 1 XLM max fee (Soroban transactions can be expensive)
        networkPassphrase: NETWORK_PASSPHRASE,
    })
        .addOperation(contract.call(method, ...(args as any[])))
        .setTimeout(60)
        .build();

    // Simulate to get resource estimates
    const simResult = await server.simulateTransaction(tx);
    if ("error" in simResult) {
        throw new Error(`Simulation error: ${(simResult as { error: string }).error}`);
    }
    if (!SorobanApi.isSimulationSuccess(simResult)) {
        throw new Error(`Simulation did not succeed: ${JSON.stringify(simResult)}`);
    }

    // Prepare the transaction — in SDK 14.x assembleTransaction returns TransactionBuilder, so we need .build()
    const preparedTx = assembleTransaction(tx, simResult).build();

    // Sign with Freighter
    const signResult = await freighter.signTransaction(preparedTx.toXDR(), {
        networkPassphrase: NETWORK_PASSPHRASE,
    });

    if (!signResult) {
        throw new Error("Transaction signing was rejected");
    }

    // Parse the signed XDR back into a Transaction
    // Freighter v6+ returns { signedTxXdr, signerAddress }
    const signedXdr = typeof signResult === "string" ? signResult : signResult.signedTxXdr;
    const signedTx = TransactionBuilder.fromXDR(
        signedXdr,
        NETWORK_PASSPHRASE,
    );

    // Submit and poll for completion
    const sendResult = await server.sendTransaction(signedTx);

    if (sendResult.status === "ERROR") {
        throw new Error(`Transaction failed: ${sendResult.status}`);
    }

    // Poll for confirmation
    const hash = sendResult.hash;
    let getResult: any;

    for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        getResult = await server.getTransaction(hash);

        if (getResult.status === "SUCCESS") {
            if (getResult.returnValue) {
                return StellarSdk.scValToNative(getResult.returnValue);
            }
            return null;
        }

        if (getResult.status === "FAILED") {
            throw new Error("Transaction failed on-chain");
        }
        // status === "NOT_FOUND" means still pending
    }

    throw new Error("Transaction timed out after 60s");
}

// ═══════════════════════════════════════════════════════════════════
//  Provider
// ═══════════════════════════════════════════════════════════════════

export function StellarProvider({ children }: { children: ReactNode }) {
    const [publicKey, setPublicKey] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isTransactionPending, setIsTransactionPending] = useState(false);
    const [connectionError, setConnectionError] = useState<string | null>(null);
    const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
    const [instanceContractId, setInstanceContractId] = useState<string | null>(null);

    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const previousStatusRef = useRef<VaultStatus | null>(null);

    // ═══════════════════════════════════════════════════════════════
    //  Wallet Connection (Freighter)
    // ═══════════════════════════════════════════════════════════════

    // Check if already connected on mount
    useEffect(() => {
        const checkConnection = async () => {
            try {
                const freighter = await getFreighter();
                const { isConnected: connected } = await freighter.isConnected();

                if (connected) {
                    const { address } = await freighter.getAddress();
                    if (address) {
                        setPublicKey(address);

                        // Load cached instance contract ID
                        const cachedInstance = safeLocalStorage.getItem(STORAGE_KEY_INSTANCE);
                        if (cachedInstance) {
                            setInstanceContractId(cachedInstance);
                        }
                    }
                }
            } catch (err) {
                console.error("Failed to check Freighter connection:", err);
            } finally {
                setIsLoading(false);
            }
        };

        checkConnection();
    }, []);

    // Connect to Freighter
    const connect = useCallback(async () => {
        try {
            const freighter = await getFreighter();
            const { isConnected: connected } = await freighter.isConnected();

            if (!connected) {
                throw new Error(
                    "Freighter wallet extension not found. Please install it from freighter.app"
                );
            }

            // requestAccess() triggers the Freighter popup for user approval
            let address: string | undefined;
            try {
                const accessResult = await freighter.requestAccess();
                address = accessResult?.address;
            } catch (accessErr) {
                console.warn("requestAccess failed, trying getAddress:", accessErr);
            }

            // Fallback: if requestAccess didn't return address, try getAddress
            if (!address) {
                const addrResult = await freighter.getAddress();
                address = addrResult?.address;
            }

            if (!address) {
                throw new Error("No address returned from Freighter. Please unlock your wallet and approve the connection.");
            }

            setPublicKey(address);
            setConnectionError(null);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Failed to connect wallet";
            setConnectionError(msg);
            console.error("Wallet connection failed:", err);
        }
    }, []);

    // Disconnect
    const disconnect = useCallback(() => {
        setPublicKey(null);
        setVaultStatus(null);
        setInstanceContractId(null);
        previousStatusRef.current = null;
        safeLocalStorage.removeItem(STORAGE_KEY_INSTANCE);
        safeLocalStorage.removeItem(STORAGE_KEY_STATUS);
    }, []);

    // ═══════════════════════════════════════════════════════════════
    //  Vault Status Polling
    // ═══════════════════════════════════════════════════════════════

    const refreshStatus = useCallback(
        async (silent: boolean = false) => {
            if (!publicKey) {
                setVaultStatus(null);
                return;
            }

            if (!silent) setIsSyncing(true);
            setConnectionError(null);

            try {
                // Step 1: Find the user's instance via Factory
                let contractId = instanceContractId;

                if (!contractId) {
                    try {
                        const StellarSdk = await import("@stellar/stellar-sdk");
                        const { Address } = StellarSdk;

                        const ownerScVal = new Address(publicKey).toScVal();

                        const result = await sorobanViewCall(
                            FACTORY_CONTRACT_ID,
                            "get_instance",
                            [ownerScVal],
                            publicKey,
                        );

                        if (result && typeof result === "string") {
                            contractId = result;
                            setInstanceContractId(contractId);
                            safeLocalStorage.setItem(STORAGE_KEY_INSTANCE, contractId);
                        } else {
                            // No vault deployed for this user
                            setVaultStatus(null);
                            previousStatusRef.current = null;
                            safeLocalStorage.removeItem(STORAGE_KEY_INSTANCE);
                            return;
                        }
                    } catch (factoryErr: unknown) {
                        // Factory not initialized or user has no vault — treat as no vault
                        const errMsg = factoryErr instanceof Error ? factoryErr.message : String(factoryErr);
                        console.warn("get_instance failed (user may not have a vault):", errMsg);
                        setVaultStatus(null);
                        previousStatusRef.current = null;
                        safeLocalStorage.removeItem(STORAGE_KEY_INSTANCE);
                        return;
                    }
                }

                // Step 2: Query the instance's status
                const status = (await sorobanViewCall(
                    contractId,
                    "get_status",
                    [],
                    publicKey,
                )) as VaultStatus | null;

                if (status) {
                    setVaultStatus(status);
                    previousStatusRef.current = status;
                    safeLocalStorage.setItem(STORAGE_KEY_STATUS, JSON.stringify(status, (_, v) => typeof v === 'bigint' ? v.toString() : v));
                } else {
                    setVaultStatus(null);
                    previousStatusRef.current = null;
                }
            } catch (err) {
                console.error("Failed to fetch vault status:", err);
                setConnectionError("Connection issues, retrying...");
                // Keep previous state on error
            } finally {
                setIsSyncing(false);
            }
        },
        [publicKey, instanceContractId]
    );

    // Start/stop polling on connection change
    useEffect(() => {
        if (publicKey) {
            refreshStatus();

            pollingRef.current = setInterval(() => {
                refreshStatus(true);
            }, POLLING_INTERVAL);

            return () => {
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
            };
        } else {
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }
            setVaultStatus(null);
        }
    }, [publicKey, refreshStatus]);

    // ═══════════════════════════════════════════════════════════════
    //  Contract Interaction Wrappers
    // ═══════════════════════════════════════════════════════════════

    /**
     * Deploy a new vault via the Factory contract.
     */
    const setupVault = useCallback(
        async (
            backup: string,
            intervalSec: number,
            gracePeriodSec: number = 86400,
            securePayload?: string,
        ) => {
            if (!publicKey) throw new Error("Wallet not connected");
            setIsTransactionPending(true);

            try {
                const StellarSdk = await import("@stellar/stellar-sdk");
                const { nativeToScVal, xdr, Address } = StellarSdk;

                // Generate a deterministic salt from the owner's public key
                const encoder = new TextEncoder();
                const saltInput = encoder.encode(publicKey + Date.now().toString());
                const saltHash = await crypto.subtle.digest("SHA-256", saltInput);
                const saltBytes = new Uint8Array(saltHash);

                // Agent address — for now use a placeholder, replace with actual agent
                const agentAddress = publicKey; // Self-agent for testnet

                const args = [
                    new Address(publicKey).toScVal(),                                  // owner
                    new Address(backup).toScVal(),                                     // backup
                    nativeToScVal(intervalSec, { type: "u64" }),                       // interval_sec
                    nativeToScVal(gracePeriodSec, { type: "u64" }),                    // grace_period_sec
                    xdr.ScVal.scvBytes(Buffer.from(saltBytes)),                        // salt
                    new Address(agentAddress).toScVal(),                               // agent
                    securePayload
                        ? nativeToScVal(securePayload, { type: "string" })
                        : xdr.ScVal.scvVoid(),                                        // secure_payload
                ];

                const result = (await sorobanMutateCall(
                    FACTORY_CONTRACT_ID,
                    "deploy",
                    args,
                    publicKey,
                )) as { instance_address: string; owner: string } | null;

                if (result?.instance_address) {
                    setInstanceContractId(result.instance_address);
                    safeLocalStorage.setItem(STORAGE_KEY_INSTANCE, result.instance_address);
                }

                await refreshStatus();
            } finally {
                setIsTransactionPending(false);
            }
        },
        [publicKey, refreshStatus]
    );

    /**
     * Ping (reset heartbeat). Owner-only.
     */
    const ping = useCallback(async () => {
        if (!publicKey || !instanceContractId) throw new Error("No vault");
        setIsTransactionPending(true);
        try {
            await sorobanMutateCall(instanceContractId, "ping", [], publicKey);
            await refreshStatus();
        } finally {
            setIsTransactionPending(false);
        }
    }, [publicKey, instanceContractId, refreshStatus]);

    /**
     * Deposit XLM into the vault.
     * Caller must have enough XLM balance.
     */
    const deposit = useCallback(
        async (amountXlm: string) => {
            if (!publicKey || !instanceContractId) throw new Error("No vault");
            setIsTransactionPending(true);

            try {
                const StellarSdk = await import("@stellar/stellar-sdk");
                const { nativeToScVal, Address } = StellarSdk;

                const stroops = xlmToStroops(amountXlm);

                const args = [
                    new Address(publicKey).toScVal(),                       // from
                    nativeToScVal(stroops, { type: "i128" }),               // amount
                ];

                await sorobanMutateCall(instanceContractId, "deposit", args, publicKey);
                await refreshStatus();
            } finally {
                setIsTransactionPending(false);
            }
        },
        [publicKey, instanceContractId, refreshStatus]
    );

    /**
     * Withdraw XLM from the vault. Owner-only.
     */
    const withdraw = useCallback(
        async (amountXlm?: string) => {
            if (!publicKey || !instanceContractId) throw new Error("No vault");
            setIsTransactionPending(true);

            try {
                const StellarSdk = await import("@stellar/stellar-sdk");
                const { nativeToScVal } = StellarSdk;

                const stroops = amountXlm ? xlmToStroops(amountXlm) : BigInt(0);
                const args = [nativeToScVal(stroops, { type: "i128" })]; // 0 = withdraw all

                await sorobanMutateCall(instanceContractId, "withdraw", args, publicKey);
                await refreshStatus();
            } finally {
                setIsTransactionPending(false);
            }
        },
        [publicKey, instanceContractId, refreshStatus]
    );

    /**
     * Trigger fallback (confirm death or resume).
     */
    const triggerFallback = useCallback(
        async (confirmDeath: boolean) => {
            if (!publicKey || !instanceContractId) throw new Error("No vault");
            setIsTransactionPending(true);
            try {
                const StellarSdk = await import("@stellar/stellar-sdk");
                const { nativeToScVal } = StellarSdk;

                const args = [nativeToScVal(confirmDeath, { type: "bool" })];
                await sorobanMutateCall(
                    instanceContractId,
                    "trigger_fallback",
                    args,
                    publicKey,
                );
                await refreshStatus();
            } finally {
                setIsTransactionPending(false);
            }
        },
        [publicKey, instanceContractId, refreshStatus]
    );

    /**
     * Reveal secure payload.
     */
    const revealPayload = useCallback(
        async (ownerAddress?: string): Promise<string | null> => {
            if (!publicKey || !instanceContractId) return null;
            setIsTransactionPending(true);
            try {
                const StellarSdk = await import("@stellar/stellar-sdk");
                const { Address } = StellarSdk;

                const callerAddr = ownerAddress || publicKey;
                const args = [new Address(callerAddr).toScVal()]; // caller

                const result = await sorobanMutateCall(
                    instanceContractId,
                    "reveal_payload",
                    args,
                    publicKey,
                );

                return (result as string) || null;
            } catch (err) {
                console.error("reveal_payload failed:", err);
                throw err;
            } finally {
                setIsTransactionPending(false);
            }
        },
        [publicKey, instanceContractId]
    );

    /**
     * Update beneficiary. Owner-only.
     */
    const updateBeneficiary = useCallback(
        async (newBackup: string) => {
            if (!publicKey || !instanceContractId) throw new Error("No vault");
            setIsTransactionPending(true);
            try {
                const StellarSdk = await import("@stellar/stellar-sdk");
                const { Address } = StellarSdk;

                const args = [new Address(newBackup).toScVal()];
                await sorobanMutateCall(
                    instanceContractId,
                    "update_beneficiary",
                    args,
                    publicKey,
                );
                await refreshStatus();
            } finally {
                setIsTransactionPending(false);
            }
        },
        [publicKey, instanceContractId, refreshStatus]
    );

    /**
     * Update heartbeat interval. Owner-only.
     */
    const updateInterval = useCallback(
        async (newIntervalSec: number) => {
            if (!publicKey || !instanceContractId) throw new Error("No vault");
            setIsTransactionPending(true);
            try {
                const StellarSdk = await import("@stellar/stellar-sdk");
                const { nativeToScVal } = StellarSdk;

                const args = [nativeToScVal(newIntervalSec, { type: "u64" })];
                await sorobanMutateCall(
                    instanceContractId,
                    "update_interval",
                    args,
                    publicKey,
                );
                await refreshStatus();
            } finally {
                setIsTransactionPending(false);
            }
        },
        [publicKey, instanceContractId, refreshStatus]
    );

    /**
     * Update grace period. Owner-only.
     */
    const updateGracePeriod = useCallback(
        async (newGraceSec: number) => {
            if (!publicKey || !instanceContractId) throw new Error("No vault");
            setIsTransactionPending(true);
            try {
                const StellarSdk = await import("@stellar/stellar-sdk");
                const { nativeToScVal } = StellarSdk;

                const args = [nativeToScVal(newGraceSec, { type: "u64" })];
                await sorobanMutateCall(
                    instanceContractId,
                    "update_grace_period",
                    args,
                    publicKey,
                );
                await refreshStatus();
            } finally {
                setIsTransactionPending(false);
            }
        },
        [publicKey, instanceContractId, refreshStatus]
    );

    /**
     * Reset (delete) the vault and return all funds to owner.
     */
    const resetVault = useCallback(async () => {
        if (!publicKey || !instanceContractId) throw new Error("No vault");
        setIsTransactionPending(true);
        try {
            await sorobanMutateCall(instanceContractId, "reset_vault", [], publicKey);

            // Also unregister from factory
            const StellarSdk = await import("@stellar/stellar-sdk");
            const { Address } = StellarSdk;
            const args = [new Address(publicKey).toScVal()];
            await sorobanMutateCall(FACTORY_CONTRACT_ID, "unregister", args, publicKey);

            setInstanceContractId(null);
            setVaultStatus(null);
            previousStatusRef.current = null;
            safeLocalStorage.removeItem(STORAGE_KEY_INSTANCE);
            safeLocalStorage.removeItem(STORAGE_KEY_STATUS);
        } finally {
            setIsTransactionPending(false);
        }
    }, [publicKey, instanceContractId]);

    /**
     * Get XLM balance for an account via Horizon API
     */
    const getBalance = useCallback(async (address: string): Promise<string> => {
        try {
            const res = await fetch(`https://horizon-testnet.stellar.org/accounts/${address}`);
            if (res.status === 404) return "0"; // Account not funded yet
            if (!res.ok) throw new Error(`Horizon error: ${res.status}`);
            const data = await res.json();
            const nativeBalance = data.balances?.find((b: any) => b.asset_type === "native");
            return nativeBalance?.balance || "0";
        } catch (err) {
            console.error("Failed to get balance", err);
            return "0";
        }
    }, []);

    /**
     * Deploy a Smart Account instance using a Testnet Secret Key and configure it as a signer
     */
    const deploySmartAccount = useCallback(async (
        secretKey: string,
        beneficiary: string,
        timeoutSec: number
    ): Promise<string> => {
        setIsTransactionPending(true);
        try {
            const StellarSdk = await import("@stellar/stellar-sdk");
            const { Keypair, TransactionBuilder, Networks, rpc, Operation, nativeToScVal, Address, xdr } = StellarSdk;
            const server = new rpc.Server(SOROBAN_RPC_URL);

            const keypair = Keypair.fromSecret(secretKey);
            const pubKey = keypair.publicKey();
            const account = await server.getAccount(pubKey);

            // 1. Deploy Contract Instance
            const wasmHashBytes = Buffer.from(SMART_ACCOUNT_WASM_HASH, "hex");

            const deployTx = new TransactionBuilder(account, {
                fee: "10000000",
                networkPassphrase: NETWORK_PASSPHRASE,
            })
                .addOperation(
                    Operation.createCustomContract({
                        address: new Address(pubKey),
                        wasmHash: wasmHashBytes,
                    })
                )
                .setTimeout(300)
                .build();

            // Simulate & Build
            const simDeploy = await server.simulateTransaction(deployTx);
            if (rpc.Api.isSimulationError(simDeploy)) throw new Error("Simulation failed");

            const preparedDeploy = rpc.assembleTransaction(deployTx, simDeploy).build();
            preparedDeploy.sign(keypair);

            const sentDeploy = await server.sendTransaction(preparedDeploy);

            // Poll for completion
            let contractId = "";
            for (let i = 0; i < 30; i++) {
                await new Promise((r) => setTimeout(r, 2000));
                const res = await server.getTransaction(sentDeploy.hash);
                if (res.status === "SUCCESS") {
                    // returnValue is an ScVal — convert to native string
                    const rv = (res as any).returnValue;
                    contractId = rv ? StellarSdk.scValToNative(rv) : "";
                    if (typeof contractId !== "string") contractId = String(contractId);
                    break;
                }
            }
            if (!contractId) throw new Error("Deploy Tx Timeout");

            // 2. Init Smart Account parameters
            const refreshedAccount = await server.getAccount(pubKey);

            // Extract raw ed25519 pubkey bytes (32 bytes) from Stellar G... addresses
            const { StrKey, xdr: xdrTypes } = StellarSdk;
            const ownerPubKeyBytes = StrKey.decodeEd25519PublicKey(pubKey);
            const beneficiaryPubKeyBytes = StrKey.decodeEd25519PublicKey(beneficiary);

            const initArgs = [
                new Address(pubKey).toScVal(),                                        // owner
                new Address(beneficiary).toScVal(),                                   // beneficiary
                nativeToScVal(timeoutSec, { type: "u64" }),                          // timeout_duration
                xdrTypes.ScVal.scvBytes(Buffer.from(ownerPubKeyBytes)),               // owner_pub_key
                xdrTypes.ScVal.scvBytes(Buffer.from(beneficiaryPubKeyBytes)),          // beneficiary_pub_key
                new Address(pubKey).toScVal(),                                        // agent (self for now)
                new Address(XLM_SAC_ID).toScVal(),                                   // xlm_sac
            ];

            const initTx = new TransactionBuilder(refreshedAccount, {
                fee: "10000000",
                networkPassphrase: NETWORK_PASSPHRASE,
            })
                .addOperation(
                    Operation.invokeContractFunction({
                        contract: contractId,
                        function: "init",
                        args: initArgs
                    })
                )
                .setTimeout(100)
                .build();

            // Simulate Init
            const simInit = await server.simulateTransaction(initTx);
            const preparedInit = rpc.assembleTransaction(initTx, simInit).build();
            preparedInit.sign(keypair);
            const sentInit = await server.sendTransaction(preparedInit);

            // Wait for init completion
            for (let i = 0; i < 30; i++) {
                await new Promise((r) => setTimeout(r, 2000));
                const res = await server.getTransaction(sentInit.hash);
                if (res.status === "SUCCESS") break;
            }

            // Smart Account is now deployed and initialized.
            // Step 3: Approve the contract to spend owner's XLM via SAC
            // This allows trigger_transfer() to use transfer_from after timeout
            console.log("Step 3: Approving SAC for auto-transfer...");
            const account3 = await server.getAccount(pubKey);

            // Approve a large amount (max practical) with a far-future expiration
            // 1 billion XLM in stroops = 10^16
            const approveAmount = "10000000000000000"; // 10^16 stroops
            const currentLedger = await server.getLatestLedger();
            const expirationLedger = currentLedger.sequence + 1_500_000; // ~3 months (testnet max ~3.1M)

            const approveTx = new TransactionBuilder(account3, {
                fee: "10000000",
                networkPassphrase: NETWORK_PASSPHRASE,
            })
                .addOperation(
                    Operation.invokeContractFunction({
                        contract: XLM_SAC_ID,
                        function: "approve",
                        args: [
                            new Address(pubKey).toScVal(),                    // from (owner)
                            new Address(contractId).toScVal(),                // spender (contract)
                            nativeToScVal(approveAmount, { type: "i128" }),   // amount
                            nativeToScVal(expirationLedger, { type: "u32" }), // expiration_ledger
                        ],
                    })
                )
                .setTimeout(100)
                .build();

            const simApprove = await server.simulateTransaction(approveTx);
            const preparedApprove = rpc.assembleTransaction(approveTx, simApprove).build();
            preparedApprove.sign(keypair);
            const sentApprove = await server.sendTransaction(preparedApprove);
            console.log("Approve TX hash:", sentApprove.hash);

            for (let i = 0; i < 30; i++) {
                await new Promise((r) => setTimeout(r, 2000));
                const res = await server.getTransaction(sentApprove.hash);
                if (res.status === "SUCCESS") break;
            }

            // Step 4: Auto-register with Keeper agent
            console.log("Step 4: Registering with Keeper agent...");
            let keeperPublicKey = "";
            try {
                const keeperUrl = process.env.NEXT_PUBLIC_KEEPER_URL || "http://localhost:3002";
                // Fetch Keeper's public key
                const pkRes = await fetch(`${keeperUrl}/public-key`);
                if (pkRes.ok) {
                    const pkData = await pkRes.json();
                    keeperPublicKey = pkData.publicKey;
                }
                await fetch(`${keeperUrl}/register-smart-account`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        contract_id: contractId,
                        owner: pubKey,
                        beneficiary: beneficiary,
                    }),
                });
                console.log("Keeper notified:", contractId);
            } catch (regErr) {
                console.warn("Keeper registration skipped (not reachable):", regErr);
            }

            // Step 5: Add Keeper as signer on owner's account (SetOptions)
            // This allows Keeper to transfer signing rights to beneficiary after timeout
            if (keeperPublicKey) {
                console.log("Step 5: Adding Keeper as signer on owner account...");
                // Wait 5 seconds to ensure Horizon is synced with the latest sequence number after Soroban TXs
                await new Promise((resolve) => setTimeout(resolve, 5000));

                const Horizon = StellarSdk.Horizon;
                const horizonServer = new Horizon.Server("https://horizon-testnet.stellar.org");
                const horizonAccount = await horizonServer.loadAccount(pubKey);

                const setOptsTx = new TransactionBuilder(horizonAccount, {
                    fee: "100000",
                    networkPassphrase: Networks.TESTNET,
                })
                    .addOperation(Operation.setOptions({
                        signer: { ed25519PublicKey: keeperPublicKey, weight: 10 },
                        lowThreshold: 0,
                        medThreshold: 0,
                        highThreshold: 10,
                    }))
                    .setTimeout(60)
                    .build();

                setOptsTx.sign(keypair);
                const setOptsResult = await horizonServer.submitTransaction(setOptsTx);
                console.log("Keeper added as signer! TX:", (setOptsResult as any).hash);
            }

            console.log("Smart Account fully configured:", contractId);
            return contractId;

        } catch (e: any) {
            console.error("deploySmartAccount error:", e);
            throw new Error(e.message || "Failed to deploy smart account");
        } finally {
            setIsTransactionPending(false);
        }
    }, []);

    // ═══════════════════════════════════════════════════════════════
    //  Context Value
    // ═══════════════════════════════════════════════════════════════

    const value: StellarContextType = {
        publicKey,
        isConnected: !!publicKey,
        isLoading,
        isSyncing,
        isTransactionPending,
        connectionError,
        vaultStatus,
        instanceContractId,
        factoryContractId: FACTORY_CONTRACT_ID,
        connect,
        disconnect,
        ping,
        deposit,
        withdraw,
        setupVault,
        deploySmartAccount,
        getBalance,
        triggerFallback,
        revealPayload,
        updateBeneficiary,
        updateInterval,
        updateGracePeriod,
        resetVault,
        refreshStatus,
    };

    return (
        <StellarContext.Provider value={value}>
            {children}
        </StellarContext.Provider>
    );
}

export function useStellar() {
    const context = useContext(StellarContext);
    if (!context) {
        throw new Error("useStellar must be used within a StellarProvider");
    }
    return context;
}
