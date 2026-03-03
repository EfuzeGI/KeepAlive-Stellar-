"use client";

import { useState, useEffect, useCallback } from "react";
import { useStellar } from "@/contexts/StellarContext";
import { EXPLORER_URL, TIME_CONSTANTS, stroopsToXlm, truncateAddress } from "@/config/stellar";
import * as StellarSdk from "@stellar/stellar-sdk";
import StellarHDWallet from "stellar-hd-wallet";

const { Keypair } = StellarSdk;


//  Freighter Wallet Replica + KeepAlive Integration


type Screen = "home" | "send" | "sendConfirm" | "sending" | "sent" | "history" | "xlmDetail" | "keepalive" | "keepaliveActive" | "wallets" | "settings";

export default function FreighterMockup() {
    const { deploySmartAccount, getBalance } = useStellar();

    // Navigation
    const [screen, setScreen] = useState<Screen>("home");
    const [prevScreen, setPrevScreen] = useState<Screen>("home");

    // Account
    const [isConnected, setIsConnected] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [originalSecretKey, setOriginalSecretKey] = useState(""); // to sign for inherited txs
    const [secretKey, setSecretKey] = useState("");
    const [publicKey, setPublicKey] = useState("");
    const [balanceXlm, setBalanceXlm] = useState("0");
    const [accountName, setAccountName] = useState("Account 1");
    const [inheritedAccounts, setInheritedAccounts] = useState<any[]>([]);
    const [isManagingInherited, setIsManagingInherited] = useState(false);
    const [network, setNetwork] = useState<"testnet" | "mainnet">("testnet");
    const [showNetworkMenu, setShowNetworkMenu] = useState(false);

    // Send
    const [sendTo, setSendTo] = useState("");
    const [sendAmount, setSendAmount] = useState("");
    const [sendMemo, setSendMemo] = useState("");

    // KeepAlive
    const [isConfiguring, setIsConfiguring] = useState(false);
    const [keepAliveActive, setKeepAliveActive] = useState(false);
    const [contractId, setContractId] = useState("");
    const [backupAddress, setBackupAddress] = useState("");
    const [duration, setDuration] = useState("test60");
    const [errorMsg, setErrorMsg] = useState("");

    // History (mock)
    const [txHistory, setTxHistory] = useState<any[]>([]);

    const navigate = (to: Screen) => {
        setPrevScreen(screen);
        setScreen(to);
    };

    const goBack = () => setScreen(prevScreen || "home");


    //  ACCOUNT GENERATION


    const handleGenerateDemo = async () => {
        try {
            setIsGenerating(true);
            setErrorMsg("");
            const kp = Keypair.random();
            setSecretKey(kp.secret());
            setOriginalSecretKey(kp.secret());
            setPublicKey(kp.publicKey());
            const res = await fetch(`https://friendbot.stellar.org?addr=${kp.publicKey()}`);
            if (!res.ok) throw new Error("Friendbot unavailable");
            const bal = await getBalance(kp.publicKey());
            setBalanceXlm(bal);
            setIsConnected(true);
            await fetchInheritedAccounts(kp.publicKey());
        } catch (e: any) {
            setErrorMsg(e.message || "Error");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleConnectKey = async () => {
        try {
            setIsGenerating(true);
            setErrorMsg("");

            let derivedSecret = secretKey.trim();

            // Auto-detect: if input contains spaces, treat as recovery phrase (mnemonic)
            if (derivedSecret.includes(" ")) {
                const words = derivedSecret.split(/\s+/).filter(Boolean);
                if (words.length < 12) {
                    throw new Error("Recovery phrase must be at least 12 words");
                }
                const mnemonic = words.join(" ");
                const wallet = StellarHDWallet.fromMnemonic(mnemonic);
                derivedSecret = wallet.getSecret(0);
            }

            setOriginalSecretKey(derivedSecret);
            setSecretKey(derivedSecret);
            const kp = Keypair.fromSecret(derivedSecret);
            setPublicKey(kp.publicKey());
            const bal = await getBalance(kp.publicKey());
            setBalanceXlm(bal);
            setIsConnected(true);
            await fetchInheritedAccounts(kp.publicKey());
        } catch (e: any) {
            setErrorMsg(e.message || "Invalid key or phrase");
        } finally {
            setIsGenerating(false);
        }
    };

    const fetchInheritedAccounts = async (pubKey: string) => {
        try {
            const keeperUrl = process.env.NEXT_PUBLIC_KEEPER_URL || "http://localhost:3002";
            const res = await fetch(`${keeperUrl}/inherited?address=${pubKey}`).catch(() => null);
            if (res && res.ok) {
                const data = await res.json();
                setInheritedAccounts(data.inherited || []);
            }
        } catch (e) {
            console.warn("Keeper Node not reachable. Inherited accounts fetch skipped.");
        }
    };

    const switchToAccount = async (pub: string, secret: string, name: string, isInherited: boolean) => {
        setIsGenerating(true);
        try {
            setPublicKey(pub);
            setSecretKey(secret); // this is the key used to SIGN
            setAccountName(name);
            setIsManagingInherited(isInherited);
            const bal = await getBalance(pub);
            setBalanceXlm(bal);
            navigate("home");
        } finally {
            setIsGenerating(false);
        }
    };


    //  SEND FLOW


    const handleSendConfirm = () => {
        if (!sendTo || !sendAmount) return;
        navigate("sendConfirm");
    };

    const handleSendExecute = async () => {
        navigate("sending");
        try {
            const kp = Keypair.fromSecret(secretKey); // Beneficiary's secret key
            const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");

            // If managing inherited account, the source account is the inherited public key!
            // But we sign with beneficiary's secret key (kp)
            const sourceAccountPubKey = isManagingInherited ? publicKey : kp.publicKey();
            const account = await server.loadAccount(sourceAccountPubKey);
            const tx = new StellarSdk.TransactionBuilder(account, {
                fee: "100000",
                networkPassphrase: StellarSdk.Networks.TESTNET,
            })
                .addOperation(StellarSdk.Operation.payment({
                    destination: sendTo,
                    asset: StellarSdk.Asset.native(),
                    amount: sendAmount,
                }))
                .setTimeout(30)
                .build();
            tx.sign(kp);
            const result = await server.submitTransaction(tx);
            setTxHistory(prev => [{
                type: "Sent",
                amount: `-${sendAmount} XLM`,
                to: sendTo,
                date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                hash: (result as any).hash,
            }, ...prev]);
            const bal = await getBalance(sourceAccountPubKey);
            setBalanceXlm(bal);
            navigate("sent");
        } catch (e: any) {
            setErrorMsg(e.message);
            navigate("home");
        }
    };


    //  KEEPALIVE ACTIVATION


    const handleEnableProtection = async () => {
        try {
            setIsConfiguring(true);
            setErrorMsg("");
            const timeoutSec = duration === "test60" ? 60 : parseInt(duration) * TIME_CONSTANTS.MONTH;
            const deployedId = await deploySmartAccount(secretKey, backupAddress, timeoutSec);
            setContractId(deployedId);
            setKeepAliveActive(true);
            setTxHistory(prev => [{
                type: "KeepAlive Activated",
                amount: "",
                to: deployedId,
                date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
                hash: "",
            }, ...prev]);
            navigate("keepaliveActive");
        } catch (e: any) {
            setErrorMsg(e.message || "Deployment failed");
        } finally {
            setIsConfiguring(false);
        }
    };

    const formatBalance = (bal: string) => {
        const num = parseFloat(bal);
        return num.toLocaleString("en-US", { minimumFractionDigits: 7, maximumFractionDigits: 7 });
    };

    const durationLabel = (d: string) => {
        if (d === "test60") return "1 Minute (Test)";
        if (d === "1") return "1 Month";
        if (d === "6") return "6 Months";
        if (d === "12") return "1 Year";
        if (d === "24") return "2 Years";
        return d;
    };


    //  ICONS


    const XlmIcon = ({ size = 36 }: { size?: number }) => (
        <div className="rounded-full bg-black border border-[#333] flex items-center justify-center" style={{ width: size, height: size }}>
            <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7V9L12 4L21 9V7L12 2Z" fill="white" />
                <path d="M3 15L12 20L21 15V17L12 22L3 17V15Z" fill="white" />
                <path d="M3 11L12 16L21 11V13L12 18L3 13V11Z" fill="white" />
            </svg>
        </div>
    );

    const GlobeIcon = () => (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
    );


    //  SCREENS


    // --- NOT CONNECTED ---
    if (!isConnected) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #111 0%, #000 100%)' }}>
                <div className="w-[360px] h-[600px] bg-[#1a1a1d] rounded-[16px] overflow-hidden shadow-2xl border border-[#333] flex flex-col items-center justify-center p-6">
                    <div className="w-16 h-16 rounded-full bg-[#2a2a2d] flex items-center justify-center mb-6 border border-[#444]">
                        <XlmIcon size={40} />
                    </div>
                    <h2 className="text-white text-lg font-semibold mb-2">Freighter Wallet</h2>
                    <p className="text-gray-500 text-xs text-center mb-8">Connect or generate a testnet account</p>

                    <button
                        onClick={handleGenerateDemo}
                        disabled={isGenerating}
                        className="w-full bg-white text-black py-3 rounded-full font-semibold text-sm mb-3 hover:bg-gray-100 disabled:opacity-50 transition-all"
                    >
                        {isGenerating ? "Creating..." : "Generate Demo Account"}
                    </button>

                    <div className="w-full flex items-center gap-3 my-3">
                        <div className="flex-1 h-px bg-[#333]" /><span className="text-gray-500 text-xs">or</span><div className="flex-1 h-px bg-[#333]" />
                    </div>

                    <textarea
                        placeholder="Secret Key (S...) or Recovery Phrase (12+ words)"
                        value={secretKey}
                        onChange={(e) => setSecretKey(e.target.value)}
                        rows={2}
                        className="w-full bg-[#2a2a2d] border border-[#444] rounded-xl p-3 text-sm text-white outline-none focus:border-[#666] mb-3 resize-none"
                    />
                    <button
                        onClick={handleConnectKey}
                        disabled={!secretKey || isGenerating}
                        className="w-full border border-[#444] text-white py-3 rounded-full font-semibold text-sm hover:bg-[#2a2a2d] disabled:opacity-30 transition-all"
                    >
                        Connect
                    </button>

                    {errorMsg && <p className="text-red-400 text-xs mt-3 text-center">{errorMsg}</p>}
                </div>
                <div className="absolute top-10 text-center w-full pointer-events-none">
                    <h1 className="text-white/20 text-xs font-mono tracking-widest uppercase">Freighter Extension Concept</h1>
                </div>
            </div>
        );
    }

    // --- HOME ---
    const renderHome = () => (
        <div className="flex flex-col h-full">
            {/* Top Bar */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2">
                    <button className="w-7 h-7 rounded-full bg-[#2a2a2d] flex items-center justify-center text-gray-400 text-xs">•••</button>
                    <button
                        onClick={() => setShowNetworkMenu(!showNetworkMenu)}
                        className="w-7 h-7 rounded-full bg-[#2a2a2d] flex items-center justify-center text-gray-400 relative"
                    >
                        <GlobeIcon />
                    </button>
                </div>
                <button onClick={() => navigate("settings")} className="bg-[#2a2a2d] text-gray-300 text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1 border border-[#444]">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                    Discover
                </button>
            </div>

            {/* Network Menu */}
            {showNetworkMenu && (
                <div className="absolute top-14 left-4 z-50 bg-[#2a2a2d] border border-[#444] rounded-xl p-2 shadow-xl w-44">
                    <button onClick={() => { setNetwork("mainnet"); setShowNetworkMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#333] text-sm text-white">
                        <span className="w-2 h-2 rounded-full bg-green-500" /> Main Net {network === "mainnet" && "✓"}
                    </button>
                    <button onClick={() => { setNetwork("testnet"); setShowNetworkMenu(false); }} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[#333] text-sm text-white">
                        <span className="w-2 h-2 rounded-full bg-purple-500" /> Test Net {network === "testnet" && "✓"}
                    </button>
                    <div className="border-t border-[#444] mt-1 pt-1">
                        <div className="flex items-center gap-2 px-3 py-2 text-sm text-white">
                            <span className="w-2 h-2 rounded-full bg-green-400" /> Connected
                        </div>
                    </div>
                </div>
            )}

            {/* Account Selector */}
            <div className="flex justify-center py-2">
                <button onClick={() => navigate("wallets")} className="flex items-center gap-1.5 text-white text-sm font-medium">
                    <div className={`w-5 h-5 rounded-full ${isManagingInherited ? 'bg-purple-600' : 'bg-green-600'} flex items-center justify-center`}>
                        <span className="text-[8px]">{isManagingInherited ? '👻' : '🐸'}</span>
                    </div>
                    {accountName}
                    {isManagingInherited && <span className="text-[10px] bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded ml-1 border border-purple-500/30">Inherited</span>}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9" /></svg>
                </button>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-center gap-6 py-4">
                {[
                    { icon: "+", label: "Add", action: () => { } },
                    { icon: "↑", label: "Send", action: () => navigate("send") },
                    { icon: "⟳", label: "Swap", action: () => { } },
                    { icon: "◷", label: "History", action: () => navigate("history") },
                ].map((btn) => (
                    <button key={btn.label} onClick={btn.action} className="flex flex-col items-center gap-1.5">
                        <div className="w-10 h-10 rounded-full bg-[#2a2a2d] border border-[#444] flex items-center justify-center text-white text-lg hover:bg-[#333] transition-all">
                            {btn.icon}
                        </div>
                        <span className="text-gray-400 text-[11px]">{btn.label}</span>
                    </button>
                ))}
            </div>

            {/* Tabs */}
            <div className="flex items-center justify-between px-4 border-b border-[#333]">
                <div className="flex gap-5">
                    <button className="text-white text-sm font-medium pb-2 border-b-2 border-white">Tokens</button>
                    <button className="text-gray-500 text-sm pb-2">Collectibles</button>
                </div>
                <button className="text-gray-500">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" /><line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" /><line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" /></svg>
                </button>
            </div>

            {/* Token List */}
            <div className="flex-1 overflow-y-auto">
                <button onClick={() => navigate("xlmDetail")} className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#222] transition-all">
                    <XlmIcon />
                    <div className="flex-1 text-left">
                        <p className="text-white text-sm font-medium">XLM</p>
                        <p className="text-gray-500 text-xs">{formatBalance(balanceXlm)}</p>
                    </div>
                    <span className="text-gray-600 text-sm">—</span>
                </button>
            </div>

            {/* KeepAlive Banner */}
            {!keepAliveActive ? (
                <button
                    onClick={() => navigate("keepalive")}
                    className="mx-4 mb-4 bg-gradient-to-r from-[#1a3a1a] to-[#1a1a1d] border border-green-900/50 rounded-xl p-3 flex items-center gap-3 hover:border-green-700/50 transition-all"
                >
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    </div>
                    <div className="text-left flex-1">
                        <p className="text-white text-xs font-medium">KeepAlive Protection</p>
                        <p className="text-gray-500 text-[10px]">Protect your assets with the Heartbeat Protocol</p>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
            ) : (
                <div className="mx-4 mb-4 bg-[#1a3a1a] border border-green-900/50 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <p className="text-green-400 text-xs font-medium flex-1">KeepAlive Active</p>
                    <button onClick={() => navigate("keepaliveActive")} className="text-green-400 text-xs underline">Details</button>
                </div>
            )}
        </div>
    );

    // --- SEND SCREEN ---
    const renderSend = () => (
        <div className="flex flex-col h-full">
            <div className="flex items-center px-4 pt-4 pb-3">
                <button onClick={goBack} className="text-gray-400"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg></button>
                <h2 className="flex-1 text-center text-white text-base font-medium">Send</h2>
                <div className="w-5" />
            </div>
            <div className="flex-1 px-4 space-y-4">
                <div>
                    <label className="text-gray-400 text-xs mb-1.5 block">Asset</label>
                    <div className="flex items-center gap-2 bg-[#2a2a2d] border border-[#444] rounded-xl p-3">
                        <XlmIcon size={24} />
                        <span className="text-white text-sm">XLM</span>
                    </div>
                </div>
                <div>
                    <label className="text-gray-400 text-xs mb-1.5 block">Amount</label>
                    <input
                        type="number"
                        placeholder="0.00"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        className="w-full bg-[#2a2a2d] border border-[#444] rounded-xl p-3 text-white text-sm outline-none focus:border-[#666]"
                    />
                    <p className="text-gray-500 text-[10px] mt-1">Available: {formatBalance(balanceXlm)} XLM</p>
                </div>
                <div>
                    <label className="text-gray-400 text-xs mb-1.5 block">Destination</label>
                    <input
                        placeholder="G..."
                        value={sendTo}
                        onChange={(e) => setSendTo(e.target.value)}
                        className="w-full bg-[#2a2a2d] border border-[#444] rounded-xl p-3 text-white text-sm outline-none focus:border-[#666] font-mono"
                    />
                </div>
            </div>
            <div className="px-4 pb-4 space-y-2">
                <button
                    onClick={handleSendConfirm}
                    disabled={!sendTo || !sendAmount}
                    className="w-full bg-white text-black py-3 rounded-full font-semibold text-sm disabled:opacity-30 hover:bg-gray-100 transition-all"
                >
                    Continue
                </button>
                <button onClick={goBack} className="w-full border border-[#444] text-white py-3 rounded-full text-sm hover:bg-[#2a2a2d] transition-all">Cancel</button>
            </div>
        </div>
    );

    // --- SEND CONFIRM ---
    const renderSendConfirm = () => (
        <div className="flex flex-col h-full">
            <div className="flex items-center px-4 pt-4 pb-3">
                <button onClick={() => navigate("send")} className="text-gray-400"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg></button>
                <h2 className="flex-1 text-center text-white text-base font-medium">Send</h2>
                <div className="w-5" />
            </div>
            <div className="flex-1 px-4">
                <div className="bg-[#2a2a2d] rounded-xl p-4 space-y-3">
                    <p className="text-gray-400 text-xs">You are sending</p>
                    <div className="flex items-center gap-2">
                        <XlmIcon size={28} />
                        <span className="text-white font-semibold">{sendAmount} XLM</span>
                    </div>
                    <div className="text-gray-500 text-sm">⇣</div>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-[10px]">🐸</div>
                        <span className="text-white text-sm font-mono">{truncateAddress(sendTo)}</span>
                    </div>
                </div>
                <div className="mt-4 bg-[#2a2a2d] rounded-xl divide-y divide-[#444]">
                    <div className="flex justify-between items-center px-4 py-3">
                        <span className="text-gray-400 text-sm flex items-center gap-1.5">📝 Memo</span>
                        <span className="text-gray-300 text-sm">{sendMemo || "None"}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-3">
                        <span className="text-gray-400 text-sm flex items-center gap-1.5">⚡ Fee</span>
                        <span className="text-gray-300 text-sm">0.1 XLM</span>
                    </div>
                </div>
            </div>
            <div className="px-4 pb-4 space-y-2">
                <button onClick={handleSendExecute} className="w-full bg-white text-black py-3 rounded-full font-semibold text-sm hover:bg-gray-100 transition-all">
                    Send to {truncateAddress(sendTo)}
                </button>
                <button onClick={() => navigate("send")} className="w-full border border-[#444] text-white py-3 rounded-full text-sm hover:bg-[#2a2a2d] transition-all">Cancel</button>
            </div>
        </div>
    );

    // --- SENDING ---
    const renderSending = () => (
        <div className="flex flex-col h-full items-center justify-center px-6">
            <div className="animate-spin w-10 h-10 border-2 border-gray-600 border-t-white rounded-full mb-4" />
            <p className="text-white text-lg font-medium mb-6">Sending</p>
            <div className="bg-[#2a2a2d] rounded-xl p-5 w-full text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                    <XlmIcon size={28} />
                    <span className="text-gray-500 text-lg">»</span>
                    <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-[10px]">🐸</div>
                </div>
                <p className="text-white font-semibold">{sendAmount} XLM</p>
                <p className="text-gray-500 text-sm">to</p>
                <p className="text-white font-mono text-sm">{truncateAddress(sendTo)}</p>
            </div>
            <p className="text-gray-500 text-xs text-center mt-8">You can close this screen, your transaction should be complete in less than a minute.</p>
            <button onClick={() => navigate("home")} className="mt-4 border border-[#444] text-white py-2.5 px-8 rounded-full text-sm hover:bg-[#2a2a2d] transition-all">Close</button>
        </div>
    );

    // --- SENT ---
    const renderSent = () => (
        <div className="flex flex-col h-full items-center justify-center px-6">
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <p className="text-white text-lg font-medium mb-6">Sent!</p>
            <div className="bg-[#2a2a2d] rounded-xl p-5 w-full text-center">
                <div className="flex items-center justify-center gap-2 mb-3">
                    <XlmIcon size={28} />
                    <span className="text-gray-500 text-lg">»</span>
                    <div className="w-7 h-7 rounded-full bg-green-600 flex items-center justify-center text-[10px]">🐸</div>
                </div>
                <p className="text-white font-semibold">{sendAmount} XLM</p>
                <p className="text-gray-500 text-sm">was sent to</p>
                <p className="text-white font-mono text-sm font-semibold">{truncateAddress(sendTo)}</p>
            </div>
            <div className="w-full mt-8 space-y-2">
                <button
                    onClick={() => {
                        const hash = txHistory[0]?.hash;
                        if (hash) window.open(`${EXPLORER_URL}/tx/${hash}`, "_blank");
                    }}
                    className="w-full bg-[#2a2a2d] text-white py-3 rounded-full text-sm font-medium hover:bg-[#333] transition-all"
                >
                    View transaction
                </button>
                <button onClick={() => { navigate("home"); setSendTo(""); setSendAmount(""); }} className="w-full border border-[#444] text-white py-3 rounded-full text-sm hover:bg-[#2a2a2d] transition-all">Done</button>
            </div>
        </div>
    );

    // --- XLM DETAIL ---
    const renderXlmDetail = () => (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <button onClick={() => navigate("home")} className="text-gray-400"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
                <h2 className="text-white text-base font-medium">XLM</h2>
                <button className="text-gray-400">•••</button>
            </div>
            <div className="px-4 pt-2">
                <div className="flex items-center gap-3 mb-4">
                    <XlmIcon size={44} />
                    <span className="text-white text-lg">XLM</span>
                </div>
                <div className="bg-[#2a2a2d] rounded-xl divide-y divide-[#444]">
                    <div className="flex justify-between items-center px-4 py-3">
                        <span className="text-gray-400 text-sm">⟳ Balance</span>
                        <span className="text-white text-sm font-medium">{formatBalance(balanceXlm)} XLM</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-3">
                        <span className="text-gray-400 text-sm">💰 Value</span>
                        <span className="text-gray-500 text-sm">—</span>
                    </div>
                </div>
            </div>
            <div className="flex-1 flex items-center justify-center">
                <p className="text-gray-500 text-sm">No transactions to show</p>
            </div>
            <div className="flex gap-3 px-4 pb-4">
                <button onClick={() => navigate("send")} className="flex-1 bg-white text-black py-3 rounded-full font-semibold text-sm hover:bg-gray-100 transition-all">Send</button>
                <button className="flex-1 border border-[#444] text-white py-3 rounded-full font-semibold text-sm hover:bg-[#2a2a2d] transition-all">Swap</button>
            </div>
        </div>
    );

    // --- HISTORY ---
    const renderHistory = () => (
        <div className="flex flex-col h-full">
            <div className="flex items-center px-4 pt-4 pb-3">
                <button onClick={() => navigate("home")} className="text-gray-400"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg></button>
                <h2 className="flex-1 text-center text-white text-base font-medium">History</h2>
                <div className="w-5" />
            </div>
            <div className="flex-1 overflow-y-auto px-4">
                {txHistory.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center mt-10">No transactions yet</p>
                ) : (
                    <>
                        <p className="text-gray-400 text-xs mb-3">{new Date().toLocaleDateString("en-US", { month: "long" })}</p>
                        <div className="space-y-1">
                            {txHistory.map((tx, i) => (
                                <div key={i} className="flex items-center gap-3 py-3 hover:bg-[#222] rounded-lg px-2 -mx-2 transition-all">
                                    <div className="w-9 h-9 rounded-full bg-[#2a2a2d] border border-[#444] flex items-center justify-center text-gray-400">
                                        {tx.type === "Sent" ? "↑" : tx.type === "KeepAlive Activated" ? "🛡" : "⟳"}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-white text-sm">{tx.type === "Sent" ? "Payment" : tx.type}</p>
                                        <p className="text-gray-500 text-[10px]">{tx.type === "Sent" ? "⊙ Sent" : "⊙ Interacted"}</p>
                                    </div>
                                    <div className="text-right">
                                        {tx.amount && <p className={`text-sm font-medium ${tx.amount.startsWith("-") ? "text-white" : "text-green-400"}`}>{tx.amount}</p>}
                                        <p className="text-gray-500 text-[10px]">{tx.date}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    // --- WALLETS ---
    const renderWallets = () => (
        <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <button onClick={() => navigate("home")} className="text-gray-400"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>
                <h2 className="text-white text-base font-medium">Wallets</h2>
                <div className="w-5" />
            </div>
            <div className="flex-1 px-4 overflow-y-auto">
                <p className="text-gray-400 text-xs mb-3 font-medium uppercase tracking-wider">Your Wallets</p>
                <button
                    onClick={() => switchToAccount(Keypair.fromSecret(originalSecretKey).publicKey(), originalSecretKey, "Account 1", false)}
                    className={`w-full flex items-center gap-3 py-3 hover:bg-[#222] rounded-lg px-2 -mx-2 transition-all ${!isManagingInherited ? 'bg-[#222]' : ''}`}
                >
                    <div className="w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-sm">🐸</div>
                    <div className="flex-1 text-left">
                        <p className="text-white text-sm font-medium">Account 1 {!isManagingInherited && "(Active)"}</p>
                        <p className="text-gray-500 text-xs font-mono">{truncateAddress(Keypair.fromSecret(originalSecretKey).publicKey())}</p>
                    </div>
                    {!isManagingInherited && <div className="w-2 h-2 rounded-full bg-green-500" />}
                </button>

                {inheritedAccounts.length > 0 && (
                    <div className="mt-6">
                        <p className="text-purple-400 text-xs mb-3 font-medium uppercase tracking-wider flex items-center gap-1">
                            <span className="text-[10px]">🛡</span> Inherited Accounts
                        </p>
                        <div className="space-y-1">
                            {inheritedAccounts.map((acc, i) => (
                                <button
                                    key={i}
                                    onClick={() => switchToAccount(acc.owner, originalSecretKey, `Legacy ${truncateAddress(acc.owner)}`, true)}
                                    className={`w-full flex items-center gap-3 py-3 hover:bg-[#222] rounded-lg px-2 -mx-2 transition-all border border-purple-900/30 ${isManagingInherited && publicKey === acc.owner ? 'bg-[#2a1a2d] border-purple-500/50' : 'bg-[#1a1a1d]'}`}
                                >
                                    <div className="w-10 h-10 rounded-full bg-purple-900 flex items-center justify-center text-sm border-2 border-purple-500/50">👻</div>
                                    <div className="flex-1 text-left">
                                        <p className="text-white text-sm font-medium">Legacy Wallet</p>
                                        <p className="text-gray-500 text-xs font-mono">{truncateAddress(acc.owner)}</p>
                                    </div>
                                    {isManagingInherited && publicKey === acc.owner && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
            <div className="px-4 pb-4">
                <button className="w-full border border-[#444] text-white py-3 rounded-full text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#2a2a2d] transition-all">
                    ⊕ Add a wallet
                </button>
            </div>
        </div>
    );

    // --- KEEPALIVE SETUP ---
    const renderKeepAlive = () => (
        <div className="flex flex-col h-full">
            <div className="flex items-center px-4 pt-4 pb-3">
                <button onClick={() => navigate("home")} className="text-gray-400"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg></button>
                <h2 className="flex-1 text-center text-white text-base font-medium">KeepAlive Protection</h2>
                <span className="text-[10px] bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full border border-green-500/30">TESTNET</span>
            </div>
            <div className="flex-1 px-4 space-y-4 overflow-y-auto">
                <div className="bg-[#2a2a2d] rounded-xl p-4 border border-[#444]">
                    <p className="text-white text-sm font-medium mb-1">Heartbeat Protocol</p>
                    <p className="text-gray-500 text-xs leading-relaxed">If your account is inactive for the set period, your assets will be automatically transferred to your beneficiary.</p>
                </div>

                <div>
                    <label className="text-gray-400 text-xs mb-1.5 block">Beneficiary Address</label>
                    <input
                        placeholder="G..."
                        value={backupAddress}
                        onChange={(e) => setBackupAddress(e.target.value)}
                        className="w-full bg-[#2a2a2d] border border-[#444] rounded-xl p-3 text-sm text-white outline-none focus:border-green-500/50 font-mono"
                    />
                </div>

                <div>
                    <label className="text-gray-400 text-xs mb-1.5 block">Inactivity Timeout</label>
                    <select
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-full bg-[#2a2a2d] border border-[#444] rounded-xl p-3 text-sm text-white outline-none focus:border-green-500/50 appearance-none"
                    >
                        <option value="test60">⚡ 1 Minute (Test)</option>
                        <option value="1">1 Month</option>
                        <option value="6">6 Months</option>
                        <option value="12">1 Year</option>
                        <option value="24">2 Years</option>
                    </select>
                </div>

                <div className="bg-[#2a2a2d] rounded-xl p-3 border border-[#444]">
                    <div className="flex items-start gap-2">
                        <span className="text-green-400 text-sm mt-0.5">ℹ</span>
                        <p className="text-gray-400 text-[11px] leading-relaxed">
                            Funds stay in your wallet. The smart contract only gets permission to transfer if you&apos;re inactive.
                            Every transaction you make resets the timer. Gas fees are sponsored by the Keeper agent.
                        </p>
                    </div>
                </div>

                {errorMsg && <p className="text-red-400 text-xs text-center bg-red-500/10 p-2 rounded-lg">{errorMsg}</p>}
            </div>
            <div className="px-4 pb-4 space-y-2">
                <button
                    disabled={!backupAddress || backupAddress.length !== 56 || isConfiguring}
                    onClick={handleEnableProtection}
                    className="w-full bg-white text-black py-3 rounded-full font-semibold text-sm disabled:opacity-30 hover:bg-gray-100 transition-all flex items-center justify-center gap-2"
                >
                    {isConfiguring ? (
                        <><span className="animate-spin">⟳</span> Deploying...</>
                    ) : (
                        "Enable Protection"
                    )}
                </button>
                <button onClick={() => navigate("home")} className="w-full border border-[#444] text-white py-3 rounded-full text-sm hover:bg-[#2a2a2d] transition-all">Cancel</button>
            </div>
        </div>
    );

    // --- KEEPALIVE ACTIVE ---
    const renderKeepAliveActive = () => (
        <div className="flex flex-col h-full">
            <div className="flex items-center px-4 pt-4 pb-3">
                <button onClick={() => navigate("home")} className="text-gray-400"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg></button>
                <h2 className="flex-1 text-center text-white text-base font-medium">KeepAlive Status</h2>
                <div className="w-5" />
            </div>
            <div className="flex-1 px-4 flex flex-col items-center pt-6">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mb-4 relative">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-[#1a1a1d]" />
                </div>
                <p className="text-white text-lg font-medium mb-1">Protection Active</p>
                <p className="text-green-400 text-xs mb-6">Smart Account deployed to Testnet</p>

                <div className="w-full bg-[#2a2a2d] rounded-xl divide-y divide-[#444]">
                    <div className="flex justify-between items-center px-4 py-3">
                        <span className="text-gray-400 text-sm">Contract</span>
                        <span className="text-white text-xs font-mono">{truncateAddress(contractId)}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-3">
                        <span className="text-gray-400 text-sm">Beneficiary</span>
                        <span className="text-white text-xs font-mono">{truncateAddress(backupAddress)}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-3">
                        <span className="text-gray-400 text-sm">Timeout</span>
                        <span className="text-white text-sm">{durationLabel(duration)}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-3">
                        <span className="text-gray-400 text-sm">Status</span>
                        <span className="text-green-400 text-sm flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                            Monitoring
                        </span>
                    </div>
                </div>

                <a
                    href={`${EXPLORER_URL}/contract/${contractId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-green-400 text-xs mt-4 hover:underline"
                >
                    View on Stellar Expert ↗
                </a>
            </div>
            <div className="px-4 pb-4">
                <button onClick={() => navigate("home")} className="w-full border border-[#444] text-white py-3 rounded-full text-sm hover:bg-[#2a2a2d] transition-all">Back to Wallet</button>
            </div>
        </div>
    );


    //  MAIN RENDER


    const screenMap: Record<Screen, () => JSX.Element> = {
        home: renderHome,
        send: renderSend,
        sendConfirm: renderSendConfirm,
        sending: renderSending,
        sent: renderSent,
        history: renderHistory,
        xlmDetail: renderXlmDetail,
        keepalive: renderKeepAlive,
        keepaliveActive: renderKeepAliveActive,
        wallets: renderWallets,
        settings: renderHome, // placeholder
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4" style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, #111 0%, #000 100%)' }}>
            <div className="w-[360px] h-[600px] bg-[#1a1a1d] rounded-[16px] overflow-hidden shadow-2xl border border-[#333] relative flex flex-col">
                {screenMap[screen]()}
            </div>
            <div className="absolute top-10 text-center w-full pointer-events-none">
                <h1 className="text-white/20 text-xs font-mono tracking-widest uppercase">Freighter Extension Concept</h1>
            </div>
        </div>
    );
}
