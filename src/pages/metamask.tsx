"use client";

import Image from "next/image";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { createThirdwebClient } from "thirdweb";
import { polygonAmoy } from "thirdweb/chains";

import { useAuth } from "../context/AuthContext";

const clientId = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;
const client = clientId && clientId !== "your_client_id_here" ? createThirdwebClient({ clientId }) : undefined;

const benefits = [
  "Masuk secara instan dengan wallet Web3 tanpa password.",
  "Integrasi langsung ke Polygon Amoy untuk validasi transaksi.",
  "Aman dengan enkripsi Sign-In with Ethereum (SIWE).",
];

export default function SignInPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const { walletStatus, authenticationStatus, authMethod, databaseSyncStatus, login, loginWithGoogle, loginWithEmail, signUpWithEmail, error, user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    await loginWithEmail(email, password);
  };

  useEffect(() => {
    if (authenticationStatus === "authenticated") {
      if (authMethod === "metamask_siwe" && account?.address && user?.wallet_address === account.address) {
        router.push("/");
      }
    }
  }, [authenticationStatus, authMethod, router, account, user]);

  return (
    <div className="mx-auto max-w-5xl py-8 min-h-[calc(100vh-10rem)] flex items-center">
      <div className="grid gap-8 lg:grid-cols-[0.82fr_1fr] w-full">
        <div className="flex flex-col justify-center">
          <p className="section-kicker">Akses Web3 SIPARTA</p>
          <h1 className="section-title mt-3 mb-4">Masuk ke Sistem</h1>
          <p className="leading-7 max-w-md" style={{ color: "var(--muted)" }}>
            SIPARTA kini terintegrasi penuh dengan blockchain Polygon.
            Gunakan MetaMask untuk masuk secara aman sebagai admin atau end user.
          </p>
        </div>

        <div className="desktop-panel p-6">
          <div className="mb-6 flex items-center justify-between gap-5">
            <div>
              <p className="text-sm font-extrabold" style={{ color: "var(--section-title)" }}>
                Autentikasi Terpadu
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
                Pilih metode masuk ke SIPARTA
              </p>
            </div>
            <span className="brand-mark relative flex h-12 w-12 items-center justify-center rounded-lg">
              <Image src="/logo.png" alt="SIPARTA" width={38} height={38} className="object-contain" />
            </span>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <div className="module-card">
                <p className="text-xs uppercase tracking-widest font-semibold mb-3" style={{ color: "var(--muted)" }}>
                  Status Koneksi
                </p>
                {account ? (
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: "var(--muted)" }}>Wallet</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${walletStatus === 'connected' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {walletStatus}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: "var(--muted)" }}>Verifikasi (SIWE)</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${authenticationStatus === 'authenticated' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                        {authenticationStatus}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs" style={{ color: "var(--muted)" }}>Database Sync</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${databaseSyncStatus === 'synchronized' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                        {databaseSyncStatus}
                      </span>
                    </div>
                    {error && (
                      <p className="text-xs text-red-600 mt-2 p-1 bg-red-50 rounded border border-red-100">
                        Error: {error}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <p className="font-mono text-[10px] truncate opacity-70" style={{ color: "var(--section-title)" }}>
                        {account.address}
                      </p>
                      <button 
                        onClick={() => navigator.clipboard.writeText(account.address)}
                        className="text-[10px] px-2 py-0.5 rounded cursor-pointer border"
                        style={{ borderColor: "var(--teal-500)", color: "var(--teal-600)" }}
                        title="Salin alamat"
                      >
                        Salin
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs mb-1" style={{ color: "var(--muted)" }}>Belum terhubung</p>
                    <p className="font-semibold text-sm" style={{ color: "var(--section-title)" }}>
                      Hubungkan wallet untuk masuk.
                    </p>
                  </div>
                )}
              </div>

              <div className="module-card">
                <p className="text-sm font-semibold mb-3" style={{ color: "var(--section-title)" }}>
                  Cara Masuk
                </p>
                <ul className="space-y-2.5">
                  <li className="text-sm leading-6" style={{ color: "var(--muted)" }}>
                    <b>User Konvensional:</b> Silakan gunakan halaman <Link href="/signin" className="text-teal-600 underline">Sign In</Link> jika Anda ingin masuk menggunakan Email atau Google OAuth.
                  </li>
                  <li className="text-sm leading-6" style={{ color: "var(--muted)" }}>
                    <b>Web3:</b> Gunakan MetaMask untuk masuk ke akun Web3 Anda dan mengakses fitur transaksi blockchain.
                  </li>
                </ul>
              </div>
            </div>

            <div className="soft-panel p-5 flex flex-col justify-center gap-4">
              {/* EMAIL AUTH FORM */}
              {client ? (
                <>
                  <ConnectButton
                    client={client}
                    chain={polygonAmoy}
                    connectButton={{
                      label: account ? "Terhubung" : "Lanjutkan dengan MetaMask",
                      className: "w-full text-sm",
                    }}
                  />

                  {walletStatus === "connected" && (
                    <div className="mt-2 flex flex-col gap-2">
                      {(authenticationStatus === "unauthenticated") && (
                        <button
                          onClick={login}
                          className="btn-primary w-full shadow-lg text-sm py-2"
                          style={{ backgroundColor: "var(--teal-600)" }}
                        >
                          Verifikasi & Masuk (SIWE)
                        </button>
                      )}
                      

                    </div>
                  )}

                  {authenticationStatus === "authenticating" && (
                    <div className="mt-2 p-3 text-center border rounded-md" style={{ borderColor: "var(--teal-500)", backgroundColor: "rgba(13, 148, 136, 0.1)" }}>
                      <p className="text-sm font-medium text-teal-700 dark:text-teal-400">
                        Memproses Autentikasi...
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="rounded-md border border-orange-500/30 bg-orange-500/10 p-5 text-sm text-orange-700">
                  <p className="font-semibold mb-2">Thirdweb Client ID belum dikonfigurasi.</p>
                  <p className="leading-6 opacity-80">
                    Tambahkan <code className="rounded px-1.5 py-0.5 bg-black/10">NEXT_PUBLIC_THIRDWEB_CLIENT_ID</code> di{" "}
                    <code className="rounded px-1.5 py-0.5 bg-black/10">.env.local</code>.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
