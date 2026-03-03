"use client";

import { useStellar } from "@/contexts/StellarContext";
import { ArrowRight, Shield, BarChart3, Layers, Globe, Lock } from "lucide-react";

/* ─── Global CSS Animations ─── */
const STYLES = `
  @keyframes slowFloat {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%       { transform: translateY(-22px) rotate(3deg); }
  }
  @keyframes pulse-ring {
    0%   { transform: scale(0.85); opacity: 0.6; }
    70%  { transform: scale(1.15); opacity: 0; }
    100% { transform: scale(0.85); opacity: 0; }
  }
  @keyframes shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes orbit {
    from { transform: rotate(0deg) translateX(110px) rotate(0deg); }
    to   { transform: rotate(360deg) translateX(110px) rotate(-360deg); }
  }
  @keyframes orbit2 {
    from { transform: rotate(120deg) translateX(80px) rotate(-120deg); }
    to   { transform: rotate(480deg) translateX(80px) rotate(-480deg); }
  }
  @keyframes orbit3 {
    from { transform: rotate(240deg) translateX(140px) rotate(-240deg); }
    to   { transform: rotate(600deg) translateX(140px) rotate(-600deg); }
  }
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(28px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes scanLine {
    0%   { top: 0%; }
    100% { top: 100%; }
  }
  @keyframes barGrow {
    from { height: 0%; }
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0; }
  }
  @keyframes glowPulse {
    0%, 100% { opacity: 0.4; }
    50%       { opacity: 0.9; }
  }
  @keyframes moveLeft {
    from { transform: translateX(0); }
    to   { transform: translateX(-50%); }
  }

  .anim-float  { animation: slowFloat 7s ease-in-out infinite; }
  .anim-float2 { animation: slowFloat 9s ease-in-out infinite 1.5s; }
  .anim-float3 { animation: slowFloat 11s ease-in-out infinite 3s; }
  
  .anim-fadein-1 { animation: fadeInUp 0.7s ease both 0.1s; opacity: 0; }
  .anim-fadein-2 { animation: fadeInUp 0.7s ease both 0.3s; opacity: 0; }
  .anim-fadein-3 { animation: fadeInUp 0.7s ease both 0.5s; opacity: 0; }
  .anim-fadein-4 { animation: fadeInUp 0.7s ease both 0.7s; opacity: 0; }

  .shimmer-text {
    background: linear-gradient(90deg, #67e8f9 0%, #a5f3fc 30%, #fff 50%, #6ee7b7 70%, #67e8f9 100%);
    background-size: 200% auto;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: shimmer 4s linear infinite;
  }

  .glow-btn {
    position: relative;
    display: inline-flex;
    border-radius: 9999px;
    transition: transform 0.2s ease;
  }
  .glow-btn:hover { transform: translateY(-1px) scale(1.015); }
  .glow-btn::after {
    content: '';
    position: absolute;
    inset: -3px;
    border-radius: 9999px;
    background: linear-gradient(90deg, #06b6d4, #10b981, #06b6d4);
    background-size: 200%;
    animation: shimmer 3s linear infinite;
    filter: blur(8px);
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: -1;
  }
  .glow-btn:hover::after { opacity: 0.7; }

  .card-hover {
    transition: transform 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
  }
  .card-hover:hover {
    transform: translateY(-4px);
    border-color: rgba(255,255,255,0.1);
    box-shadow: 0 20px 40px rgba(0,0,0,0.4);
  }

  .ticker-track {
    display: flex;
    gap: 16px;
    animation: moveLeft 18s linear infinite;
    width: max-content;
  }
`;

/* ─── Animated Orb (floating blob) ─── */
function Orb({ size, color, style }: { size: number; color: string; style?: React.CSSProperties }) {
    return (
        <div
            style={{
                position: "absolute",
                width: size,
                height: size,
                borderRadius: "50%",
                background: color,
                filter: `blur(${size * 0.55}px)`,
                pointerEvents: "none",
                ...style,
            }}
        />
    );
}

