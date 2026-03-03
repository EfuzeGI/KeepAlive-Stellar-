"use client";

import { useState } from "react";
import { useStellar } from "@/contexts/StellarContext";
import {
    Clock,
    Lock,
    Loader2,
    CheckCircle2,
    ArrowRight,
    Shield,
    ChevronRight,
} from "lucide-react";
import { encryptSecret, packE2EPayload } from "@/utils/encryption";
import { uploadEncryptedData } from "@/utils/nova";

/* ── Presets ── */
const PRESETS = {
    interval: [
        { label: "2m", sec: 120 },
        { label: "5m", sec: 300 },
        { label: "1h", sec: 3600 },
        { label: "24h", sec: 86400 },
        { label: "7d", sec: 604800 },
        { label: "30d", sec: 2592000 },
    ],
    grace: [
        { label: "1m", sec: 60 },
        { label: "5m", sec: 300 },
        { label: "1h", sec: 3600 },
        { label: "12h", sec: 43200 },
        { label: "24h", sec: 86400 },
        { label: "48h", sec: 172800 },
    ],
};

function secToLabel(sec: number): string {
    if (sec >= 86400) return `${(sec / 86400).toFixed(sec % 86400 === 0 ? 0 : 1)}d`;
    if (sec >= 3600) return `${(sec / 3600).toFixed(sec % 3600 === 0 ? 0 : 1)}h`;
    return `${Math.round(sec / 60)}m`;
}

const MIN_SEC = 60;
const MAX_SEC = 2592000;

function sliderToSec(val: number): number {
    return Math.round(Math.exp(Math.log(MIN_SEC) + (val / 100) * (Math.log(MAX_SEC) - Math.log(MIN_SEC))));
}
function secToSlider(sec: number): number {
    return ((Math.log(sec) - Math.log(MIN_SEC)) / (Math.log(MAX_SEC) - Math.log(MIN_SEC))) * 100;
}

