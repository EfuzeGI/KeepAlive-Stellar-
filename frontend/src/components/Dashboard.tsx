"use client";

import { useState, useEffect, useRef } from "react";
import { useStellar } from "@/contexts/StellarContext";
import { stroopsToXlm } from "@/config/stellar";
import {
    Activity, ChevronRight, Copy, Eye, Clock, Shield, AlertCircle,
    ShieldAlert, ExternalLink, RefreshCw, Loader2, Trash2, Users,
    Check, Settings, AlertTriangle,
} from "lucide-react";
import { decryptSecret, unpackE2ELocalPayload, unpackE2EPayload } from "@/utils/encryption";
import { retrieveEncryptedData } from "@/utils/nova";

export function Dashboard() {
    const {
        publicKey,
        vaultStatus,
        instanceContractId,
        ping,
        deposit,
        withdraw,
        revealPayload,
        resetVault,
        triggerFallback,
        updateBeneficiary,
        updateInterval,
        updateGracePeriod,
        isTransactionPending,
        refreshStatus,
        isSyncing,
    } = useStellar();

    const [hours, setHours] = useState("00");
    const [minutes, setMinutes] = useState("00");
    const [seconds, setSeconds] = useState("00");
    const [progress, setProgress] = useState(100);
    const [depositAmount, setDepositAmount] = useState("");
    const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
    const [showSecret, setShowSecret] = useState(false);
    const [secretLoading, setSecretLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [contractCopied, setContractCopied] = useState(false);
    const [revealError, setRevealError] = useState<string | null>(null);
    const [isResetting, setIsResetting] = useState(false);

    // Settings state
    const [showSettings, setShowSettings] = useState(false);
    const [newInterval, setNewInterval] = useState("");
    const [newGrace, setNewGrace] = useState("");
    const [newBackup, setNewBackup] = useState("");

    const hasRefreshedRef = useRef(false);
    const zeroPollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        hasRefreshedRef.current = false;
        if (zeroPollIntervalRef.current) {
            clearInterval(zeroPollIntervalRef.current);
            zeroPollIntervalRef.current = null;
        }
    }, [vaultStatus]);

    // Timer countdown
    useEffect(() => {
        if (!vaultStatus) return;
        const startTime = Date.now();
        const useGracePeriod = vaultStatus.is_warning_active;
        const initialRemaining = useGracePeriod
            ? Number(vaultStatus.warning_grace_remaining_sec) * 1000
            : Number(vaultStatus.time_remaining_sec) * 1000;
        const total = useGracePeriod
            ? Number(vaultStatus.grace_period_sec) * 1000
            : Number(vaultStatus.interval_sec) * 1000;

        const tick = () => {
            const elapsed = Date.now() - startTime;
            const ms = Math.max(0, initialRemaining - elapsed);
            setHours(String(Math.floor(ms / 3600000)).padStart(2, "0"));
            setMinutes(String(Math.floor((ms % 3600000) / 60000)).padStart(2, "0"));
            setSeconds(String(Math.floor((ms % 60000) / 1000)).padStart(2, "0"));
            setProgress(total > 0 ? Math.min(100, ((total - ms) / total) * 100) : 0);

            const isTimerRunning = !vaultStatus.is_expired && !vaultStatus.is_yielding && !vaultStatus.is_emergency && !vaultStatus.is_completed;
            if (ms <= 0 && isTimerRunning && !hasRefreshedRef.current && !isSyncing) {
                hasRefreshedRef.current = true;
                refreshStatus();
                let attempts = 0;
                zeroPollIntervalRef.current = setInterval(() => {
                    attempts++;
                    refreshStatus(true);
                    if (attempts >= 5 && zeroPollIntervalRef.current) clearInterval(zeroPollIntervalRef.current);
                }, 2000);
            }
        };

        tick();
        const interval = setInterval(tick, 1000);
        return () => {
            clearInterval(interval);
            if (zeroPollIntervalRef.current) clearInterval(zeroPollIntervalRef.current);
        };
    }, [vaultStatus, refreshStatus, isSyncing]);

    const formatXlm = (stroops: string) => {
        const n = parseFloat(stroopsToXlm(stroops));
        return n.toFixed(n < 0.01 ? 4 : 2);
    };

    const formatDuration = (sec: number | bigint) => {
        const numSec = Number(sec);
        if (numSec >= 86400) return `${Math.round(numSec / 86400)}d`;
        if (numSec >= 3600) return `${Math.round(numSec / 3600)}h`;
        return `${Math.round(numSec / 60)}m`;
    };

    const truncateAddress = (addr: string) =>
        addr.length > 12 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : addr;

    const handleCopyContract = () => {
        if (instanceContractId) {
            navigator.clipboard.writeText(instanceContractId);
            setContractCopied(true);
            setTimeout(() => setContractCopied(false), 2000);
        }
    };

    const handleReveal = async () => {
        setSecretLoading(true);
        setRevealError(null);
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Wallet interaction timed out.")), 120000)
            );
            const payload = await Promise.race([revealPayload(), timeoutPromise]) as string | null;
            if (payload) {
                const cleanPayload = payload.trim().replace(/^"|"$/g, '');
                let decryptedResult = cleanPayload;
                let decryptError = "";

                const localPack = unpackE2ELocalPayload(cleanPayload);
                if (localPack) {
                    try {
                        decryptedResult = await decryptSecret(localPack.ciphertext, localPack.key, localPack.iv);
                    } catch (e) {
                        decryptError = "Local decryption error.";
                    }
                } else {
                    const novaPack = unpackE2EPayload(cleanPayload);
                    if (novaPack) {
                        try {
                            const ciphertext = await retrieveEncryptedData(`NOVA:${novaPack.cid}`);
                            decryptedResult = await decryptSecret(ciphertext, novaPack.key, novaPack.iv);
                        } catch (e) {
                            decryptError = e instanceof Error ? e.message : "Nova retrieval failed.";
                        }
                    }
                }

                setRevealedSecret(decryptedResult);
                if (decryptError) setRevealError(decryptError);
                setShowSecret(true);
                if (publicKey) {
                    sessionStorage.setItem(`revealed_${publicKey}`, JSON.stringify({ secret: decryptedResult, error: decryptError }));
                }
            } else {
                throw new Error("Unable to decrypt payload. You may not be authorized.");
            }
        } catch (err) {
            setRevealError(err instanceof Error ? err.message : "Failed to reveal payload");
        } finally {
            setSecretLoading(false);
        }
    };

    useEffect(() => {
        if (publicKey && typeof window !== "undefined") {
            const cached = sessionStorage.getItem(`revealed_${publicKey}`);
            if (cached) {
                try {
                    const { secret, error } = JSON.parse(cached);
                    setRevealedSecret(secret);
                    if (error) setRevealError(error);
                    setShowSecret(true);
                } catch { /* ignore */ }
            }
        }
    }, [publicKey]);

    const handleCopy = () => {
        if (revealedSecret) {
            navigator.clipboard.writeText(revealedSecret);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const handleDeposit = async () => {
        if (!depositAmount) return;
        try {
            await deposit(depositAmount);
            setDepositAmount("");
        } catch (e) {
            console.error("Deposit failed", e);
        }
    };

    const handleReset = async () => {
        if (!confirm("Are you sure? This will delete your vault and return funds.")) return;
        setIsResetting(true);
        try { await resetVault(); } catch (e) {
            console.error("Reset failed:", e);
            alert("Failed to reset vault.");
        } finally { setIsResetting(false); }
    };

    const handleUpdateInterval = async () => {
        const sec = parseInt(newInterval);
        if (!sec || sec <= 0) return;
        try {
            await updateInterval(sec);
            setNewInterval("");
        } catch (e) { console.error("Update interval failed:", e); }
    };

    const handleUpdateGrace = async () => {
        const sec = parseInt(newGrace);
        if (!sec || sec <= 0) return;
        try {
            await updateGracePeriod(sec);
            setNewGrace("");
        } catch (e) { console.error("Update grace period failed:", e); }
    };

    const handleUpdateBackup = async () => {
        if (!newBackup || newBackup.length !== 56 || !newBackup.startsWith("G")) return;
        try {
            await updateBeneficiary(newBackup);
            setNewBackup("");
        } catch (e) { console.error("Update backup failed:", e); }
    };

    const handleTriggerFallback = async () => {
        if (!confirm("Execute fallback? This will transfer all vault funds and reveal payload.")) return;
        try {
            await triggerFallback(true);
        } catch (e) {
            console.error("Trigger fallback failed:", e);
            alert("Failed to trigger fallback.");
        }
    };

    if (!vaultStatus) return null;

    const isOwner = publicKey && vaultStatus.owner === publicKey;
    const isBackup = publicKey && vaultStatus.backup === publicKey;
    const canTriggerFallback = isBackup && (vaultStatus.is_expired || vaultStatus.is_yielding || vaultStatus.is_emergency);

    const switchStatus = vaultStatus.is_completed
        ? "COMPLETED"
        : vaultStatus.is_emergency
            ? "EMERGENCY"
            : vaultStatus.is_yielding
                ? "YIELDING"
                : vaultStatus.is_warning_active
                    ? "WARNING"
                    : vaultStatus.is_expired
                        ? "EXPIRED"
                        : "ACTIVE";

    const statusColor = switchStatus === "ACTIVE" ? "var(--accent)" : switchStatus === "WARNING" ? "var(--warn)" : "var(--danger)";

    return (
        <div className="max-w-[1200px] mx-auto px-8 py-8">

            {/* ═══ CONTRACT ID BANNER ═══ */}
            {instanceContractId && (
                <div className="mb-6 border border-[var(--border)] bg-[var(--surface)] p-5 animate-reveal">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-mono text-[var(--text-dim)] tracking-widest uppercase mb-1">YOUR CONTRACT INSTANCE</p>
                            <p className="text-[20px] font-mono font-bold text-[var(--text)] tracking-tight">
                                {instanceContractId}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleCopyContract}
                                className="flex items-center gap-1.5 px-3 py-2 border border-[var(--border)] hover:border-[var(--border-hover)] text-[11px] font-mono text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
                            >
                                {contractCopied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                {contractCopied ? "Copied" : "Copy"}
                            </button>
                            <a
                                href={`https://stellar.expert/explorer/testnet/contract/${instanceContractId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-2 border border-[var(--border)] hover:border-[var(--border-hover)] text-[11px] font-mono text-[var(--text-dim)] hover:text-[var(--text)] transition-colors"
                            >
                                <ExternalLink className="w-3 h-3" />
                                Explorer
                            </a>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ EMERGENCY ACCESS (for backup addresses) ═══ */}
            {canTriggerFallback && (
                <div className="mb-6 border-2 border-red-500/50 bg-red-500/5 p-6 animate-reveal">
                    <div className="flex items-start gap-4">
                        <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                            <h3 className="text-[18px] font-bold text-red-400 mb-1">Emergency Access Available</h3>
                            <p className="text-[14px] text-red-300/70 mb-4">
                                The vault owner has been inactive and the contract has entered {switchStatus} state.
                                You are the designated backup address and can execute the fallback procedure.
                            </p>
                            <button
                                onClick={handleTriggerFallback}
                                disabled={isTransactionPending}
                                className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white text-[14px] font-bold transition-colors disabled:opacity-50"
                            >
                                {isTransactionPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
                                ) : (
                                    <ShieldAlert className="w-4 h-4 inline mr-2" />
                                )}
                                Execute Fallback & Reveal Payload
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Status Bar */}
            <div className="flex items-center justify-between mb-6 animate-reveal">
                <div className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ backgroundColor: statusColor }} />
                    <span className="text-[13px] font-mono text-[var(--text-muted)] tracking-widest uppercase">
                        Status: <span style={{ color: statusColor }}>{switchStatus}</span>
                    </span>
                    {isOwner && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 border border-[var(--accent)]/20 bg-[var(--accent-dim)] rounded-full ml-4">
                            <Shield className="w-2.5 h-2.5 text-[var(--accent)]" />
                            <span className="text-[9px] font-mono text-[var(--accent)] font-bold tracking-tight uppercase">Owner</span>
                        </div>
                    )}
                    {isBackup && !isOwner && (
                        <div className="flex items-center gap-1.5 px-2 py-0.5 border border-amber-500/20 bg-amber-500/5 rounded-full ml-4">
                            <Users className="w-2.5 h-2.5 text-amber-400" />
                            <span className="text-[9px] font-mono text-amber-400 font-bold tracking-tight uppercase">Backup</span>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => refreshStatus()}
                        disabled={isTransactionPending || isSyncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-[var(--text-dim)] hover:text-[var(--text-muted)] border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors disabled:opacity-30"
                    >
                        <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                        {isSyncing ? "Syncing..." : "Refresh"}
                    </button>
                    {isOwner && (
                        <>
                            <button
                                onClick={() => setShowSettings(!showSettings)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono border transition-colors ${showSettings
                                    ? "text-[var(--text)] border-[var(--border-hover)]"
                                    : "text-[var(--text-dim)] hover:text-[var(--text-muted)] border-[var(--border)] hover:border-[var(--border-hover)]"}`}
                            >
                                <Settings className="w-3 h-3" />
                                Settings
                            </button>
                            <button
                                onClick={handleReset}
                                disabled={isTransactionPending || isResetting}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-mono text-red-400/60 hover:text-red-400 border border-red-900/30 hover:border-red-800/50 transition-colors disabled:opacity-30"
                            >
                                {isResetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                {isResetting ? "Resetting..." : "Reset"}
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* ═══ SETTINGS PANEL (collapsible) ═══ */}
            {showSettings && isOwner && (
                <div className="mb-6 border border-[var(--border)] bg-[var(--surface)] p-6 animate-reveal">
                    <h3 className="text-[14px] font-semibold text-[var(--text)] mb-4 flex items-center gap-2">
                        <Settings className="w-4 h-4" /> Vault Settings
                    </h3>
                    <div className="grid md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[11px] font-mono text-[var(--text-dim)] tracking-wider uppercase mb-1.5 block">Heartbeat Interval (sec)</label>
                            <div className="flex gap-2">
                                <input
                                    type="number" value={newInterval} onChange={e => setNewInterval(e.target.value)}
                                    placeholder={String(vaultStatus.interval_sec)}
                                    className="flex-1 bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-[12px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-hover)] min-w-0"
                                />
                                <button onClick={handleUpdateInterval} disabled={isTransactionPending || !newInterval}
                                    className="px-3 py-2 bg-[var(--text)] text-black text-[11px] font-semibold hover:opacity-90 disabled:opacity-30">
                                    Set
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-mono text-[var(--text-dim)] tracking-wider uppercase mb-1.5 block">Grace Period (sec)</label>
                            <div className="flex gap-2">
                                <input
                                    type="number" value={newGrace} onChange={e => setNewGrace(e.target.value)}
                                    placeholder={String(vaultStatus.grace_period_sec)}
                                    className="flex-1 bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-[12px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-hover)] min-w-0"
                                />
                                <button onClick={handleUpdateGrace} disabled={isTransactionPending || !newGrace}
                                    className="px-3 py-2 bg-[var(--text)] text-black text-[11px] font-semibold hover:opacity-90 disabled:opacity-30">
                                    Set
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-[11px] font-mono text-[var(--text-dim)] tracking-wider uppercase mb-1.5 block">Backup Address</label>
                            <div className="flex gap-2">
                                <input
                                    type="text" value={newBackup} onChange={e => setNewBackup(e.target.value)}
                                    placeholder={truncateAddress(vaultStatus.backup)}
                                    className="flex-1 bg-[var(--bg)] border border-[var(--border)] px-3 py-2 text-[12px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-hover)] min-w-0"
                                />
                                <button onClick={handleUpdateBackup} disabled={isTransactionPending || newBackup.length !== 56}
                                    className="px-3 py-2 bg-[var(--text)] text-black text-[11px] font-semibold hover:opacity-90 disabled:opacity-30">
                                    Set
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid lg:grid-cols-[1fr_380px] gap-5">
                {/* Left: Timer Block */}
                <div className="border border-[var(--border)] bg-[var(--surface)] p-10 animate-reveal delay-1">
                    <div className="flex items-baseline justify-center gap-2 mb-8">
                        <div className="text-center">
                            <span className="text-[80px] font-bold tracking-tight leading-none font-mono text-[var(--text)] animate-ticker">{hours}</span>
                            <p className="text-[11px] font-mono text-[var(--text-dim)] mt-2 tracking-widest uppercase">Hours</p>
                        </div>
                        <span className="text-[48px] font-light text-[var(--text-dim)] mx-2">:</span>
                        <div className="text-center">
                            <span className="text-[80px] font-bold tracking-tight leading-none font-mono text-[var(--text)]">{minutes}</span>
                            <p className="text-[11px] font-mono text-[var(--text-dim)] mt-2 tracking-widest uppercase">Minutes</p>
                        </div>
                        <span className="text-[48px] font-light text-[var(--text-dim)] mx-2">:</span>
                        <div className="text-center">
                            <span className="text-[80px] font-bold tracking-tight leading-none font-mono text-[var(--text)]">{seconds}</span>
                            <p className="text-[11px] font-mono text-[var(--text-dim)] mt-2 tracking-widest uppercase">Seconds</p>
                        </div>
                    </div>

                    {/* Progress */}
                    <div className="relative h-[3px] bg-[var(--border)] rounded-full mb-2">
                        <div className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000"
                            style={{ width: `${progress}%`, backgroundColor: statusColor }} />
                    </div>
                    <div className="flex justify-between text-[11px] font-mono text-[var(--text-dim)]">
                        <span>TRIGGER</span>
                        <span>RESET</span>
                    </div>

                    {/* Ping */}
                    {isOwner && (
                        <button
                            onClick={ping}
                            disabled={isTransactionPending}
                            className="mt-10 w-full flex items-center justify-between px-6 py-5 border border-[var(--border)] hover:border-[var(--accent)]/30 transition-all group bg-[var(--bg)]"
                        >
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 border border-[var(--border)] group-hover:border-[var(--accent)]/30 flex items-center justify-center transition-colors">
                                    <Activity className="w-5 h-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] transition-colors" />
                                </div>
                                <div className="text-left">
                                    <p className="text-[15px] font-semibold text-[var(--text)]">Ping</p>
                                    <p className="text-[13px] text-[var(--text-dim)]">Send a heartbeat to reset countdown.</p>
                                </div>
                            </div>
                            {isTransactionPending ? (
                                <Loader2 className="w-4 h-4 text-[var(--text-dim)] animate-spin" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-[var(--text-dim)] group-hover:text-[var(--text)] transition-colors" />
                            )}
                        </button>
                    )}
                </div>

                {/* Right Column */}
                <div className="flex flex-col gap-5">
                    {/* Vault Balance */}
                    <div className="border border-[var(--border)] bg-[var(--surface)] p-6 animate-reveal delay-2">
                        <p className="text-[11px] font-mono text-[var(--text-dim)] tracking-widest uppercase mb-3">Vault Balance</p>
                        <p className="text-[36px] font-bold text-[var(--text)] tracking-tight">
                            {formatXlm(vaultStatus.vault_balance)}
                            <span className="text-[16px] font-normal text-[var(--text-muted)] ml-2">XLM</span>
                        </p>
                        {isOwner && (
                            <>
                                <div className="flex gap-2 mt-5">
                                    <input
                                        type="text" value={depositAmount} onChange={e => setDepositAmount(e.target.value)}
                                        placeholder="0.0"
                                        className="flex-1 bg-[var(--bg)] border border-[var(--border)] px-4 py-2.5 text-[13px] font-mono text-[var(--text)] placeholder:text-[var(--text-dim)] focus:outline-none focus:border-[var(--border-hover)] min-w-0"
                                    />
                                    <button onClick={handleDeposit} disabled={isTransactionPending || !depositAmount}
                                        className="px-5 py-2.5 bg-[var(--text)] text-black text-[13px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-30">
                                        Deposit
                                    </button>
                                </div>
                                <button onClick={() => withdraw()} disabled={isTransactionPending}
                                    className="w-full mt-3 px-4 py-2.5 border border-[var(--border)] text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-colors disabled:opacity-30">
                                    Withdraw All
                                </button>
                            </>
                        )}
                    </div>

                    {/* Details */}
                    <div className="border border-[var(--border)] bg-[var(--surface)] animate-reveal delay-3">
                        {[
                            { icon: Clock, label: "Heartbeat Interval", value: formatDuration(vaultStatus.interval_sec), color: "var(--text)" },
                            { icon: Shield, label: "Grace Period", value: formatDuration(vaultStatus.grace_period_sec), color: "var(--amber)" },
                            { icon: Users, label: "Backup Address", value: truncateAddress(vaultStatus.backup), color: "var(--text)" },
                        ].map((item, i) => (
                            <div key={i} className={`flex items-center justify-between px-6 py-4 ${i > 0 ? "border-t border-[var(--border)]" : ""}`}>
                                <div className="flex items-center gap-3">
                                    <item.icon className="w-4 h-4 text-[var(--text-dim)]" />
                                    <span className="text-[14px] text-[var(--text-muted)]">{item.label}</span>
                                </div>
                                <span className="text-[14px] font-mono font-medium" style={{ color: item.color }}>{item.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Secret Payload */}
                    <div className="border border-[var(--border)] bg-[var(--surface)] p-6 animate-reveal delay-4">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-[14px] font-semibold text-[var(--text)]">Encrypted Payload</p>
                            {showSecret && revealedSecret && (
                                <button onClick={handleCopy} className="flex items-center gap-1 text-[11px] font-mono text-[var(--text-dim)] hover:text-[var(--text)] transition-colors">
                                    <Copy className="w-3 h-3" />
                                    {copied ? "Copied" : "Copy"}
                                </button>
                            )}
                        </div>
                        {showSecret && revealedSecret ? (
                            <div className="bg-[var(--bg)] border border-[var(--border)] p-4 text-[12px] font-mono text-[var(--text-muted)] break-all leading-relaxed">
                                {revealedSecret}
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                <button onClick={handleReveal} disabled={secretLoading}
                                    className="w-full flex items-center justify-center gap-2 py-3 border border-[var(--border)] text-[13px] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-hover)] transition-colors disabled:opacity-50">
                                    {secretLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Eye className="w-3.5 h-3.5" /> Reveal</>}
                                </button>
                                {revealError && <p className="text-[10px] text-red-500 font-mono text-center">{revealError}</p>}
                            </div>
                        )}
                    </div>

                    {/* Explorer */}
                    <a
                        href={`https://stellar.expert/explorer/testnet/account/${publicKey}`}
                        target="_blank" rel="noopener noreferrer"
                        className="border border-[var(--border)] bg-[var(--surface)] p-5 flex items-center justify-between group hover:border-[var(--border-hover)] transition-colors animate-reveal delay-5"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-[16px]">🔭</span>
                            <div>
                                <p className="text-[13px] font-medium text-[var(--text)]">Stellar Explorer</p>
                                <p className="text-[11px] text-[var(--text-dim)]">View your account on Stellar Expert</p>
                            </div>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-[var(--text-dim)] group-hover:text-[var(--text-muted)] transition-colors" />
                    </a>
                </div>
            </div>
        </div>
    );
}
