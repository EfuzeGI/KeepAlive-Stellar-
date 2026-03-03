import type { Metadata } from "next";
import "./globals.css";
import { StellarProvider } from "@/contexts/StellarContext";

export const metadata: Metadata = {
  title: "KeepAlive Protocol — Eliminate the Bus Factor",
  description: "Non-custodial Smart Contract Factory on Stellar Soroban. Deploy isolated fallback vaults for DAO treasuries and DeFi protocols.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#06141B] text-[#CCD0CF] antialiased">
        <StellarProvider>
          {children}
        </StellarProvider>
      </body>
    </html>
  );
}
