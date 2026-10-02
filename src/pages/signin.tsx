"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");
  const { loginWithGoogle, loginWithEmail, authenticationStatus, error: authError } = useAuth();

  useEffect(() => {
    if (authenticationStatus === "authenticated") {
      router.push("/");
    }
  }, [authenticationStatus, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password) {
      setLocalError("Email dan password harus diisi.");
      return;
    }

    // Call Supabase auth via AuthContext instead of local storage
    await loginWithEmail(email, password);
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-10rem)] max-w-5xl items-center gap-8 py-8 lg:grid-cols-[0.92fr_1fr]">
      <div className="hidden lg:block">
        <p className="section-kicker">Akses pengguna</p>
        <h1 className="section-title mt-3">Masuk ke SIPARTA</h1>
        <p className="mt-4 max-w-md leading-7" style={{ color: "var(--muted)" }}>
          Gunakan akun yang sudah dibuat untuk kembali ke Sistem Pintar Deteksi Kimia Rumah
          Tangga.
        </p>
        <div className="mt-6 soft-panel p-5">
          <p className="text-sm font-bold" style={{ color: "var(--section-title)" }}>
            Pemeriksaan cepat
          </p>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
            Cek risiko campuran bahan pembersih dengan informasi yang singkat dan mudah dibaca.
          </p>
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
      </div>

      <div className="desktop-panel p-7">
        <div className="mb-6 flex items-center gap-3">
          <span className="brand-mark relative flex h-12 w-12 items-center justify-center rounded-lg">
            <Image src="/logo.png" alt="SIPARTA" width={38} height={38} className="object-contain" priority />
          </span>
          <div>
            <h2 className="text-2xl font-extrabold" style={{ color: "var(--section-title)" }}>
              Masuk
            </h2>
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              SIPARTA - Sistem Pintar Deteksi Kimia Rumah Tangga
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setLocalError(""); }}
              className="form-input"
              placeholder="nama@email.com"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                Password
              </label>
            </div>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setLocalError(""); }}
              className="form-input"
              placeholder="Masukkan password"
            />
            <Link href="/forgot-password" className="text-sm font-semibold hover:underline" style={{ color: "var(--teal-600)" }}>
              Lupa Password?
            </Link>
          </div>

          {(localError || authError) && (
            <p className="text-sm rounded-md px-4 py-2.5 border border-red-500/30 bg-red-500/10 text-red-500">
              {localError || authError}
            </p>
          )}

          <button type="submit" className="btn-primary w-full text-sm">
            Masuk
          </button>
        </form>

        <div className="mt-6 pt-5 border-t space-y-2" style={{ borderColor: "var(--border-soft)" }}>
          <Link
            href="/metamask"
            className="w-full flex items-center justify-center gap-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 p-2 rounded-md text-sm shadow-sm transition-colors"
          >
            <svg className="w-5 h-5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
              <path d="M18 12h2" />
            </svg>
            Masuk dengan MetaMask
          </Link>
          <button
            onClick={loginWithGoogle}
            type="button"
            className="w-full flex items-center justify-center gap-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 p-2 rounded-md text-sm shadow-sm transition-colors"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" />
            </svg>
            Masuk dengan Google
          </button>
          <div className="pt-2 flex justify-center items-center gap-1 text-sm" style={{ color: "var(--muted)" }}>
            <span>Belum punya akun?</span>
            <Link href="/signup" className="font-semibold hover:underline" style={{ color: "var(--teal-600)" }}>
              Daftar Sekarang
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}