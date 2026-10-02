import React, { useState, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function UpdatePassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<"initializing" | "idle" | "loading" | "success" | "error">("initializing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Check if the user is in a recovery session
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      // If we don't have a session, maybe we should listen to onAuthStateChange
      // because Supabase auth might take a split second to exchange the hash in the URL.
      if (!session) {
        const { data: authListener } = supabase.auth.onAuthStateChange((event, newSession) => {
          if (event === "PASSWORD_RECOVERY" || newSession) {
            setStatus("idle");
          }
        });
        
        // Timeout to check again after 2 seconds
        setTimeout(() => {
          supabase.auth.getSession().then(({ data }) => {
            if (!data.session) {
              setStatus((prev) => {
                if (prev === "initializing") {
                  setMessage("Sesi pemulihan tidak valid atau sudah kadaluarsa. Silakan minta link reset yang baru.");
                  return "error";
                }
                return prev;
              });
            }
          });
        }, 2000);

        return () => {
          authListener.subscription.unsubscribe();
        };
      } else {
        setStatus("idle");
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password) {
      setStatus("error");
      setMessage("Password tidak boleh kosong");
      return;
    }

    if (password.length < 6) {
      setStatus("error");
      setMessage("Password minimal 6 karakter");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Konfirmasi password tidak cocok");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        throw error;
      }

      setStatus("success");
      setMessage("Password berhasil diperbarui. Mengarahkan ke halaman masuk...");
      
      // Redirect to sign in after 2 seconds
      setTimeout(() => {
        // Sign out to clear recovery session and force user to log in with new password
        supabase.auth.signOut().then(() => {
          router.push("/signin");
        });
      }, 2000);
      
    } catch (err: any) {
      console.warn("Update Password Error:", err);
      setStatus("error");
      setMessage(err.message || "Gagal memperbarui password. Silakan coba lagi.");
    }
  };

  return (
    <>
      <Head>
        <title>Update Password - SIPARTA</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center relative p-4" style={{ backgroundColor: "var(--background)" }}>
        {/* Background Pattern */}
        <div className="absolute inset-0 z-0 opacity-40 pointer-events-none" style={{ backgroundImage: "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-8 z-10 border" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center space-x-3 mb-6">
            <img src="/logo.png" alt="SIPARTA Logo" className="w-10 h-10 rounded-full" />
            <div>
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>Buat Password Baru</h2>
              <p className="text-xs" style={{ color: "var(--muted)" }}>SIPARTA - Sistem Pintar Deteksi Kimia</p>
            </div>
          </div>

          {status === "initializing" ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="w-8 h-8 border-4 border-teal-500/30 border-t-teal-500 rounded-full animate-spin mb-4" />
              <p className="text-sm" style={{ color: "var(--muted)" }}>Memvalidasi sesi pemulihan...</p>
            </div>
          ) : status === "error" && !password && !confirmPassword && message.includes("kadaluarsa") ? (
            <div className="text-center">
              <p className="text-sm rounded-md px-4 py-3 mb-4 border border-red-500/30 bg-red-500/10 text-red-500">
                {message}
              </p>
              <button 
                onClick={() => router.push("/forgot-password")}
                className="btn-primary w-full text-sm"
              >
                Minta Link Baru
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm mb-4" style={{ color: "var(--muted)" }}>
                Silakan masukkan password baru untuk akun Anda.
              </p>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                  Password Baru
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if(status==="error") setStatus("idle"); }}
                  className="form-input"
                  placeholder="Masukkan password baru"
                  disabled={status === "loading" || status === "success"}
                />
              </div>

              <div>
                <label className="block text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                  Konfirmasi Password Baru
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); if(status==="error") setStatus("idle"); }}
                  className="form-input"
                  placeholder="Ketik ulang password baru"
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
                  "Simpan Password Baru"
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
