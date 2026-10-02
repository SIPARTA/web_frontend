"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const { signUpWithEmail, loginWithGoogle, authenticationStatus, error: authError } = useAuth();

  useEffect(() => {
    if (authenticationStatus === "authenticated") {
      router.push("/");
    }
  }, [authenticationStatus, router]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email || !password || !confirmPassword) {
      setLocalError("Semua field harus diisi.");
      return;
    }
    if (password.length < 8) {
      setLocalError("Password minimal 8 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("Password dan konfirmasi password tidak cocok.");
      return;
    }

    // Pass a default name since the new UI design removed the name field
    await signUpWithEmail("SIPARTA User", email, password);
  };

  return (
    <div className="mx-auto max-w-5xl py-8">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1fr]">
        <div className="flex flex-col justify-center">
          <p className="section-kicker">Registrasi</p>
          <h1 className="section-title mt-3 mb-4">Buat akun SIPARTA</h1>
          <p className="leading-7 mb-6 max-w-md" style={{ color: "var(--muted)" }}>
            Gunakan akun email untuk menyimpan akses Sistem Pintar Deteksi Kimia Rumah Tangga.
            MetaMask tetap tersedia sebagai opsi tambahan untuk alur Web3.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Akses", value: "Akun email" },
              { label: "Data", value: "Tersimpan lokal" },
            ].map((item) => (
              <div key={item.label} className="rounded-md border p-4" style={{ background: "var(--surface-soft)", borderColor: "var(--border-soft)" }}>
                <p className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>
                  {item.label}
                </p>
                <p className="font-semibold text-sm" style={{ color: "var(--section-title)" }}>
                  {item.value}
                </p>
              </div>
            ))}
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

        <div className="desktop-panel p-7">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="eyebrow">Akun baru</span>
              <h2 className="text-xl font-extrabold mt-3" style={{ color: "var(--section-title)" }}>
                Daftar dengan email
              </h2>
            </div>
            <span className="brand-mark relative flex h-12 w-12 items-center justify-center rounded-lg">
              <Image src="/logo.png" alt="SIPARTA" width={38} height={38} className="object-contain" />
            </span>
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
              <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setLocalError(""); }}
                className="form-input"
                placeholder="Minimal 8 karakter"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                Konfirmasi password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setLocalError(""); }}
                className="form-input"
                placeholder="Ulangi password"
              />
            </div>

            {(localError || authError) && (
              <p className="text-sm rounded-md px-4 py-2.5 border border-red-500/30 bg-red-500/10 text-red-500">
                {localError || authError}
              </p>
            )}

            <button type="submit" className="btn-primary w-full text-sm">
              Buat akun
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
              Daftar dengan MetaMask
            </Link>
            <button
              onClick={loginWithGoogle}
              type="button"
              className="w-full flex items-center justify-center gap-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 p-2 rounded-md text-sm shadow-sm transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M21.35,11.1H12.18V13.83H18.69C18.36,17.64 15.19,19.27 12.19,19.27C8.36,19.27 5,16.25 5,12C5,7.9 8.2,4.73 12.2,4.73C15.29,4.73 17.1,6.7 17.1,6.7L19,4.72C19,4.72 16.56,2 12.1,2C6.42,2 2.03,6.8 2.03,12C2.03,17.05 6.16,22 12.25,22C17.6,22 21.5,18.33 21.5,12.91C21.5,11.76 21.35,11.1 21.35,11.1V11.1Z" />
              </svg>
              Daftar dengan Google
            </button>
            <div className="pt-2 flex justify-center items-center gap-1 text-sm" style={{ color: "var(--muted)" }}>
              <span>Sudah punya akun?</span>
              <Link href="/signin" className="font-semibold hover:underline" style={{ color: "var(--teal-600)" }}>
                Masuk
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}