"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function LandingPage() {

    useEffect(() => {
        // Scroll reveal for How It Works steps
        const steps = document.querySelectorAll('.reveal-step');
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) {
                    e.target.classList.add('visible');
                    observer.unobserve(e.target);
                }
            });
        }, { threshold: 0.15 });
        steps.forEach((s) => observer.observe(s));

        // Scroll reveal for walkthrough items
        const walkthroughs = document.querySelectorAll('.reveal-walkthrough');
        const wObserver = new IntersectionObserver((entries) => {
            entries.forEach((e) => {
                if (e.isIntersecting) {
                    e.target.classList.add('visible');
                    wObserver.unobserve(e.target);
                }
            });
        }, { threshold: 0.08 });
        walkthroughs.forEach((w) => wObserver.observe(w));

        return () => {
            observer.disconnect();
            wObserver.disconnect();
        };
    }, []);

    return (
        <>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=JetBrains+Mono:wght@400;500&display=swap');

                @keyframes floatUp { 0% { opacity:0; transform:translateY(40px); } 100% { opacity:1; transform:translateY(0); } }
                @keyframes fadeIn { 0% { opacity:0; } 100% { opacity:1; } }
                @keyframes slideInLeft { 0% { opacity:0; transform:translateX(-32px); } 100% { opacity:1; transform:translateX(0); } }
                @keyframes slideInRight { 0% { opacity:0; transform:translateX(32px); } 100% { opacity:1; transform:translateX(0); } }
                @keyframes revealBar { 0% { width:0; } 100% { width:var(--bar-w); } }
                @keyframes ecgDraw { 0% { stroke-dashoffset:1200; } 100% { stroke-dashoffset:0; } }
                @keyframes glowPulse { 0%,100% { opacity:0.04; } 50% { opacity:0.10; } }
                @keyframes scanLine { 0% { transform:translateY(-100%); } 100% { transform:translateY(900px); } }
                @keyframes phoneTilt { 0%,100% { transform:rotate(-1.5deg) translateY(0px); } 50% { transform:rotate(-1.5deg) translateY(-8px); } }
                @keyframes phoneTilt2 { 0%,100% { transform:rotate(0deg) translateY(40px); } 50% { transform:rotate(0deg) translateY(30px); } }
                @keyframes phoneTilt3 { 0%,100% { transform:rotate(1.5deg) translateY(0px); } 50% { transform:rotate(1.5deg) translateY(-8px); } }
                @keyframes pulseOut { 0% { transform:scale(1); opacity:0.8; } 100% { transform:scale(3); opacity:0; } }

                :root {
                    --bg-paper: #F2F0EB;
                    --bg-void: #080808;
                    --text-primary: #080808;
                    --text-void: #EAEAEA;
                    --text-dim: #777777;
                    --border-color: #080808;
                    --font-display: 'Inter', sans-serif;
                    --font-mono: 'JetBrains Mono', monospace;
                }

                * { box-sizing: border-box; margin: 0; padding: 0; }
                .ka-page { background-color: var(--bg-paper); color: var(--text-primary); font-family: var(--font-display); line-height: 1.5; -webkit-font-smoothing: antialiased; min-height: 100vh; }
                .container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
                .mono { font-family: var(--font-mono); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; }
                .label { font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.2em; color: var(--text-dim); }
                .section-eyebrow { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
                .section-eyebrow::before { content: ''; width: 24px; height: 1px; background: currentColor; opacity: 0.3; }

                nav { padding: 2rem; display: flex; justify-content: space-between; align-items: center; position: absolute; width: 100%; z-index: 10; }
                .logo { font-weight: 800; font-size: 1.2rem; color: white; }

                .hero { background: #060606; color: var(--text-void); min-height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 4rem 2rem; position: relative; overflow: hidden; }
                .hero-bg { position: absolute; inset: 0; pointer-events: none; }
                .hero h1 { font-size: clamp(5rem, 13vw, 11rem); font-weight: 800; line-height: 0.85; letter-spacing: -0.04em; margin-bottom: 2rem; position: relative; z-index: 2; animation: floatUp 1s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
                .hero-sub { font-size: 1.1rem; color: #888; max-width: 480px; line-height: 1.6; position: relative; z-index: 2; margin-bottom: 2.5rem; animation: floatUp 1s cubic-bezier(0.16,1,0.3,1) 0.3s both; }
                .hero-cta-row { display: flex; align-items: center; gap: 1.5rem; position: relative; z-index: 2; margin-bottom: 4rem; animation: floatUp 1s cubic-bezier(0.16,1,0.3,1) 0.45s both; }
                .btn-primary { padding: 1rem 2.5rem; background: white; color: black; font-family: var(--font-mono); font-size: 0.75rem; font-weight: 600; letter-spacing: 0.1em; text-decoration: none; transition: transform 0.2s, opacity 0.2s, box-shadow 0.2s; }
                .btn-primary:hover { opacity: 1; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(255,255,255,0.15); }
                .btn-ghost { padding: 1rem 2.5rem; border: 1px solid #2a2a2a; color: #888; font-family: var(--font-mono); font-size: 0.75rem; letter-spacing: 0.1em; text-decoration: none; transition: transform 0.2s, border-color 0.2s, color 0.2s; }
                .btn-ghost:hover { border-color: #888; color: #aaa; transform: translateY(-2px); }
                .hero-meta { display: flex; justify-content: space-between; width: 100%; max-width: 1200px; border-top: 1px solid #1a1a1a; padding-top: 1.5rem; position: relative; z-index: 2; animation: fadeIn 1.2s ease 0.7s both; }
                .hero-stat { text-align: left; }
                .hero-stat-num { font-size: 1.8rem; font-weight: 800; color: #eaeaea; line-height: 1; }
                .hero-stat-label { font-family: var(--font-mono); font-size: 0.65rem; color: #888; margin-top: 0.25rem; letter-spacing: 0.1em; }
                .pulse-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; position: relative; display: inline-block; }
                .pulse-dot::after { content: ''; position: absolute; inset: -4px; border-radius: 50%; border: 1px solid #22c55e; animation: pulseOut 2s ease-out infinite; }
                .scan-line { position: absolute; left: 0; right: 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent); pointer-events: none; animation: scanLine 8s linear infinite; z-index: 1; }
                .ecg-path { stroke-dasharray: 1200; animation: ecgDraw 3s ease-out 0.5s both; }
                .ring-pulse { animation: glowPulse 4s ease-in-out infinite; }

                .problem-section { padding: 9rem 0; border-bottom: 1px solid #d8d8d8; }
                .problem-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6rem; align-items: center; }
                .problem-stat { font-size: clamp(5rem, 9vw, 9rem); font-weight: 800; line-height: 1; letter-spacing: -0.03em; transition: transform 0.3s ease; }
                .problem-stat:hover { transform: scale(1.02); }
                .stat-bars { margin-top: 2rem; display: flex; flex-direction: column; gap: 1.2rem; }
                .stat-bar-row { display: flex; flex-direction: column; gap: 0.4rem; }
                .stat-bar-label { font-family: var(--font-mono); font-size: 0.68rem; color: #888; letter-spacing: 0.1em; display: flex; justify-content: space-between; }
                .stat-bar-track { height: 2px; background: #e0e0e0; border-radius: 2px; }
                .stat-bar-fill { height: 2px; border-radius: 2px; transition: width 1.5s cubic-bezier(0.16,1,0.3,1); }
                .problem-body h3 { font-size: 1.8rem; font-weight: 800; line-height: 1.15; margin-bottom: 1.5rem; letter-spacing: -0.02em; }
                .problem-body p { font-size: 1rem; color: #888; line-height: 1.7; max-width: 460px; }
                .badge { display: inline-flex; align-items: center; gap: 0.5rem; margin-top: 2rem; border: 1px solid #d0d0d0; padding: 0.5rem 1rem; font-family: var(--font-mono); font-size: 0.65rem; color: #888; letter-spacing: 0.08em; }

                .roadmap-section { padding: 8rem 0; background: #EDEBE6; }

                /* Reveal animations */
                .reveal-step { opacity: 0; transform: translateY(18px); transition: opacity 0.55s cubic-bezier(0.16,1,0.3,1), transform 0.55s cubic-bezier(0.16,1,0.3,1); }
                .reveal-step.visible { opacity: 1; transform: translateY(0); }
                .reveal-step.visible.how-step { transition: background 0.25s ease, padding-left 0.25s ease; }
                .how-step:hover { background: rgba(8,8,8,0.03); padding-left: 1rem; }
                .reveal-walkthrough { opacity: 0; transform: translateY(48px); transition: opacity 0.8s cubic-bezier(0.16,1,0.3,1), transform 0.8s cubic-bezier(0.16,1,0.3,1); }
                .reveal-walkthrough.visible { opacity: 1; transform: translateY(0); }

                /* WALKTHROUGH */
                .walkthrough-section { padding: 7rem 0 9rem; background: #080808; overflow: hidden; }
                .walkthrough-section .label { color: #b0b0b0; }
                .walkthrough-section > .container > h2 { color: #eaeaea; font-size: clamp(1.8rem, 3vw, 2.6rem); font-weight: 800; letter-spacing: -0.03em; margin-top: 0.5rem; margin-bottom: 5rem; }
                .walkthrough-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 4rem; align-items: start; }
                .walkthrough-item { display: flex; flex-direction: column; align-items: flex-start; text-align: left; padding: 0; overflow: visible; transition: opacity 0.4s ease, transform 0.4s ease; }
                .walkthrough-grid:hover .walkthrough-item { opacity: 0.4; }
                .walkthrough-grid:hover .walkthrough-item:hover { opacity: 1; transform: scale(1.05); }
                .walkthrough-step-num { font-family: var(--font-mono); font-size: 0.8rem; color: #888; letter-spacing: 0.25em; margin-bottom: 1.5rem; display: inline-block; font-weight: 600; }
                .walkthrough-item-visual { display: flex; justify-content: flex-start; align-items: flex-start; width: 100%; margin-bottom: 4rem; overflow: visible; }
                .walkthrough-text { line-height: 1.6; font-size: 0.95rem; }
                .walkthrough-text p { color: #b0b0b0 !important; margin: 0; }
                .walkthrough-text strong { color: #eaeaea; font-weight: 600; display: block; margin-bottom: 0.5rem; font-size: 1.1rem; }
                .phone-frame { width: 100%; border-radius: 16px; overflow: hidden; flex-shrink: 0; transition: transform 0.4s ease; }
                .phone-frame:hover { transform: scale(1.02); }
                .walkthrough-item:nth-child(1) .phone-frame { animation: phoneTilt 6s ease-in-out infinite; }
                .walkthrough-item:nth-child(2) .phone-frame { animation: phoneTilt2 6s ease-in-out 0.5s infinite; }
                .walkthrough-item:nth-child(3) .phone-frame { animation: phoneTilt3 6s ease-in-out 1s infinite; }
                .walkthrough-text h4, .walkthrough-item-meta h4 { font-size: 1rem; font-weight: 800; color: #d0d0d0; margin: 0 0 0.4rem 0; letter-spacing: -0.02em; line-height: 1.2; }
                .walkthrough-text p, .walkthrough-item-meta p { font-size: 0.77rem; color: #b0b0b0; line-height: 1.75; margin: 0; }

                .features-section { padding: 8rem 0; background: #F2F0EB; }
                .feature-row { display: grid; grid-template-columns: 1fr 2fr; gap: 4rem; padding: 2.5rem 0; border-top: 1px solid #d0d0d0; align-items: start; transition: background 0.2s ease; }
                .feature-row:last-child { border-bottom: 1px solid #d0d0d0; }
                .feature-row:hover { background: rgba(8,8,8,0.03); padding-left: 1rem; transition: background 0.2s, padding-left 0.2s; }
                .feature-name { font-weight: 800; text-transform: uppercase; font-size: 1rem; display: flex; flex-direction: column; gap: 0.75rem; }
                .feature-desc { color: #444; line-height: 1.7; font-size: 0.95rem; font-weight: 500; }

                .arch-section { padding: 8rem 0; }
                .arch-layer-row { display: grid; grid-template-columns: 120px 1fr 1fr 1fr; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e8e8e8; transition: background 0.15s; }
                .arch-layer-row:hover { background: #EDEBE6; }
                .arch-layer-row:last-child { border-bottom: none; }

                .spec-section { padding: 8rem 0; background: #EDEBE6; }

                .cta-section { background: #080808; color: var(--text-void); padding: 10rem 0; text-align: center; position: relative; overflow: hidden; }
                .cta-btn { display: inline-block; padding: 1.25rem 3.5rem; background: white; color: black; text-decoration: none; font-family: var(--font-mono); font-weight: 600; font-size: 0.8rem; letter-spacing: 0.1em; margin-top: 3rem; transition: opacity 0.2s; }
                .cta-btn:hover { opacity: 0.88; }

                .ka-footer { padding: 4rem 0; border-top: 1px solid #d8d8d8; }
                .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr; gap: 4rem; }
                .status-dot { width: 7px; height: 7px; background: #22c55e; display: inline-block; border-radius: 50%; margin-right: 8px; }
                .ka-footer a { color: #666; text-decoration: none; display: block; margin-bottom: 0.5rem; font-size: 0.85rem; }
                .ka-footer a:hover { color: black; }

                @media (max-width: 768px) {
                    .problem-grid, .feature-row, .footer-grid, .walkthrough-grid { grid-template-columns: 1fr; }
                    .hero h1 { font-size: 4.5rem; }
                    .arch-layer-row { grid-template-columns: 1fr; gap: 0.5rem; }
                }
            `}</style>

            <div className="ka-page">

                <nav>
                    <div className="logo">KEEPALIVE®</div>
                    <div className="mono">PROTOCOL V1.0.4 [TESTNET]</div>
                </nav>

                {/* HERO */}
                <section className="hero">
                    <div className="hero-bg">
                        <svg width="100%" height="100%" viewBox="0 0 1440 900" fill="none" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0 }}>
                            <defs>
                                <radialGradient id="heroGlow" cx="50%" cy="50%" r="60%"><stop offset="0%" stopColor="#1a1a1a" stopOpacity="1" /><stop offset="100%" stopColor="#060606" stopOpacity="1" /></radialGradient>
                            </defs>
                            <rect width="1440" height="900" fill="url(#heroGlow)" />
                            <line x1="0" y1="150" x2="1440" y2="150" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.03" />
                            <line x1="0" y1="300" x2="1440" y2="300" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.03" />
                            <line x1="0" y1="450" x2="1440" y2="450" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.03" />
                            <line x1="0" y1="600" x2="1440" y2="600" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.03" />
                            <line x1="0" y1="750" x2="1440" y2="750" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.03" />
                            <line x1="240" y1="0" x2="240" y2="900" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.025" />
                            <line x1="480" y1="0" x2="480" y2="900" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.025" />
                            <line x1="720" y1="0" x2="720" y2="900" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.025" />
                            <line x1="960" y1="0" x2="960" y2="900" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.025" />
                            <line x1="1200" y1="0" x2="1200" y2="900" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.025" />
                            <polyline className="ecg-path" points="0,450 200,450 260,450 290,340 320,560 350,340 380,560 410,450 480,450 1440,450" stroke="#fff" strokeWidth="1.5" fill="none" strokeOpacity="0.12" />
                            <circle className="ring-pulse" cx="720" cy="450" r="120" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.06" fill="none" />
                            <circle className="ring-pulse" cx="720" cy="450" r="200" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.04" fill="none" style={{ animationDelay: "1s" }} />
                            <circle className="ring-pulse" cx="720" cy="450" r="300" stroke="#fff" strokeWidth="0.5" strokeOpacity="0.03" fill="none" style={{ animationDelay: "2s" }} />
                            <line x1="40" y1="40" x2="80" y2="40" stroke="#333" strokeWidth="1" /><line x1="40" y1="40" x2="40" y2="80" stroke="#333" strokeWidth="1" />
                            <line x1="1360" y1="40" x2="1400" y2="40" stroke="#333" strokeWidth="1" /><line x1="1400" y1="40" x2="1400" y2="80" stroke="#333" strokeWidth="1" />
                            <line x1="40" y1="860" x2="80" y2="860" stroke="#333" strokeWidth="1" /><line x1="40" y1="820" x2="40" y2="860" stroke="#333" strokeWidth="1" />
                        </svg>
                        <div className="scan-line" />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "3rem", position: "relative", zIndex: 2 }}>
                        <span style={{ width: 20, height: 1, background: "#333", display: "inline-block" }} />
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", letterSpacing: "0.2em", color: "#b0b0b0" }}>TRUSTLESS INHERITANCE PROTOCOL · STELLAR</span>
                        <span style={{ width: 20, height: 1, background: "#333", display: "inline-block" }} />
                    </div>
                    <h1 style={{ position: "relative", zIndex: 2 }}>HEART<br />BEAT<br />PROTOCOL</h1>
                    <p className="hero-sub">Your crypto stays protected — always. An autonomous on-chain protocol that transfers your Stellar wallet to a trusted beneficiary when prolonged inactivity is detected.</p>
                    <div className="hero-cta-row">
                        <Link href="/freighter-demo" className="btn-primary">ACTIVATE PROTOCOL</Link>
                        <a href="https://github.com/EfuzeGI/KeepAlive-Stellar-" target="_blank" rel="noopener noreferrer" className="btn-ghost">READ DOCS →</a>
                    </div>
                    <div style={{ marginBottom: "5rem", position: "relative", zIndex: 2 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", letterSpacing: "0.12em", color: "#b0b0b0" }}>KEEPER AGENT ACTIVE — MONITORING 24/7</span>
                        </div>
                    </div>
                    <div className="hero-meta container">
                        <div className="hero-stat"><div className="hero-stat-num">~5s</div><div className="hero-stat-label">Stellar finality</div></div>
                        <div className="hero-stat"><div className="hero-stat-num">0</div><div className="hero-stat-label">Keys ever accessed</div></div>
                        <div className="hero-stat" style={{ textAlign: "right" }}><div className="hero-stat-num" style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", color: "#b0b0b0" }}>ID: CDZ7...FCBN</div><div className="hero-stat-label">Soroban contract</div></div>
                    </div>
                </section>

                {/* PROBLEM */}
                <section className="problem-section container" style={{ overflow: "hidden" }}>
                    <div className="section-eyebrow label">The Problem</div>
                    <div className="problem-grid">
                        <div>
                            <div className="problem-stat" style={{ animation: "slideInLeft 0.9s cubic-bezier(0.16,1,0.3,1) both" }}>$150B+</div>
                            <div style={{ marginTop: "0.5rem" }}><span style={{ fontSize: "0.9rem", color: "#555" }}>in crypto permanently inaccessible</span></div>
                            <div className="stat-bars" style={{ marginTop: "2.5rem" }}>
                                <div className="stat-bar-row">
                                    <div className="stat-bar-label"><span>LOST PERMANENTLY</span><span>78%</span></div>
                                    <div className="stat-bar-track"><div className="stat-bar-fill" style={{ width: "78%", background: "#080808", animation: "revealBar 1.4s cubic-bezier(0.16,1,0.3,1) 0.3s both", ["--bar-w" as string]: "78%" } as React.CSSProperties} /></div>
                                </div>
                                <div className="stat-bar-row">
                                    <div className="stat-bar-label"><span>RECOVERABLE</span><span>22%</span></div>
                                    <div className="stat-bar-track"><div className="stat-bar-fill" style={{ width: "22%", background: "#aaa", animation: "revealBar 1.4s cubic-bezier(0.16,1,0.3,1) 0.5s both", ["--bar-w" as string]: "22%" } as React.CSSProperties} /></div>
                                </div>
                            </div>
                        </div>
                        <div className="problem-body" style={{ animation: "slideInRight 0.9s cubic-bezier(0.16,1,0.3,1) 0.15s both", maxWidth: 560 }}>
                            <h3>Most crypto wallets have no succession plan.</h3>
                            <p>When a holder becomes inactive — by accident, illness, or death — their assets are locked forever. There&apos;s no custodian to call, no password reset, no legal mechanism that understands private keys.</p>
                            <p style={{ marginTop: "1rem" }}>KeepAlive solves this through automated signer rotation on Stellar — no keys accessed, no custody required.</p>
                            <div className="badge" style={{ borderColor: "rgba(0,0,0,0.2)" }}>
                                <span style={{ color: "#222", fontWeight: "600" }}>
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    NON-CUSTODIAL &middot; ON-CHAIN ONLY &middot; ZERO KEY ACCESS
                                </span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* HOW IT WORKS */}
                <section className="roadmap-section">
                    <div className="container">
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "4rem" }}>
                            <div>
                                <div className="section-eyebrow label" style={{ marginBottom: "1rem" }}>How It Works</div>
                                <h2 style={{ fontSize: "clamp(2rem,4vw,3rem)", fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 0, lineHeight: 1 }}>Three steps.<br />Fully automated.</h2>
                            </div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "#555", letterSpacing: "0.05em" }}>PROTOCOL_VERSION 1.0.4</div>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid #ddd" }}>
                            {[
                                { num: "01", title: "ACTIVATE", desc: "Deploy a non-custodial smart contract. Define your inactivity threshold and beneficiary address.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect x="2" y="6" width="20" height="14" rx="2" stroke="#080808" strokeWidth="1.2" /><path d="M2 10h20" stroke="#080808" strokeWidth="1.2" /><rect x="14" y="13" width="5" height="4" rx="1" stroke="#080808" strokeWidth="1.2" /></svg>, bullets: [{ text: "Soroban WASM contract", active: true }, { text: "Ed25519 key auth", active: false }, { text: "Stellar Mainnet", active: false }] },
                                { num: "02", title: "MONITOR", desc: "The Keeper Agent watches every Stellar ledger close. Any tx from your address resets the heartbeat timer.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#080808" strokeWidth="1.2" /><circle cx="12" cy="12" r="3" fill="#080808" /><line x1="12" y1="12" x2="18" y2="7" stroke="#080808" strokeWidth="1.2" strokeLinecap="round" /></svg>, bullets: [{ text: "Horizon API ingestor", active: true }, { text: "Every ledger close (~5s)", active: false }, { text: "Node.js · 24/7 uptime", active: false }] },
                                { num: "03", title: "EXECUTE", desc: "Timer expires. Contract rotates signer weights — all assets (XLM, USDC, tokens) and signing rights transfer automatically to the beneficiary's wallet.", icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="6" cy="12" r="4" stroke="#080808" strokeWidth="1.2" /><circle cx="18" cy="12" r="4" fill="#080808" /><path d="M10 10l4 2-4 2" stroke="#eaeaea" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>, bullets: [{ text: "owner_weight → 0", active: true }, { text: "beneficiary_weight → 10", active: true }, { text: "Zero custody · no keys", active: false }] }
                            ].map((step, i) => (
                                <div key={step.num} className="reveal-step how-step" style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr", borderBottom: i < 2 ? "1px solid #ddd" : "none", minHeight: 120, transitionDelay: `${i * 0.12}s` }}>
                                    <div style={{ padding: "2rem 1.5rem", borderRight: "1px solid #ddd", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "#555", letterSpacing: "0.1em" }}>{step.num}</span>
                                        {step.icon}
                                    </div>
                                    <div style={{ padding: "2rem 2.5rem", borderRight: "1px solid #ddd" }}>
                                        <div style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "0.5rem" }}>{step.title}</div>
                                        <p style={{ color: "#555", fontSize: "0.88rem", lineHeight: 1.6 }}>{step.desc}</p>
                                    </div>
                                    <div style={{ padding: "2rem 2.5rem", display: "flex", flexDirection: "column", justifyContent: "center", gap: "0.75rem" }}>
                                        {step.bullets.map((b, j) => (
                                            <div key={j} style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                                                <div style={{ width: 6, height: 6, borderRadius: "50%", background: b.active ? "#080808" : "#ccc", flexShrink: 0 }} />
                                                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.72rem", color: b.active ? "#444" : "#777" }}>{b.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* WALKTHROUGH */}
                <section className="walkthrough-section">
                    <div className="container">
                        <span className="label">Product Walkthrough</span>
                        <h2 style={{ marginBottom: "5rem" }}>Built into the wallet you already use.</h2>
                        <div className="walkthrough-grid">
                            {[
                                { num: "01", img: "/screenshot-wallet.png", alt: "Freighter wallet", title: "Instant Demo Access", desc: "Generate a volatile testnet wallet in one click or connect your existing Freighter. Zero friction to test the protocol." },
                                { num: "02", img: "/screenshot-setup.png", alt: "Setup protection", title: "Configure in 30 Seconds", desc: "Set your beneficiary address and inactivity threshold. Every transaction resets the timer automatically.", delay: "0.15s" },
                                { num: "03", img: "/screenshot-inherited.png", alt: "Inherited accounts", title: "Inherited Accounts", desc: "The moment the threshold is reached, signing rights rotate on-chain. The beneficiary gets full access instantly.", delay: "0.3s" }
                            ].map((screen) => (
                                <div key={screen.num} className="walkthrough-item reveal-walkthrough" style={{ transitionDelay: screen.delay || "0s" }}>
                                    <span className="walkthrough-step-num">{screen.num}</span>
                                    <div className="walkthrough-item-visual">
                                        <div className="phone-frame">
                                            <img src={screen.img} alt={screen.alt} style={{ display: "block", width: "100%", height: "auto", borderRadius: 16 }} />
                                        </div>
                                    </div>
                                    <div className="walkthrough-text">
                                        <strong>{screen.title}</strong>
                                        <p>{screen.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* FEATURES */}
                <section className="features-section">
                    <div className="container">
                        <div className="section-eyebrow label" style={{ marginBottom: "1rem" }}>Core Features</div>
                        <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "3rem", lineHeight: 1.1 }}>Designed for trust.<br />Built without it.</h2>
                        {[
                            { icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><polygon points="14,2 26,8 26,20 14,26 2,20 2,8" stroke="#080808" strokeWidth="1.5" fill="none" /><text x="14" y="17" fontFamily="JetBrains Mono" fontSize="7" fill="#080808" textAnchor="middle">RUST</text></svg>, name: "Native Integration", desc: "Direct implementation on Stellar's L1 through Soroban smart contracts ensuring maximum security." },
                            { icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><rect x="4" y="4" width="20" height="20" rx="2" stroke="#080808" strokeWidth="1.5" /><path d="M8 14l5 5 7-8" stroke="#080808" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>, name: "Zero-Custody", desc: "Assets never leave your wallet. We manage permissions and weights, not private keys or tokens." },
                            { icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="8" cy="14" r="5" stroke="#080808" strokeWidth="1.5" /><circle cx="20" cy="14" r="5" fill="#080808" /><path d="M13 11l4 3-4 2" stroke="#eaeaea" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>, name: "Signer Rotation", desc: "The protocol rotates identity rather than wrapping assets, maintaining trustline integrity." },
                            { icon: <svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="9" cy="14" r="5" stroke="#080808" strokeWidth="1.5" /><circle cx="19" cy="14" r="5" stroke="#080808" strokeWidth="1.5" /><text x="9" y="17" fontFamily="JetBrains Mono" fontSize="5" fill="#080808" textAnchor="middle">XLM</text><text x="19" y="17" fontFamily="JetBrains Mono" fontSize="4.5" fill="#080808" textAnchor="middle">USDC</text></svg>, name: "Multi-Asset Support", desc: "Automatically secures XLM, USDC, and custom Stellar assets within the account scope." }
                        ].map((f, i) => (
                            <div key={i} className="feature-row">
                                <div className="feature-name">{f.icon}{f.name}</div>
                                <div className="feature-desc">{f.desc}</div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ARCHITECTURE */}
                <section className="arch-section container">
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6rem", alignItems: "start", marginBottom: "5rem" }}>
                        <div>
                            <div className="section-eyebrow label" style={{ marginBottom: "1rem" }}>Architecture</div>
                            <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: "1rem", lineHeight: 1 }}>From your wallet<br />to the chain.</h2>
                            <p style={{ color: "#333", fontSize: "0.9rem", lineHeight: 1.7, fontWeight: 500 }}>Every layer is open-source and verifiable. No black boxes, no trust assumptions.</p>
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)" }}>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", border: "1px solid #d0d0d0", padding: "0.4rem 0.9rem", marginBottom: "2rem" }}>
                                <span style={{ width: 5, height: 5, background: "#080808", borderRadius: "50%", display: "inline-block" }} />
                                <span style={{ fontSize: "0.6rem", letterSpacing: "0.15em", color: "#080808", fontWeight: 600 }}>CONTRACT ACTIVE</span>
                            </div>
                            <div style={{ marginBottom: "2rem" }}>
                                <div style={{ fontSize: "0.6rem", letterSpacing: "0.12em", color: "#666", fontWeight: 500, marginBottom: "0.75rem" }}>INACTIVITY TIMER</div>
                                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                    <span id="timer-count" style={{ fontSize: "3.5rem", fontWeight: 800, lineHeight: 1, color: "#080808", fontFamily: "'Inter',sans-serif" }}>177</span>
                                    <span style={{ fontSize: "0.75rem", color: "#444", fontWeight: 500 }}>/ 180 days</span>
                                </div>
                                <div style={{ height: 1, background: "#e0e0e0", width: "100%" }}><div style={{ height: 1, width: "98%", background: "#080808" }} /></div>
                                <div style={{ display: "flex", justifyContent: "space-between", marginTop: "0.5rem" }}>
                                    <span style={{ fontSize: "0.65rem", color: "#666", fontWeight: 500 }}>DAY 0</span>
                                    <span style={{ fontSize: "0.65rem", color: "#222", fontWeight: 600 }}>3 days remaining</span>
                                    <span style={{ fontSize: "0.65rem", color: "#666", fontWeight: 500 }}>DAY 180</span>
                                </div>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, borderTop: "1px solid #e8e8e8" }}>
                                <div style={{ padding: "1rem 1.5rem 1rem 0", borderRight: "1px solid #e8e8e8" }}><div style={{ fontSize: "0.58rem", letterSpacing: "0.12em", color: "#666", fontWeight: 500, marginBottom: "0.4rem" }}>CONTRACT</div><div style={{ fontSize: "0.78rem", color: "#222", fontWeight: 400 }}>G7XWK...9QMR</div></div>
                                <div style={{ padding: "1rem 0 1rem 1.5rem" }}><div style={{ fontSize: "0.58rem", letterSpacing: "0.12em", color: "#666", fontWeight: 500, marginBottom: "0.4rem" }}>BENEFICIARY</div><div style={{ fontSize: "0.78rem", color: "#222", fontWeight: 400 }}>GDQP2...X7FMN</div></div>
                                <div style={{ padding: "1rem 1.5rem 0 0", borderRight: "1px solid #e8e8e8", borderTop: "1px solid #e8e8e8" }}><div style={{ fontSize: "0.58rem", letterSpacing: "0.12em", color: "#666", fontWeight: 500, marginBottom: "0.4rem" }}>LAST TX</div><div style={{ fontSize: "0.78rem", color: "#222", fontWeight: 400 }}>3 days ago</div></div>
                                <div style={{ padding: "1rem 0 0 1.5rem", borderTop: "1px solid #e8e8e8" }}><div style={{ fontSize: "0.58rem", letterSpacing: "0.12em", color: "#666", fontWeight: 500, marginBottom: "0.4rem" }}>LEDGER</div><div style={{ fontSize: "0.78rem", color: "#222", fontWeight: 400 }}>#49382811</div></div>
                            </div>
                        </div>
                    </div>
                    <div style={{ border: "1px solid #d8d8d8", fontFamily: "var(--font-mono)" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr 1fr 1fr", padding: "0.75rem 1.5rem", borderBottom: "1px solid #d8d8d8", background: "#080808" }}>
                            {["LAYER", "COMPONENT", "STACK", "ROLE"].map(h => <span key={h} style={{ fontSize: "0.6rem", letterSpacing: "0.15em", color: "#888", fontWeight: 500 }}>{h}</span>)}
                        </div>
                        {[
                            ["L4 · CLIENT", "FRONTEND", "Next.js · React · WalletConnect", "UI · Auth · Signing"],
                            ["L3 · AGENT", "KEEPER AGENT", "Node.js · Horizon SDK", "Monitor · Timer · Alert"],
                            ["L2 · VM", "SOROBAN VM", "Rust · WASM · Soroban SDK", "State · Auth rotation"],
                            ["L1 · CHAIN", "STELLAR NETWORK", "Horizon API · Ed25519", "<5s finality · Consensus"]
                        ].map((row, i) => (
                            <div key={i} className="arch-layer-row" style={i === 3 ? { borderBottom: "none" } : {}}>
                                <span style={{ fontSize: "0.65rem", color: "#777", fontWeight: 500 }}>{row[0]}</span>
                                <span style={{ fontSize: "0.82rem", fontWeight: 700, color: "#080808" }}>{row[1]}</span>
                                <span style={{ fontSize: "0.75rem", color: "#666", fontWeight: 400 }}>{row[2]}</span>
                                <span style={{ fontSize: "0.75rem", color: "#666", fontWeight: 400 }}>{row[3]}</span>
                            </div>
                        ))}
                    </div>
                </section>

                {/* SPEC */}
                <section className="spec-section">
                    <div className="container">
                        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "3rem" }}>
                            <div>
                                <div className="section-eyebrow label" style={{ marginBottom: "1rem" }}>Technical Specification</div>
                                <h2 style={{ fontSize: "clamp(1.8rem,3vw,2.5rem)", fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>Contract internals.<br />Fully verifiable.</h2>
                            </div>
                            <a href="https://stellar.expert/explorer/testnet/contract/CDZ7TXU2GRFICPM4CWSQEVZBODJHDWWXKBSZWXOONMMLAZTT226PFCBN" target="_blank" rel="noopener noreferrer"
                                style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "#555", textDecoration: "none", border: "1px solid #888", padding: "0.5rem 1rem", letterSpacing: "0.08em", fontWeight: 500, transition: "all 0.2s ease", display: "inline-block" }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = "#080808"; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = "#080808"; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#555"; e.currentTarget.style.borderColor = "#888"; }}
                            >VIEW VERIFIED CONTRACT →</a>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem", alignItems: "start" }}>
                            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono)" }}>
                                <thead><tr style={{ borderBottom: "1px solid #d0d0d0" }}>
                                    {["PARAMETER", "VALUE", "STATE"].map(h => <th key={h} style={{ textAlign: "left" as const, padding: "0.75rem 0", fontSize: "0.6rem", letterSpacing: "0.15em", color: "#888", fontWeight: 500 }}>{h}</th>)}
                                </tr></thead>
                                <tbody>
                                    {[
                                        ["Language", "Rust / Soroban SDK", "● READY"],
                                        ["Auth Scheme", "Ed25519 Native", "● VERIFIED"],
                                        ["Finality", "< 5 seconds", "● OPTIMIZED"],
                                        ["Inactivity Window", "30 – 365+ days", "○ CONFIGURABLE"],
                                        ["Custody Model", "Non-custodial", "● TRUSTLESS"]
                                    ].map((row, i) => (
                                        <tr key={i} style={{ borderBottom: i < 4 ? "1px solid #ebebeb" : "none" }}>
                                            <td style={{ padding: "1rem 0", fontSize: "0.78rem", color: "#666", fontWeight: 400 }}>{row[0]}</td>
                                            <td style={{ padding: "1rem 0", fontSize: "0.78rem", color: "#222", fontWeight: 500 }}>{row[1]}</td>
                                            <td style={{ padding: "1rem 0", fontSize: "0.7rem", fontWeight: 500, color: row[2].startsWith("○") ? "#888" : "#222" }}>{row[2]}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div>
                                <div style={{ fontSize: "0.6rem", letterSpacing: "0.15em", color: "#888", fontWeight: 500, fontFamily: "var(--font-mono)", marginBottom: "2rem" }}>EXECUTION FLOW</div>
                                {[
                                    { label: "01 — THRESHOLD REACHED", title: "Inactivity window expires", sub: "Keeper Agent detects no tx from owner address", time: "T+0" },
                                    { label: "02 — OWNER REVOKED", title: "Owner weight set to 0", sub: "Signing authority removed on Stellar L1", time: "T+1s" },
                                    { label: "03 — ASSETS & RIGHTS TRANSFERRED", title: "All assets & rights move to beneficiary", sub: "Full wallet control — all tokens, NFTs, and signing rights — move to beneficiary address", time: "T+2s" }
                                ].map((s, i) => (
                                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "start", padding: "1.5rem 0", borderTop: "1px solid #d8d8d8" }}>
                                        <div>
                                            <div style={{ fontSize: "0.65rem", fontFamily: "var(--font-mono)", color: "#888", fontWeight: 500, marginBottom: "0.4rem" }}>{s.label}</div>
                                            <div style={{ fontSize: "1rem", fontWeight: 700, color: "#111", letterSpacing: "-0.01em" }}>{s.title}</div>
                                            <div style={{ fontSize: "0.85rem", color: "#666", fontWeight: 400, marginTop: "0.25rem" }}>{s.sub}</div>
                                        </div>
                                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "#999", fontWeight: 500, paddingTop: "0.2rem" }}>{s.time}</div>
                                    </div>
                                ))}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", padding: "1.25rem 1.5rem", borderTop: "1px solid #d8d8d8", background: "#080808" }}>
                                    <div><div style={{ fontSize: "0.9rem", fontWeight: 700, color: "#eaeaea" }}>Transfer complete</div><div style={{ fontSize: "0.78rem", color: "#888", marginTop: "0.15rem", fontFamily: "var(--font-mono)" }}>All assets on beneficiary wallet · No keys accessed · Non-custodial</div></div>
                                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", color: "#888" }}>&lt; 5s</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* CTA */}
                <section className="cta-section">
                    <div className="container" style={{ position: "relative", zIndex: 2 }}>
                        <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
                            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle,rgba(255,255,255,0.04) 0%,transparent 70%)", animation: "glowPulse 4s ease-in-out infinite" }} />
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.65rem", letterSpacing: "0.2em", color: "#b0b0b0", marginBottom: "1.5rem", animation: "fadeIn 0.8s ease both" }}>READY TO DEPLOY</div>
                        <h2 style={{ fontSize: "clamp(1.8rem,4.5vw,3.8rem)", whiteSpace: "nowrap", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1, animation: "floatUp 1s cubic-bezier(0.16,1,0.3,1) 0.1s both" }}>PROTECT YOUR LEGACY</h2>
                        <p style={{ color: "#b0b0b0", fontSize: "1rem", maxWidth: 400, margin: "2rem auto 0", lineHeight: 1.6 }}>Takes 30 seconds. All assets and signing rights transfer to your beneficiary&apos;s wallet. Cancel anytime.</p>
                        <Link href="/freighter-demo" className="cta-btn">ACTIVATE KEEPALIVE</Link>
                    </div>
                </section>

                {/* FOOTER */}
                <footer className="ka-footer container">
                    <div className="footer-grid">
                        <div>
                            <div style={{ fontWeight: 800, fontSize: "1.2rem", marginBottom: "1rem", color: "#080808" }}>KEEPALIVE®</div>
                            <p className="label" style={{ lineHeight: 1.5, color: "#888" }}>Independent research programme dedicated to preserving cryptographic assets beyond lifespan.</p>
                        </div>
                        <div className="footer-col">
                            <h4 className="mono" style={{ fontSize: "0.75rem", letterSpacing: "0.15em", color: "#666", fontWeight: 500, marginBottom: "1.5rem" }}>RESOURCES</h4>
                            <a href="https://github.com/EfuzeGI/KeepAlive-Stellar-" target="_blank" rel="noopener noreferrer">GitHub Repository</a>
                        </div>
                        <div className="footer-col">
                            <h4 className="mono" style={{ fontSize: "0.75rem", letterSpacing: "0.15em", color: "#666", fontWeight: 500, marginBottom: "1.5rem" }}>NETWORK</h4>
                            <div className="mono" style={{ color: "#777", fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.5rem" }}><span className="status-dot"></span> ALL SYSTEMS OPERATIONAL</div>
                            <div className="mono" style={{ marginTop: "0.5rem" }}>
                                <a href="https://stellar.expert/explorer/testnet/contract/CDZ7TXU2GRFICPM4CWSQEVZBODJHDWWXKBSZWXOONMMLAZTT226PFCBN" target="_blank" rel="noopener noreferrer" style={{ display: 'inline', color: "#777" }}>Stellar Expert</a>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
