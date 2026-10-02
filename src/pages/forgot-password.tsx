import React, { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setStatus("error");
      setMessage("Email tidak boleh kosong");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setStatus("error");
      setMessage("Format email tidak valid");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        throw error;
      }

      setStatus("success");
      setMessage("Jika email terdaftar, link reset password akan dikirim ke email tersebut.");
    } catch (err: any) {
      console.warn("Forgot Password Error:", err);
      // Don't leak if email doesn't exist. Usually Supabase handles this natively,
      // but if an error is thrown, we can either show it if it's rate limit or something else, 
      // or show the generic message if it's a generic failure. 
      // For security, if it's not a rate limit, show the generic success to avoid enumeration.
      if (err.message && err.message.includes("rate limit")) {
        setStatus("error");
        setMessage("Terlalu banyak permintaan. Silakan coba lagi nanti.");
      } else {
        setStatus("success");
        setMessage("Jika email terdaftar, link reset password akan dikirim ke email tersebut.");
      }
    }
  };

  return (
    <>
      <Head>
        <title>Lupa Password - SIPARTA</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center relative p-4" style={{ backgroundColor: "var(--background)" }}>
        {/* Background Pattern */}
        <div className="absolute inset-0 z-0 opacity-40 pointer-events-none" style={{ backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 z-10 border" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center space-x-3 mb-6">
            <img src="/logo.png" alt="SIPARTA Logo" className="w-10 h-10 rounded-full" />
            <div>
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Lupa Password</h2>
              <p className="text-xs" style={{ color: "var(--muted)" }}>SIPARTA - Sistem Pintar Deteksi Kimia</p>
            </div>
          </div>

          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
            Masukkan alamat email yang terdaftar. Kami akan mengirimkan link untuk mengatur ulang password Anda.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setStatus("idle"); setMessage(""); }}
                className="form-input"
                placeholder="nama@email.com"
                disabled={status === "loading" || status === "success"}
              />
            </div>

            {status === "error" && (
              <p className="text-sm rounded-md px-4 py-2.5 border border-red-500/30 bg-red-500/10 text-red-500">
                {message}
              </p>
            )}

            {status === "success" && (
              <p className="text-sm rounded-md px-4 py-2.5 border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400">
                {message}
              </p>
            )}

            <button 
              type="submit" 
              className="btn-primary w-full text-sm flex justify-center items-center h-10"
              disabled={status === "loading" || status === "success"}
            >
              {status === "loading" ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "Kirim Link Reset Password"
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t text-center" style={{ borderColor: "var(--border-soft)" }}>
            <Link href="/signin" className="text-sm font-medium hover:underline" style={{ color: "var(--teal-600)" }}>
              Kembali ke Halaman Masuk
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
