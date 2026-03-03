"use client";

import { useState, useEffect } from "react";
import { Header, TabId } from "@/components/Header";
import { HeroSection } from "@/components/HeroSection";
import { CreateVault } from "@/components/CreateVault";
import { Dashboard } from "@/components/Dashboard";
import { ArchitecturePage } from "@/components/ArchitecturePage";
import { useStellar } from "@/contexts/StellarContext";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { isConnected, vaultStatus, isSyncing, isLoading } = useStellar();
  const [activeTab, setActiveTab] = useState<TabId>("protocol");

  const hasVault = vaultStatus !== null;

  // Listen for navigation events from HeroSection
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === "dashboard") {
        setActiveTab("dashboard");
      } else if (detail === "architecture") {
        setActiveTab("architecture");
      }
    };
    window.addEventListener("keepalive:navigate", handler);
    return () => window.removeEventListener("keepalive:navigate", handler);
  }, []);

  // Auto-navigate to dashboard on connect
  useEffect(() => {
    if (isConnected && activeTab === "protocol") {
      setActiveTab("dashboard");
    }
  }, [isConnected]);

  // Redirect to home if disconnected while on dashboard
  useEffect(() => {
    if (!isConnected && activeTab === "dashboard") {
      setActiveTab("protocol");
    }
  }, [isConnected, activeTab]);

  const showLoading = isConnected && (isLoading || (isSyncing && !vaultStatus));

  const renderTab = () => {
    if (activeTab === "architecture") return <ArchitecturePage />;

    if (showLoading) {
      return (
        <div className="min-h-[70vh] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-4 h-4 text-[var(--text-dim)] animate-spin" />
            <p className="text-[var(--text-dim)] text-[11px] font-mono">Syncing vault data...</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case "protocol":
        return <HeroSection />;
      case "dashboard":
        // Routing logic: no vault → CreateVault, has vault → Dashboard
        return hasVault ? <Dashboard /> : <CreateVault />;
      default:
        return <HeroSection />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg)' }}>
      <Header activeTab={activeTab} onTabChange={setActiveTab} />
      <main className="flex-1">{renderTab()}</main>
    </div>
  );
}