/* ── Shared style strings ── */
const CSS = `
  @keyframes cv-fadeUp {
    from { opacity:0; transform:translateY(20px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes cv-glowPulse {
    0%,100% { opacity:0.5; }
    50%      { opacity:1; }
  }
  @keyframes cv-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position:  200% center; }
  }
  @keyframes cv-spin { to { transform:rotate(360deg); } }
  @keyframes cv-orb {
    0%,100% { transform:translate(-50%,-50%) scale(1);   opacity:0.5; }
    50%      { transform:translate(-50%,-50%) scale(1.15);opacity:0.7; }
  }

  .cv-fadein { animation: cv-fadeUp 0.6s ease both; }
  .cv-fadein-1 { animation: cv-fadeUp 0.6s ease 0.05s both; opacity:0; }
  .cv-fadein-2 { animation: cv-fadeUp 0.6s ease 0.15s both; opacity:0; }
  .cv-fadein-3 { animation: cv-fadeUp 0.6s ease 0.25s both; opacity:0; }
  .cv-fadein-4 { animation: cv-fadeUp 0.6s ease 0.35s both; opacity:0; }
  .cv-fadein-5 { animation: cv-fadeUp 0.6s ease 0.45s both; opacity:0; }

  .cv-shimmer-text {
    background: linear-gradient(90deg,#67e8f9 0%,#a5f3fc 30%,#fff 50%,#6ee7b7 70%,#67e8f9 100%);
    background-size:200% auto;
    -webkit-background-clip:text;
    -webkit-text-fill-color:transparent;
    background-clip:text;
    animation:cv-shimmer 5s linear infinite;
  }

  .cv-input {
    width:100%;
    background:rgba(255,255,255,0.02);
    border:1px solid rgba(255,255,255,0.07);
    border-radius:10px;
    padding:14px 16px;
    font-size:13px;
    font-family:monospace;
    color:rgba(255,255,255,0.72);
    outline:none;
    transition:border-color 0.25s, box-shadow 0.25s;
    caret-color:#06b6d4;
  }
  .cv-input::placeholder { color:rgba(255,255,255,0.2); }
  .cv-input:focus {
    border-color:rgba(6,182,212,0.4);
    box-shadow:0 0 0 3px rgba(6,182,212,0.07);
  }

  .cv-preset-btn {
    flex:1;
    padding:9px 4px;
    font-size:12px;
    font-family:monospace;
    background:transparent;
    border:none;
    cursor:pointer;
    color:rgba(255,255,255,0.38);
    transition:color 0.2s, background 0.2s;
    border-radius:6px;
  }
  .cv-preset-btn:hover { color:rgba(255,255,255,0.7); background:rgba(255,255,255,0.04); }
  .cv-preset-btn.active-cyan {
    background:rgba(6,182,212,0.12);
    border:1px solid rgba(6,182,212,0.2);
    color:#06b6d4;
    font-weight:600;
  }
  .cv-preset-btn.active-amber {
    background:rgba(251,191,36,0.1);
    border:1px solid rgba(251,191,36,0.2);
    color:#fbbf24;
    font-weight:600;
  }

  .cv-slider {
    -webkit-appearance:none;
    appearance:none;
    width:100%;
    height:3px;
    border-radius:2px;
    cursor:pointer;
    outline:none;
  }
  .cv-slider::-webkit-slider-thumb {
    -webkit-appearance:none;
    width:14px; height:14px;
    border-radius:50%;
    background:rgba(6,182,212,0.9);
    box-shadow:0 0 8px rgba(6,182,212,0.5);
    cursor:pointer;
  }

  .cv-submit-btn {
    width:100%;
    padding:14px;
    border-radius:12px;
    border:none;
    cursor:pointer;
    font-size:14px;
    font-weight:600;
    letter-spacing:0.04em;
    transition:opacity 0.2s, transform 0.2s, box-shadow 0.2s;
    display:flex; align-items:center; justify-content:center; gap:8px;
  }
  .cv-submit-btn.ready {
    background:linear-gradient(90deg,#06b6d4,#10b981);
    color:white;
    box-shadow:0 4px 20px rgba(6,182,212,0.3);
  }
  .cv-submit-btn.ready:hover { opacity:0.9; transform:translateY(-1px); box-shadow:0 8px 30px rgba(6,182,212,0.4); }
  .cv-submit-btn.disabled {
    background:rgba(255,255,255,0.05);
    color:rgba(255,255,255,0.22);
    cursor:not-allowed;
  }
  .cv-orb {
    position:absolute;
    border-radius:50%;
    pointer-events:none;
    animation:cv-orb 8s ease-in-out infinite;
  }
`;

