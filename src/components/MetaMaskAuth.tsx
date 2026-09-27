"use client";

import { createThirdwebClient } from "thirdweb";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createWallet } from "thirdweb/wallets";
import { polygonAmoy } from "thirdweb/chains";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useAuth } from "../context/AuthContext";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
const hasThirdwebClientId = Boolean(clientId && clientId !== "your_client_id_here");
const client = clientId && clientId !== "your_client_id_here" ? createThirdwebClient({ clientId }) : undefined;

const wallets = [createWallet("io.metamask")];

export default function MetaMaskAuth() {
  const router = useRouter();
  const { walletStatus, authenticationStatus, databaseSyncStatus, user, error, login, logout } = useAuth();

  useEffect(() => {
    if (walletStatus === "connected" && authenticationStatus === "unauthenticated") {
      login();
    }
  }, [walletStatus, authenticationStatus]);

  if (!hasThirdwebClientId || !client) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="glass-card max-w-md p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4" style={{ color: "var(--section-title)" }}>
            Konfigurasi Thirdweb belum lengkap
          </h2>
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
            Tambahkan <code className="rounded bg-black/10 px-2 py-1">NEXT_PUBLIC_THIRDWEB_CLIENT_ID</code> ke file <code className="rounded bg-black/10 px-2 py-1">.env.local</code>.
          </p>
          <p className="text-xs" style={{ color: "var(--muted)" }}>
            Aplikasi tetap bisa digunakan dengan akun email.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <ConnectButton
        client={client}
        wallets={wallets}
        chain={polygonAmoy}
        connectButton={{
          label: "Hubungkan MetaMask",
          className: "btn-primary",
        }}
        appMetadata={{
          name: "SIPARTA",
          url: "https://siparta.example.com",
        }}
      />
      <div className="text-sm p-4 rounded-lg bg-black/5 w-full mt-4 text-left border border-gray-200 dark:border-gray-800">
        <h3 className="font-semibold mb-2">Status Koneksi</h3>
        <ul className="space-y-1">
          <li className="flex items-center justify-between">
            <span>Wallet:</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${walletStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
              {walletStatus}
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span>Authentication:</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${authenticationStatus === 'authenticated' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
              {authenticationStatus}
            </span>
          </li>
          <li className="flex items-center justify-between">
            <span>Database Sync:</span>
            <span className={`px-2 py-1 rounded text-xs font-medium ${databaseSyncStatus === 'synchronized' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
              {databaseSyncStatus}
            </span>
          </li>
        </ul>
        {error && (
          <div className="mt-3 p-2 bg-red-50 text-red-600 rounded text-xs">
            <strong>Error:</strong> {error}
          </div>
        )}
      </div>
      
      {authenticationStatus === 'authenticated' && (
        <button 
          onClick={() => router.push("/")}
          className="btn-primary w-full mt-2 py-2 text-sm"
        >
          Lanjut ke Dashboard
        </button>
      )}
    </div>
  );
}