/* ─── Animated SVG chart ─── */
function AnimatedChart() {
    const bars = [25, 40, 30, 55, 48, 62, 38, 72, 50, 65, 42, 78, 55, 68, 80, 60, 45, 70, 85, 62];
    return (
        <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 52, padding: "0 0 0 0" }}>
            {bars.map((h, i) => (
                <div
                    key={i}
                    style={{
                        flex: 1,
                        borderRadius: "2px 2px 0 0",
                        background: i >= 16
                            ? "linear-gradient(180deg, rgba(6,182,212,0.7) 0%, rgba(16,185,129,0.4) 100%)"
                            : "rgba(255,255,255,0.1)",
                        height: `${h}%`,
                        animation: `barGrow 0.8s ease ${i * 0.04}s both`,
                    }}
                />
            ))}
        </div>
    );
}

/* ─── Orbiting dot diagram ─── */
function OrbitDiagram() {
    return (
        <div style={{ position: "relative", width: 120, height: 120, margin: "0 auto" }}>
            {/* Center */}
            <div style={{
                position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
                width: 32, height: 32, borderRadius: "50%",
                background: "linear-gradient(135deg, #06b6d4, #10b981)",
                boxShadow: "0 0 20px rgba(6,182,212,0.5)",
                display: "flex", alignItems: "center", justifyContent: "center",
            }}>
                <Lock size={14} color="white" />
            </div>
            {/* Orbit rings */}
            {[{ r: 48, opacity: 0.15 }, { r: 70, opacity: 0.08 }].map((ring, i) => (
                <div key={i} style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: `translate(-50%,-50%)`,
                    width: ring.r * 2, height: ring.r * 2,
                    borderRadius: "50%", border: `1px solid rgba(255,255,255,${ring.opacity})`,
                }} />
            ))}
            {/* Orbiting dots */}
            {[
                { anim: "orbit 4s linear infinite", bg: "#06b6d4" },
                { anim: "orbit2 6s linear infinite", bg: "#10b981" },
                { anim: "orbit3 5s linear infinite", bg: "#a78bfa" },
            ].map((dot, i) => (
                <div key={i} style={{
                    position: "absolute", top: "50%", left: "50%",
                    width: 8, height: 8, marginTop: -4, marginLeft: -4,
                    borderRadius: "50%",
                    background: dot.bg,
                    boxShadow: `0 0 8px ${dot.bg}`,
                    animation: dot.anim,
                }} />
            ))}
        </div>
    );
}