export function CreateVault() {
    const { setupVault, isTransactionPending, vaultStatus } = useStellar();

    const [beneficiary, setBeneficiary] = useState("");
    const [intervalSec, setIntervalSec] = useState(86400);
    const [graceSec, setGraceSec] = useState(86400);
    const [secretPayload, setSecretPayload] = useState("");
    const [useCustomInterval, setUseCustomInterval] = useState(false);
    const [useCustomGrace, setUseCustomGrace] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const navTo = (page: string) =>
        window.dispatchEvent(new CustomEvent("keepalive:navigate", { detail: page }));

    const encryptAndSubmit = async () => {
        if (!beneficiary.trim()) { setError("Beneficiary address is required"); return; }
        if (!beneficiary.trim().startsWith("G") || beneficiary.trim().length !== 56) {
            setError("Invalid Stellar address. Must start with 'G' and be 56 characters."); return;
        }
        setError(null);
        setIsSubmitting(true);
        try {
            let encryptedPayload: string | undefined;
            if (secretPayload.trim()) {
                const { ciphertext, key, iv } = await encryptSecret(secretPayload);
                const novaString = await uploadEncryptedData(ciphertext);
                const cid = novaString.replace("NOVA:", "");
                encryptedPayload = packE2EPayload(cid, key, iv);
            }
            await setupVault(beneficiary.trim(), intervalSec, graceSec, encryptedPayload);
        } catch (err) {
            console.error("Vault setup failed:", err);
            setError(err instanceof Error ? err.message : "Failed to initialize vault");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isReady = beneficiary.trim().length > 0;
    const hasVault = vaultStatus !== null;

    /* ── Already has vault ── */
    if (hasVault && !isSubmitting) {
        return (
            <>
                <style>{CSS}</style>
                <div style={{
                    minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center",
                    background: "#06090e", position: "relative", overflow: "hidden",
                }}>
                    {/* Orb */}
                    <div className="cv-orb" style={{ width: 400, height: 400, top: "50%", left: "50%", background: "radial-gradient(circle, rgba(52,211,153,0.07) 0%, transparent 70%)", animationDelay: "0s" }} />

                    <div className="cv-fadein" style={{ textAlign: "center", padding: "0 24px", position: "relative", zIndex: 1 }}>
                        <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                            <CheckCircle2 size={28} color="rgba(52,211,153,0.8)" />
                        </div>
                        <h2 className="cv-shimmer-text" style={{ fontSize: 28, fontWeight: 200, letterSpacing: "-0.02em", marginBottom: 12 }}>Vault Active</h2>
                        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.32)", lineHeight: 1.7, marginBottom: 32, maxWidth: 380 }}>
                            You already have an active KeepAlive vault. Manage your heartbeat and funds in the dashboard.
                        </p>
                        <button
                            onClick={() => navTo("dashboard")}
                            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 9999, background: "linear-gradient(90deg,#06b6d4,#10b981)", border: "none", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 20px rgba(6,182,212,0.3)", letterSpacing: "0.04em" }}
                        >
                            Open Dashboard <ArrowRight size={14} />
                        </button>
                    </div>
                </div>
            </>
        );
    }

    /* ── Create form ── */
    return (
        <>
            <style>{CSS}</style>
            <div style={{ minHeight: "100vh", background: "#06090e", position: "relative", overflow: "hidden", padding: "80px 24px 60px" }}>
                {/* Background orbs */}
                <div className="cv-orb" style={{ width: 600, height: 600, top: "5%", left: "50%", background: "radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)", animationDuration: "10s" }} />
                <div className="cv-orb" style={{ width: 400, height: 400, top: "70%", left: "20%", background: "radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)", animationDelay: "3s", animationDuration: "12s" }} />

                <div style={{ maxWidth: 680, margin: "0 auto", position: "relative", zIndex: 1 }}>
                    {/* Header */}
                    <div className="cv-fadein-1" style={{ textAlign: "center", marginBottom: 48 }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 14px", borderRadius: 9999, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em", marginBottom: 20 }}>
                            <Shield size={10} color="rgba(52,211,153,0.7)" />
                            Non-Custodial Vault Deployment
                        </span>
                        <h1 style={{ fontSize: "clamp(1.8rem,4vw,2.6rem)", fontWeight: 200, letterSpacing: "-0.02em", lineHeight: 1.1, marginBottom: 14 }}>
                            <span className="cv-shimmer-text">Deploy KeepAlive</span>
                            <br />
                            <span style={{ color: "rgba(255,255,255,0.75)" }}>Contract</span>
                        </h1>
                        <p style={{ fontSize: 14, color: "rgba(255,255,255,0.3)", lineHeight: 1.7, maxWidth: 460, margin: "0 auto" }}>
                            Configure your isolated smart contract with heartbeat and fallback parameters.
                            All encrypted locally before leaving your browser.
                        </p>
                    </div>

                    {/* === Card === */}
                    <div style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", overflow: "hidden" }}>

                        {/* ── SECTION: Backup Address ── */}
                        <div className="cv-fadein-2" style={{ padding: "28px 28px 24px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                                <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(6,182,212,0.1)", border: "1px solid rgba(6,182,212,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ color: "rgba(6,182,212,0.8)", fontSize: 13 }}>G</span>
                                </div>
                                <label style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                                    <span style={{ color: "rgba(6,182,212,0.7)", marginRight: 4 }}>*</span>
                                    Backup / Beneficiary Address
                                </label>
                            </div>
                            <input
                                type="text"
                                value={beneficiary}
                                onChange={e => { setBeneficiary(e.target.value); setError(null); }}
                                placeholder="GABCD...WXYZ  (Stellar public key, 56 chars)"
                                className="cv-input"
                            />
                            <p style={{ marginTop: 8, fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
                                Funds are transferred here when the heartbeat timer expires.
                            </p>
                        </div>

                        {/* ── SECTION: Heartbeat Interval ── */}
                        <div className="cv-fadein-3" style={{ padding: "24px 28px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(6,182,212,0.08)", border: "1px solid rgba(6,182,212,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <Clock size={13} color="rgba(6,182,212,0.7)" />
                                    </div>
                                    <label style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                                        Heartbeat Interval
                                    </label>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 16, fontFamily: "monospace", fontWeight: 600, color: "#06b6d4" }}>
                                        {secToLabel(intervalSec)}
                                    </span>
                                    <button
                                        onClick={() => setUseCustomInterval(!useCustomInterval)}
                                        style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${useCustomInterval ? "rgba(6,182,212,0.25)" : "rgba(255,255,255,0.08)"}`, background: useCustomInterval ? "rgba(6,182,212,0.07)" : "transparent", color: useCustomInterval ? "rgba(6,182,212,0.8)" : "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase" as const }}
                                    >
                                        {useCustomInterval ? "Presets" : "Custom"}
                                    </button>
                                </div>
                            </div>

                            {useCustomInterval ? (
                                <div>
                                    <input type="range" min={0} max={100} step={0.5} value={secToSlider(intervalSec)} onChange={e => setIntervalSec(sliderToSec(Number(e.target.value)))}
                                        className="cv-slider"
                                        style={{ background: `linear-gradient(to right, rgba(6,182,212,0.7) ${secToSlider(intervalSec)}%, rgba(255,255,255,0.1) ${secToSlider(intervalSec)}%)` }}
                                    />
                                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.22)" }}>
                                        <span>1 min</span><span>30 days</span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", gap: 6, padding: "4px", borderRadius: 10, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                    {PRESETS.interval.map((item, i) => (
                                        <button key={i} onClick={() => setIntervalSec(item.sec)}
                                            className={`cv-preset-btn${intervalSec === item.sec ? " active-cyan" : ""}`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── SECTION: Grace Period ── */}
                        <div className="cv-fadein-4" style={{ padding: "24px 28px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <Lock size={13} color="rgba(251,191,36,0.7)" />
                                    </div>
                                    <label style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                                        Grace Period
                                    </label>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                    <span style={{ fontSize: 16, fontFamily: "monospace", fontWeight: 600, color: "#fbbf24" }}>
                                        {secToLabel(graceSec)}
                                    </span>
                                    <button
                                        onClick={() => setUseCustomGrace(!useCustomGrace)}
                                        style={{ padding: "3px 10px", borderRadius: 6, border: `1px solid ${useCustomGrace ? "rgba(251,191,36,0.25)" : "rgba(255,255,255,0.08)"}`, background: useCustomGrace ? "rgba(251,191,36,0.07)" : "transparent", color: useCustomGrace ? "rgba(251,191,36,0.8)" : "rgba(255,255,255,0.3)", fontSize: 10, fontFamily: "monospace", cursor: "pointer", letterSpacing: "0.06em", textTransform: "uppercase" as const }}
                                    >
                                        {useCustomGrace ? "Presets" : "Custom"}
                                    </button>
                                </div>
                            </div>

                            {useCustomGrace ? (
                                <div>
                                    <input type="range" min={0} max={100} step={0.5} value={secToSlider(graceSec)} onChange={e => setGraceSec(sliderToSec(Number(e.target.value)))}
                                        className="cv-slider"
                                        style={{ background: `linear-gradient(to right, rgba(251,191,36,0.7) ${secToSlider(graceSec)}%, rgba(255,255,255,0.1) ${secToSlider(graceSec)}%)` }}
                                    />
                                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, fontFamily: "monospace", color: "rgba(255,255,255,0.22)" }}>
                                        <span>1 min</span><span>30 days</span>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ display: "flex", gap: 6, padding: "4px", borderRadius: 10, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)" }}>
                                    {PRESETS.grace.map((item, i) => (
                                        <button key={i} onClick={() => setGraceSec(item.sec)}
                                            className={`cv-preset-btn${graceSec === item.sec ? " active-amber" : ""}`}
                                        >
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* ── SECTION: Encrypted Payload ── */}
                        <div className="cv-fadein-5" style={{ padding: "24px 28px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <div style={{ width: 28, height: 28, borderRadius: 8, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                        <Lock size={13} color="rgba(167,139,250,0.7)" />
                                    </div>
                                    <label style={{ fontSize: 11, fontFamily: "monospace", color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", textTransform: "uppercase" as const }}>
                                        Encrypted Payload
                                        <span style={{ marginLeft: 8, color: "rgba(255,255,255,0.18)", fontWeight: 400 }}>(optional)</span>
                                    </label>
                                </div>
                                <span style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid rgba(167,139,250,0.2)", background: "rgba(167,139,250,0.05)", fontSize: 9, fontFamily: "monospace", color: "rgba(167,139,250,0.7)", letterSpacing: "0.06em" }}>
                                    AES-256-GCM
                                </span>
                            </div>
                            <textarea
                                value={secretPayload}
                                onChange={e => { setSecretPayload(e.target.value); setError(null); }}
                                rows={3}
                                placeholder="Enter seed phrases, private notes, or recovery coordinates here. Encrypted locally before it ever leaves your browser."
                                className="cv-input"
                                style={{ resize: "none" as const, lineHeight: 1.6 }}
                            />
                        </div>

                        {/* ── SECTION: Summary + Submit ── */}
                        <div style={{ padding: "24px 28px" }}>
                            {/* Config summary row */}
                            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" as const }}>
                                {[
                                    { label: "Heartbeat", val: secToLabel(intervalSec), color: "#06b6d4" },
                                    { label: "Grace", val: secToLabel(graceSec), color: "#fbbf24" },
                                    { label: "Payload", val: secretPayload.trim() ? "Encrypted" : "None", color: secretPayload.trim() ? "rgba(167,139,250,0.8)" : "rgba(255,255,255,0.22)" },
                                ].map((item) => (
                                    <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 8, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                                        <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", fontFamily: "monospace", letterSpacing: "0.06em", textTransform: "uppercase" as const }}>{item.label}</span>
                                        <ChevronRight size={10} color="rgba(255,255,255,0.15)" />
                                        <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 600, color: item.color }}>{item.val}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={encryptAndSubmit}
                                disabled={!isReady || isTransactionPending || isSubmitting}
                                className={`cv-submit-btn ${isReady && !isTransactionPending && !isSubmitting ? "ready" : "disabled"}`}
                            >
                                {isTransactionPending || isSubmitting ? (
                                    <>
                                        <Loader2 size={16} style={{ animation: "cv-spin 1s linear infinite" }} />
                                        {isSubmitting ? "Encrypting & Uploading..." : "Signing Transaction..."}
                                    </>
                                ) : (
                                    <>
                                        Initialize Vault
                                        <ArrowRight size={15} />
                                    </>
                                )}
                            </button>

                            {error && (
                                <p style={{ marginTop: 12, fontSize: 11, fontFamily: "monospace", color: "rgba(248,113,113,0.8)", textAlign: "center" as const }}>
                                    ⚠ {error}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Security footnote */}
                    <div style={{ marginTop: 24, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <Shield size={12} color="rgba(255,255,255,0.2)" />
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", fontFamily: "monospace" }}>
                            Non-custodial · Your keys never leave the browser · Powered by Soroban
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}
