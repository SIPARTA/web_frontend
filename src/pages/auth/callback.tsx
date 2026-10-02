import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const isProcessing = useRef(false);

  useEffect(() => {
    async function processAuth() {
      if (isProcessing.current) return;
      isProcessing.current = true;

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;
        
        if (!session) {
          throw new Error("Sesi Google tidak ditemukan");
        }

        // Send token to our unified backend API
        const response = await fetch("/api/auth/google", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: session.access_token }),
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || "Gagal sinkronisasi data user");
        }

        const data = await response.json();
        
        if (data.success && data.user) {
          // Set unified session
          localStorage.setItem("siparta_web3_user", JSON.stringify(data.user));
          
          // Redirect to home
          router.push("/");
        } else {
          throw new Error("Data user tidak valid");
        }
      } catch (err: any) {
        console.error("Callback Error:", err);
        setError(err.message || "Terjadi kesalahan saat memproses login");
      }
    }

    processAuth();
  }, [router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        {error ? (
          <div className="bg-red-50 text-red-600 p-4 rounded-md border border-red-200">
            <h3 className="font-bold mb-2">Gagal Masuk</h3>
            <p>{error}</p>
            <button 
              onClick={() => router.push("/signin")}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded shadow"
            >
              Kembali ke Halaman Sign In
            </button>
          </div>
        ) : (
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600 font-medium">Memverifikasi akun Google Anda...</p>
          </div>
        )}
      </div>
    </div>
  );
}
