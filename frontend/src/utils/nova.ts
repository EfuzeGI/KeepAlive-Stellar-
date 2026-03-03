/**
 * Encrypted payload storage.
 * Nova integration removed — stubs preserved to avoid breaking existing components.
 */

export async function uploadEncryptedData(_encryptedText: string): Promise<string> {
    console.warn("Encrypted payload storage is not configured.");
    throw new Error("Encrypted storage not available");
}

export async function retrieveEncryptedData(payload: string): Promise<string> {
    return payload;
}

export function isNovaConfigured(): boolean {
    return false;
}
