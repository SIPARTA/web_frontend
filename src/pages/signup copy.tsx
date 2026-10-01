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

export default function SignUpPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const { walletStatus, authenticationStatus, databaseSyncStatus, login, loginWithGoogle, loginWithEmail, signUpWithEmail, error } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    await signUpWithEmail(name, email, password);
  };

  useEffect(() => {
    if (authenticationStatus === "authenticated") {
      router.push("/");
    }
  }, [authenticationStatus, router]);

  return (
    <div className="mx-auto max-w-5xl py-8 min-h-[calc(100vh-10rem)] flex items-center">
      <div className="grid gap-8 lg:grid-cols-[0.82fr_1fr] w-full">
        <div className="flex flex-col justify-center">
          <p className="section-kicker">Akses Web3 SIPARTA</p>
          <h1 className="section-title mt-3 mb-4">Daftar Akun Baru</h1>
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
                    <p className="font-mono text-[10px] truncate mt-2 opacity-70" style={{ color: "var(--section-title)" }}>
                      {account.address}
                    </p>
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
                    <b>User Biasa:</b> Gunakan "Lanjutkan dengan Google" untuk masuk dengan cepat tanpa dompet kripto.
                  </li>
                  <li className="text-sm leading-6" style={{ color: "var(--muted)" }}>
                    <b>Admin / Operator Web3:</b> Gunakan MetaMask untuk validasi transaksi di jaringan Polygon.
                  </li>
                </ul>
              </div>
            </div>

            <div className="soft-panel p-5 flex flex-col justify-center gap-4">
              {/* EMAIL AUTH FORM */}
              <form onSubmit={handleEmailAuth} className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Nama Lengkap"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="p-2 border rounded-md text-sm bg-white dark:bg-gray-800 dark:border-gray-700"
                />
                <input
                  type="email"
                  placeholder="Alamat Email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="p-2 border rounded-md text-sm bg-white dark:bg-gray-800 dark:border-gray-700"
                />
                <input
                  type="password"
                  placeholder="Password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="p-2 border rounded-md text-sm bg-white dark:bg-gray-800 dark:border-gray-700"
                />

                <button type="submit" className="btn-primary w-full shadow-sm text-sm py-2">
                  Daftar dengan Email
                </button>
              </form>

              <div className="text-center">
                <Link
                  href="/signin"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Sudah punya akun? Masuk di sini
                </Link>
              </div>

              <div className="flex items-center gap-4 my-2">
                <div className="flex-1 border-t border-gray-200 dark:border-gray-700"></div>
                <span className="text-xs uppercase font-semibold text-gray-400">ATAU</span>
                <div className="flex-1 border-t border-gray-200 dark:border-gray-700"></div>
              </div>

              <button
                onClick={loginWithGoogle}
                type="button"
                className="w-full flex items-center justify-center gap-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 p-2 rounded-md text-sm shadow-sm transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" />
                </svg>
                Lanjutkan dengan Google
              </button>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