export function HeroSection() {
    const { connect, isConnected } = useStellar();
    const navTo = (page: string) =>
        window.dispatchEvent(new CustomEvent("keepalive:navigate", { detail: page }));

    return (
        <>
            <style>{STYLES}</style>

            <div style={{ display: "flex", flexDirection: "column", background: "#06090e", color: "rgba(255,255,255,0.85)", fontFamily: "'Inter', system-ui, sans-serif" }}>

                {/* ══════════════════════════════
                    HERO
                ══════════════════════════════ */}
                <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {/* Background orbs */}
                    <Orb size={700} color="radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)" style={{ top: "-20%", left: "50%", transform: "translateX(-50%)" }} />
                    <Orb size={400} color="radial-gradient(circle, rgba(16,185,129,0.06) 0%, transparent 70%)" style={{ top: "40%", right: "5%" }} />
                    <Orb size={300} color="radial-gradient(circle, rgba(99,102,241,0.05) 0%, transparent 70%)" style={{ bottom: "10%", left: "5%" }} />

                    {/* Giant arc */}
                    <div style={{
                        position: "absolute",
                        bottom: "-1900px",
                        left: "50%",
                        transform: "translateX(-50%)",
                        width: 2600,
                        height: 2200,
                        borderRadius: "50%",
                        borderTop: "1px solid rgba(255,255,255,0.04)",
                        background: "radial-gradient(circle at 50% 5%, rgba(6,182,212,0.04) 0%, transparent 40%)",
                        pointerEvents: "none",
                    }} />

                    {/* Floating geometric shapes */}
                    <div className="anim-float" style={{ position: "absolute", top: "18%", left: "8%", width: 18, height: 18, border: "1px solid rgba(255,255,255,0.08)", borderRadius: 4, transform: "rotate(15deg)", pointerEvents: "none" }} />
                    <div className="anim-float2" style={{ position: "absolute", top: "30%", right: "9%", width: 12, height: 12, background: "rgba(6,182,212,0.15)", borderRadius: 3, transform: "rotate(45deg)", pointerEvents: "none" }} />
                    <div className="anim-float3" style={{ position: "absolute", bottom: "25%", left: "12%", width: 20, height: 20, border: "1px solid rgba(255,255,255,0.06)", borderRadius: 5, transform: "rotate(-20deg)", pointerEvents: "none" }} />
                    <div className="anim-float" style={{ position: "absolute", bottom: "30%", right: "7%", width: 14, height: 14, border: "1px solid rgba(16,185,129,0.2)", borderRadius: 3, transform: "rotate(30deg)", pointerEvents: "none" }} />

                    {/* Vertical line decorations */}
                    <div style={{ position: "absolute", top: 0, left: "15%", width: 1, height: 120, background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.06), transparent)", pointerEvents: "none" }} />
                    <div style={{ position: "absolute", top: 0, right: "15%", width: 1, height: 100, background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.04), transparent)", pointerEvents: "none" }} />

                    {/* Scan line effect */}
                    <div style={{ position: "absolute", left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent 0%, rgba(6,182,212,0.15) 30%, rgba(6,182,212,0.25) 50%, rgba(6,182,212,0.15) 70%, transparent 100%)", animation: "scanLine 8s linear infinite", pointerEvents: "none" }} />

                    {/* Content */}
                    <div style={{ position: "relative", zIndex: 10, textAlign: "center", padding: "0 24px", maxWidth: 820 }}>
                        <div className="anim-fadein-1" style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 9999, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", fontSize: 12, color: "rgba(255,255,255,0.45)", letterSpacing: "0.06em" }}>
                                <span style={{ color: "#34d399", fontSize: 10 }}>✦</span> Trusted Platform
                            </span>
                        </div>

                        <h1 className="anim-fadein-2" style={{ fontSize: "clamp(2.6rem, 5.5vw, 4.2rem)", fontWeight: 200, lineHeight: 1.08, letterSpacing: "-0.02em", marginBottom: 28 }}>
                            <span className="shimmer-text">Protect Your Protocol&apos;s</span>
                            <br />
                            <span style={{ color: "rgba(255,255,255,0.85)" }}>With KeepAlive Vaults</span>
                        </h1>

                        <p className="anim-fadein-3" style={{ fontSize: 15, color: "rgba(255,255,255,0.38)", lineHeight: 1.75, maxWidth: 580, margin: "0 auto 36px" }}>
                            Eliminate the bus factor of digital asset management. Our non-custodial smart contracts
                            on Stellar provide automated failsafe execution for DAO treasuries and DeFi protocols.
                        </p>

                        <div className="anim-fadein-4" style={{ display: "flex", justifyContent: "center" }}>
                            <button
                                onClick={isConnected ? () => navTo("dashboard") : connect}
                                className="glow-btn"
                                style={{ cursor: "pointer", border: "none", background: "transparent", padding: 0 }}
                            >
                                <div style={{
                                    padding: "1px",
                                    borderRadius: 9999,
                                    background: "linear-gradient(90deg, rgba(6,182,212,0.5), rgba(16,185,129,0.5))",
                                }}>
                                    <div style={{
                                        padding: "12px 32px",
                                        borderRadius: 9999,
                                        background: "#06090e",
                                        display: "flex", alignItems: "center", gap: 8,
                                    }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.14em", color: "rgba(255,255,255,0.75)", textTransform: "uppercase" }}>
                                            {isConnected ? "Open Dashboard" : "Enter the Platform"}
                                        </span>
                                        <ArrowRight size={14} color="rgba(255,255,255,0.5)" />
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════
                    PARTNERS TICKER
                ══════════════════════════════ */}
                <section style={{ padding: "40px 0", borderTop: "1px solid rgba(255,255,255,0.04)", overflow: "hidden" }}>
                    <p style={{ textAlign: "center", fontSize: 13, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 24 }}>
                        Built on trusted infrastructure
                    </p>
                    {/* Scrolling ticker */}
                    <div style={{ overflow: "hidden", maskImage: "linear-gradient(90deg, transparent 0%, black 10%, black 90%, transparent 100%)" }}>
                        <div className="ticker-track">
                            {["Stellar", "Soroban", "Freighter", "IPFS", "Stellar", "Soroban", "Freighter", "IPFS"].map((name, i) => (
                                <div key={i} style={{
                                    padding: "10px 28px",
                                    borderRadius: 12,
                                    border: "1px solid rgba(255,255,255,0.06)",
                                    background: i % 4 === 1 ? "rgba(255,255,255,0.93)" : "rgba(255,255,255,0.03)",
                                    color: i % 4 === 1 ? "#06090e" : "rgba(255,255,255,0.45)",
                                    fontSize: 14,
                                    fontWeight: 500,
                                    whiteSpace: "nowrap" as const,
                                    flexShrink: 0,
                                }}>
                                    {name}
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════
                    FEATURES
                ══════════════════════════════ */}
                <section id="features" style={{ padding: "100px 0", position: "relative", overflow: "hidden" }}>
                    <Orb size={500} color="radial-gradient(circle, rgba(6,182,212,0.05) 0%, transparent 70%)" style={{ top: "30%", left: "50%", transform: "translateX(-50%)" }} />

                    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", position: "relative", zIndex: 1 }}>
                        <div style={{ textAlign: "center", marginBottom: 64 }}>
                            <span style={{ display: "inline-flex", alignItems: "center", padding: "6px 16px", borderRadius: 9999, border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: "0.07em", marginBottom: 20 }}>
                                Our Features
                            </span>
                            <h2 style={{ fontSize: "clamp(1.9rem, 3.5vw, 2.8rem)", fontWeight: 200, color: "rgba(255,255,255,0.88)", marginBottom: 14, letterSpacing: "-0.01em" }}>
                                Innovative Features of KeepAlive
                            </h2>
                            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.32)", maxWidth: 500, margin: "0 auto", lineHeight: 1.7 }}>
                                Advanced security, real-time analytics, and autonomous on-chain execution in one protocol.
                            </p>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
                            {/* Analytics card */}
                            <div className="card-hover" style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)", padding: 28 }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <BarChart3 size={18} color="rgba(255,255,255,0.5)" />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.82)", marginBottom: 8 }}>Real-Time Analytics</h3>
                                        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.33)", lineHeight: 1.65 }}>
                                            Track countdown timers, vault balances, and contract status with live heartbeat monitoring.
                                        </p>
                                    </div>
                                </div>
                                <div style={{ padding: "16px", borderRadius: 12, background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.04)" }}>
                                    <AnimatedChart />
                                </div>
                            </div>

                            {/* Security card with orbiting diagram */}
                            <div className="card-hover" style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)", padding: 28 }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <Shield size={18} color="rgba(255,255,255,0.5)" />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.82)", marginBottom: 8 }}>Advanced Security</h3>
                                        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.33)", lineHeight: 1.65 }}>
                                            Each vault is an isolated smart contract — no shared state, no pooled funds.
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: "flex", justifyContent: "center" }}>
                                    <OrbitDiagram />
                                </div>
                            </div>

                            {/* Encrypted payloads */}
                            <div className="card-hover" style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)", padding: 28 }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <Layers size={18} color="rgba(255,255,255,0.5)" />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.82)", marginBottom: 8 }}>Encrypted Payloads</h3>
                                        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.33)", lineHeight: 1.65 }}>
                                            AES-256-GCM encrypted data — private keys, seed phrases — revealed only on fallback execution.
                                        </p>
                                    </div>
                                </div>
                                {/* Node chain visual */}
                                <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", borderRadius: 12, background: "rgba(0,0,0,0.2)", gap: 6 }}>
                                    {["Encrypt", "Store", "Lock", "Reveal"].map((label, i) => (
                                        <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
                                            <div style={{ flex: 1, textAlign: "center" }}>
                                                <div style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(255,255,255,0.1)", background: i === 3 ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 4px", fontSize: 10 }}>
                                                    {i === 3 ? "🔓" : "🔒"}
                                                </div>
                                                <p style={{ fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.05em" }}>{label}</p>
                                            </div>
                                            {i < 3 && <div style={{ width: 12, height: 1, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Autonomous */}
                            <div className="card-hover" style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)", background: "linear-gradient(135deg, rgba(255,255,255,0.025) 0%, rgba(255,255,255,0.01) 100%)", padding: 28 }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
                                    <div style={{ width: 40, height: 40, borderRadius: 10, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                        <Globe size={18} color="rgba(255,255,255,0.5)" />
                                    </div>
                                    <div>
                                        <h3 style={{ fontSize: 16, fontWeight: 500, color: "rgba(255,255,255,0.82)", marginBottom: 8 }}>Autonomous Execution</h3>
                                        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.33)", lineHeight: 1.65 }}>
                                            No human intervention required. The contract self-executes the fallback procedure entirely on-chain.
                                        </p>
                                    </div>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, background: "rgba(0,0,0,0.2)" }}>
                                    {["Deploy", "Heartbeat", "Fallback"].map((s, i) => (
                                        <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                            <span style={{
                                                padding: "6px 12px", borderRadius: 8, fontSize: 11, fontFamily: "monospace",
                                                border: i === 2 ? "1px solid rgba(16,185,129,0.25)" : "1px solid rgba(255,255,255,0.07)",
                                                background: i === 2 ? "rgba(16,185,129,0.07)" : "rgba(255,255,255,0.03)",
                                                color: i === 2 ? "rgba(52,211,153,0.8)" : "rgba(255,255,255,0.5)",
                                            }}>
                                                {s}
                                            </span>
                                            {i < 2 && <ArrowRight size={12} color="rgba(255,255,255,0.15)" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════
                    DASHBOARD PREVIEW
                ══════════════════════════════ */}
                <section style={{ padding: "100px 0", position: "relative", overflow: "hidden" }}>
                    <Orb size={600} color="radial-gradient(circle, rgba(6,182,212,0.04) 0%, transparent 70%)" style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)" }} />

                    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", position: "relative", zIndex: 1 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
                            {/* Text col */}
                            <div>
                                <h2 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 200, lineHeight: 1.08, letterSpacing: "-0.02em", marginBottom: 20 }}>
                                    All-in-One Web3<br /><span style={{ color: "rgba(255,255,255,0.4)" }}>Vault Dashboard</span>
                                </h2>
                                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.32)", lineHeight: 1.75, marginBottom: 20, maxWidth: 400 }}>
                                    Monitor heartbeat countdowns, vault balances, and contract status from a single interface. Deploy and manage your protocol&apos;s failsafe operations seamlessly.
                                </p>
                                <ul style={{ listStyle: "none", padding: 0, marginBottom: 32 }}>
                                    {["Real-time heartbeat monitoring", "One-click vault deployment", "Multi-vault management"].map((item) => (
                                        <li key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "rgba(255,255,255,0.36)", marginBottom: 10 }}>
                                            <div style={{ width: 18, height: 18, borderRadius: "50%", border: "1px solid rgba(52,211,153,0.3)", background: "rgba(52,211,153,0.07)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                                                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "rgba(52,211,153,0.7)" }} />
                                            </div>
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    onClick={isConnected ? () => navTo("dashboard") : connect}
                                    className="glow-btn"
                                    style={{ cursor: "pointer", border: "none", background: "transparent", padding: 0 }}
                                >
                                    <div style={{ padding: "1px", borderRadius: 9999, background: "linear-gradient(90deg, rgba(6,182,212,0.45), rgba(16,185,129,0.45))" }}>
                                        <div style={{ padding: "10px 24px", borderRadius: 9999, background: "#06090e" }}>
                                            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.14em", color: "rgba(255,255,255,0.65)", textTransform: "uppercase" as const }}>
                                                {isConnected ? "Manage Vault" : "Connect Wallet"}
                                            </span>
                                        </div>
                                    </div>
                                </button>
                            </div>

                            {/* Cards col */}
                            <div style={{ position: "relative", height: 380 }}>
                                {/* BG card: chart */}
                                <div style={{
                                    position: "absolute", right: 0, top: 0, width: "100%", maxWidth: 420,
                                    borderRadius: 20, border: "1px solid rgba(255,255,255,0.05)", background: "rgba(10,17,24,0.8)",
                                    padding: 20, opacity: 0.55, transform: "translate(12px, -12px)",
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>Vault Activity</span>
                                        <div style={{ display: "flex", gap: 4 }}>
                                            {["1D", "1W", "1M"].map((t, i) => (
                                                <span key={t} style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, background: i === 1 ? "white" : "rgba(255,255,255,0.06)", color: i === 1 ? "#06090e" : "rgba(255,255,255,0.35)" }}>{t}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <svg width="100%" height="100" viewBox="0 0 100 35" preserveAspectRatio="none">
                                        <defs>
                                            <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="rgba(6,182,212,0.18)" />
                                                <stop offset="100%" stopColor="rgba(6,182,212,0)" />
                                            </linearGradient>
                                        </defs>
                                        <path d="M0,30 Q8,25 15,28 T30,14 T52,20 T72,8 T88,5 T100,12 L100,35 L0,35 Z" fill="url(#cg)" />
                                        <path d="M0,30 Q8,25 15,28 T30,14 T52,20 T72,8 T88,5 T100,12" fill="none" stroke="rgba(6,182,212,0.6)" strokeWidth="0.8" />
                                    </svg>
                                </div>

                                {/* FG card: vault status */}
                                <div style={{
                                    position: "absolute", left: 0, top: 60, width: 295,
                                    borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)",
                                    background: "linear-gradient(180deg, rgba(12,22,32,0.98) 0%, rgba(8,14,20,0.98) 100%)",
                                    padding: 20, boxShadow: "0 24px 60px rgba(0,0,0,0.55)",
                                    zIndex: 10,
                                }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                                        <span style={{ fontSize: 14, fontWeight: 500, color: "rgba(255,255,255,0.78)" }}>Vault Overview</span>
                                        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "rgba(52,211,153,0.7)" }}>
                                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "rgba(52,211,153,0.6)", display: "inline-block", animation: "glowPulse 2s ease-in-out infinite" }} />
                                            Active
                                        </span>
                                    </div>
                                    <div style={{ textAlign: "center", padding: "16px 8px", marginBottom: 16, borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)" }}>
                                        <p style={{ fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 6 }}>Heartbeat Countdown</p>
                                        <p style={{ fontSize: 30, fontWeight: 200, fontFamily: "monospace", color: "rgba(255,255,255,0.85)", letterSpacing: "0.05em" }}>
                                            89<span style={{ color: "rgba(255,255,255,0.15)" }}>:</span>23<span style={{ color: "rgba(255,255,255,0.15)" }}>:</span>45<span style={{ color: "rgba(255,255,255,0.15)" }}>:</span>12
                                        </p>
                                        <div style={{ display: "flex", justifyContent: "center", gap: 22, marginTop: 4 }}>
                                            {["days", "hrs", "min", "sec"].map((l) => <span key={l} style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{l}</span>)}
                                        </div>
                                    </div>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                        {[["Balance", "1,250 XLM"], ["Contract", "CDXF...7KBN"]].map(([label, val]) => (
                                            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                                                <span style={{ color: "rgba(255,255,255,0.28)" }}>{label}</span>
                                                <span style={{ fontFamily: "monospace", color: "rgba(255,255,255,0.62)" }}>{val}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════
                    CONFIG TABLE
                ══════════════════════════════ */}
                <section style={{ padding: "100px 0", position: "relative" }}>
                    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 64, alignItems: "center" }}>
                            {/* Table */}
                            <div style={{ borderRadius: 20, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(8,13,18,0.8)", overflow: "hidden" }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 11, color: "rgba(255,255,255,0.22)", letterSpacing: "0.06em" }}>
                                    <span>Contract</span><span>Status</span><span>Heartbeat</span><span>Balance</span>
                                </div>
                                {[
                                    { id: "CABX...3K91", status: "Active", color: "rgba(52,211,153,0.7)", hz: "90 Days", bal: "15,000 XLM" },
                                    { id: "GDY2...K9LP", status: "Warning", color: "rgba(251,191,36,0.7)", hz: "30 Days", bal: "2,450 XLM" },
                                    { id: "CAM9...7BXQ", status: "Active", color: "rgba(52,211,153,0.7)", hz: "180 Days", bal: "450,000 XLM" },
                                    { id: "GAT7...NV10", status: "Expired", color: "rgba(248,113,113,0.65)", hz: "7 Days", bal: "120 XLM" },
                                    { id: "SHB8...M2C4", status: "Active", color: "rgba(52,211,153,0.7)", hz: "365 Days", bal: "89,000 XLM" },
                                ].map((r, i) => (
                                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", padding: "14px 20px", borderBottom: i < 4 ? "1px solid rgba(255,255,255,0.03)" : "none", alignItems: "center" }}>
                                        <span style={{ fontSize: 12, fontFamily: "monospace", color: "rgba(255,255,255,0.55)" }}>{r.id}</span>
                                        <span style={{ fontSize: 11, color: r.color }}>{r.status}</span>
                                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.42)" }}>{r.hz}</span>
                                        <span style={{ fontSize: 12, fontFamily: "monospace", color: "rgba(255,255,255,0.55)" }}>{r.bal}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Text */}
                            <div>
                                <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.7rem)", fontWeight: 200, lineHeight: 1.1, letterSpacing: "-0.02em", marginBottom: 18, color: "rgba(255,255,255,0.88)" }}>
                                    Configure vault parameters to match your protocol needs.
                                </h2>
                                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.32)", lineHeight: 1.75, marginBottom: 28, maxWidth: 380 }}>
                                    Each vault operates fully independently with configurable heartbeat intervals, grace periods, and backup addresses — all on-chain, all verifiable.
                                </p>
                                <button
                                    onClick={() => navTo("architecture")}
                                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 24px", borderRadius: 9999, background: "white", border: "none", color: "#06090e", fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "opacity 0.2s" }}
                                    onMouseOver={e => (e.currentTarget.style.opacity = "0.9")}
                                    onMouseOut={e => (e.currentTarget.style.opacity = "1")}
                                >
                                    Explore Architecture <ArrowRight size={12} />
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════
                    FAQ
                ══════════════════════════════ */}
                <section style={{ padding: "100px 0", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, marginBottom: 64 }}>
                            <h2 style={{ fontSize: "clamp(1.8rem, 3.5vw, 2.7rem)", fontWeight: 200, lineHeight: 1.1, color: "rgba(255,255,255,0.88)" }}>
                                Have a Question?<br /><span style={{ color: "rgba(255,255,255,0.35)" }}>We&apos;ve Got Your Answers.</span>
                            </h2>
                            <div style={{ paddingLeft: 32, borderLeft: "1px solid rgba(255,255,255,0.05)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                                <p style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", lineHeight: 1.7, marginBottom: 16 }}>
                                    Can&apos;t find what you&apos;re looking for? We&apos;re available on Discord and GitHub.
                                </p>
                                <button style={{ alignSelf: "flex-start", padding: "8px 20px", borderRadius: 9999, background: "white", border: "none", fontSize: 12, fontWeight: 600, color: "#06090e", cursor: "pointer" }}>
                                    Read More
                                </button>
                            </div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px 64px" }}>
                            {[
                                { q: "What is KeepAlive?", a: "A non-custodial smart contract factory on Stellar Soroban. Deploys isolated vaults with dead-man's switch technology for DAO treasuries and DeFi protocols." },
                                { q: "How do I start?", a: "Connect your Freighter wallet, deploy a vault with your parameters, transfer assets, and set up an automation agent to send periodic heartbeat pings." },
                                { q: "Is it custodial?", a: "No. We never hold your keys or funds. Every vault is an independent smart contract that you deploy and fully control." },
                                { q: "What happens during fallback?", a: "When the timer expires, the contract transfers the vault balance to your designated backup address and reveals any encrypted payloads attached during creation." },
                            ].map((faq, i) => (
                                <div key={i}>
                                    <h3 style={{ fontSize: 17, fontWeight: 400, color: "rgba(255,255,255,0.75)", marginBottom: 10 }}>{faq.q}</h3>
                                    <p style={{ fontSize: 13, color: "rgba(255,255,255,0.28)", lineHeight: 1.7 }}>{faq.a}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════
                    FOOTER
                ══════════════════════════════ */}
                <footer style={{ padding: "60px 0 28px", borderTop: "1px solid rgba(255,255,255,0.04)", background: "#04080b" }}>
                    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", gap: 32, marginBottom: 48 }}>
                            <div>
                                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                                    <div style={{ width: 20, height: 20, background: "white", borderRadius: 4, transform: "rotate(45deg)" }} />
                                    <span style={{ fontSize: 16, fontWeight: 600, letterSpacing: "0.04em" }}>KeepAlive.</span>
                                </div>
                                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", lineHeight: 1.65 }}>
                                    Built on Stellar & Soroban.<br />Non-custodial. Open source.
                                </p>
                            </div>
                            {[
                                { title: "Product", items: ["Dashboard", "Architecture", "Documentation"] },
                                { title: "Company", items: ["About", "Security", "Ecosystem"] },
                                { title: "Support", items: ["GitHub", "Discord", "Community"] },
                                { title: "Docs", items: ["Getting Started", "Smart Contracts", "API Ref"] },
                            ].map((col) => (
                                <div key={col.title}>
                                    <h4 style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 14, fontWeight: 500 }}>{col.title}</h4>
                                    <ul style={{ listStyle: "none", padding: 0 }}>
                                        {col.items.map((item) => (
                                            <li key={item} style={{ fontSize: 12, color: "rgba(255,255,255,0.22)", marginBottom: 8, cursor: "pointer" }}
                                                onMouseOver={e => (e.currentTarget.style.color = "rgba(255,255,255,0.55)")}
                                                onMouseOut={e => (e.currentTarget.style.color = "rgba(255,255,255,0.22)")}
                                            >{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 20, borderTop: "1px solid rgba(255,255,255,0.04)", fontSize: 11, color: "rgba(255,255,255,0.18)" }}>
                            <span>© 2025 KeepAlive Protocol. All rights reserved.</span>
                            <div style={{ display: "flex", gap: 16 }}>
                                <span style={{ cursor: "pointer" }}>Privacy</span>
                                <span style={{ cursor: "pointer" }}>Terms</span>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
