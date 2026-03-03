/**
 * Stellar / Soroban Configuration
 *
 * CONFIGURED FOR TESTNET — switch to mainnet before production.
 */

// ═══════════════════════════════════════════════════════════════════
//  Network Configuration
// ═══════════════════════════════════════════════════════════════════

export const NETWORK = "testnet" as const;
export const NETWORK_PASSPHRASE = "Test SDF Network ; September 2015";
// For mainnet: "Public Global Stellar Network ; September 2015"

export const SOROBAN_RPC_URL = "https://soroban-testnet.stellar.org";
// For mainnet: "https://soroban.stellar.org" or a dedicated provider

export const HORIZON_URL = "https://horizon-testnet.stellar.org";
// For mainnet: "https://horizon.stellar.org"

export const EXPLORER_URL = "https://stellar.expert/explorer/testnet";
// For mainnet: "https://stellar.expert/explorer/public"

// ═══════════════════════════════════════════════════════════════════
//  Contract IDs (deployed on testnet)
// ═══════════════════════════════════════════════════════════════════

// KeepAlive Factory contract deployed on testnet (2026-02-26)
export const FACTORY_CONTRACT_ID = "CDZ7TXU2GRFICPM4CWSQEVZBODJHDWWXKBSZWXOONMMLAZTT226PFCBN";

// Smart Account WASM Hash (deployed on testnet)
export const SMART_ACCOUNT_WASM_HASH = "a2d5347b726d089541e7e293d03f47e7da0ac61bc1edc25f0e344a4de8fb4b3e";

// XLM Stellar Asset Contract (SAC) address on testnet
// This is the native XLM wrapper for Soroban token operations.
// Derive after deploying: `stellar contract id asset --asset native --network testnet`
export const XLM_SAC_ID = "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC";

// ═══════════════════════════════════════════════════════════════════
//  Time Constants (in seconds — Soroban uses seconds not ms)
// ═══════════════════════════════════════════════════════════════════

export const TIME_CONSTANTS = {
    MINUTE: 60,
    HOUR: 60 * 60,
    DAY: 24 * 60 * 60,
    WEEK: 7 * 24 * 60 * 60,
    MONTH: 30 * 24 * 60 * 60,
};

// Default heartbeat interval (30 days in seconds)
export const DEFAULT_HEARTBEAT_INTERVAL = TIME_CONSTANTS.MONTH;

// Default grace period (24 hours in seconds)
export const DEFAULT_GRACE_PERIOD = TIME_CONSTANTS.DAY;

// ═══════════════════════════════════════════════════════════════════
//  XLM Denomination Helpers
// ═══════════════════════════════════════════════════════════════════

// 1 XLM = 10^7 stroops
export const STROOPS_PER_XLM = 10_000_000;

/** Convert stroops (i128 as string) to human-readable XLM string */
export function stroopsToXlm(stroops: string | number | bigint): string {
    const val = typeof stroops === "bigint" ? stroops : BigInt(stroops);
    const whole = val / BigInt(STROOPS_PER_XLM);
    const frac = val % BigInt(STROOPS_PER_XLM);
    const fracStr = frac.toString().padStart(7, "0").replace(/0+$/, "");
    return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

/** Convert XLM (float string) to stroops as bigint */
export function xlmToStroops(xlm: string | number): bigint {
    const val = typeof xlm === "number" ? xlm : parseFloat(xlm);
    return BigInt(Math.round(val * STROOPS_PER_XLM));
}

/** Format XLM with symbol */
export function formatXlm(stroops: string | number | bigint): string {
    return `${stroopsToXlm(stroops)} XLM`;
}

// ═══════════════════════════════════════════════════════════════════
//  Address Validation
// ═══════════════════════════════════════════════════════════════════

/** Validate a Stellar G... public key format */
export function isValidStellarAddress(address: string): boolean {
    // Stellar public keys: G + 55 base32 characters = 56 total
    return /^G[A-Z2-7]{55}$/.test(address);
}

/** Validate a Soroban contract C... address */
export function isValidContractAddress(address: string): boolean {
    // Soroban contracts: C + 55 base32 characters = 56 total
    return /^C[A-Z2-7]{55}$/.test(address);
}

/** Truncate address for display: GABC...WXYZ */
export function truncateAddress(address: string, chars: number = 4): string {
    if (address.length <= chars * 2 + 3) return address;
    return `${address.slice(0, chars + 1)}...${address.slice(-chars)}`;
}

// ═══════════════════════════════════════════════════════════════════
//  Soroban RPC Endpoints (fallback list)
// ═══════════════════════════════════════════════════════════════════

export const RPC_ENDPOINTS = [
    SOROBAN_RPC_URL,
    // Add additional Soroban RPC providers here for fallback
];
