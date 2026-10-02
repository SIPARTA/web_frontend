import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { getAuthenticatedUser } from "../lib/auth";
import type { GetServerSideProps } from "next";

interface TransactionDetail {
  type: string;
  severity: string;
  deviceName?: string;
}

interface TransactionLog {
  id: string;
  tx_hash: string | null;
  status: "PENDING" | "SUCCESS" | "FAILED";
  entity_type: string;
  entity_id: string;
  created_at: string;
  retry_count: number;
  details?: TransactionDetail;
  ownerAddress?: string | null;
  network: string;
}

function truncateHash(hash: string) {
  if (!hash) return "";
  return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit"
  });
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const user = getAuthenticatedUser(context.req as any);
  if (!user) {
    return {
      redirect: {
        destination: "/signin",
        permanent: false,
      },
    };
  }
  return { props: {} };
};

export default function TransactionsPage() {
  const { user, authenticationStatus } = useAuth();
  const [transactions, setTransactions] = useState<TransactionLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const router = useRouter();

  useEffect(() => {
    if (authenticationStatus === "unauthenticated") {
      router.push("/signin");
    }
  }, [authenticationStatus, router]);

  const fetchTransactions = useCallback(async () => {
    if (authenticationStatus !== "authenticated") {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`/api/transactions?address=${user?.wallet_address || ''}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTransactions(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Gagal memuat histori transaksi.");
    } finally {
      setLoading(false);
    }
  }, [user, authenticationStatus]);

  useEffect(() => {
    fetchTransactions();
    
    // Auto refresh every 15 seconds
    const interval = setInterval(() => {
      fetchTransactions();
    }, 15000);
    
    return () => clearInterval(interval);
  }, [fetchTransactions]);

  if (authenticationStatus === "initializing" || authenticationStatus === "authenticating") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-sm" style={{ color: "var(--muted)" }}>Memeriksa status autentikasi...</p>
      </div>
    );
  }

  if (authenticationStatus === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--section-title)" }}>Akses Ditolak</h2>
        <p className="mb-6 text-sm text-center max-w-md" style={{ color: "var(--muted)" }}>
          Fitur Transaksi membutuhkan autentikasi MetaMask. Silakan login terlebih dahulu untuk mengakses histori transaksi.
        </p>
        <Link href="/signin" className="btn-primary">Masuk ke SIPARTA</Link>
      </div>
    );
  }

  const isPremium = user?.wallet_address?.startsWith("0x");

  if (!isPremium) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <h2 className="text-xl font-bold mb-4" style={{ color: "var(--section-title)" }}>Akun Standard (Web2)</h2>
        <p className="mb-6 text-sm text-center max-w-md" style={{ color: "var(--muted)" }}>
          Fitur Transaksi Web3 dan log blockchain khusus untuk pengguna Premium yang terhubung dengan dompet kripto (MetaMask). 
          Akun Google/Email Anda saat ini merupakan akun Standard.
        </p>
        <Link href="/metamask" className="btn-primary">Upgrade ke Premium / Hubungkan Wallet</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">Blockchain Logs</div>
          <h1 className="hero-title mt-2 text-3xl">Histori Transaksi</h1>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
            Catatan on-chain untuk insiden yang dilaporkan ke jaringan Polygon Amoy.
          </p>
        </div>
        <div>
          <button onClick={fetchTransactions} className="btn-secondary text-xs">
            Refresh Data
          </button>
        </div>
      </section>

      {/* List */}
      {loading && transactions.length === 0 ? (
        <div className="soft-panel py-12 text-center text-sm" style={{ color: "var(--muted)" }}>
          Memuat histori transaksi...
        </div>
      ) : error ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-700">
          <p className="font-semibold mb-1">Gagal memuat histori transaksi</p>
          <p className="opacity-80">{error}</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="soft-panel py-12 text-center">
          <p className="text-sm font-semibold" style={{ color: "var(--section-title)" }}>Belum ada histori transaksi</p>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Tidak ada transaksi blockchain yang terkait dengan akun ini.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border-soft)", background: "var(--surface)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-[var(--surface-soft)] text-xs uppercase" style={{ borderColor: "var(--border-soft)", color: "var(--muted)" }}>
                <tr>
                  <th className="px-6 py-4 font-semibold">Transaksi & Jaringan</th>
                  <th className="px-6 py-4 font-semibold">Tipe Insiden</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Waktu Tercatat</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ divideColor: "var(--border-soft)" }}>
                {transactions.map((tx) => (
                  <tr key={tx.id} className="transition-colors hover:bg-[var(--surface-soft)]">
                    <td className="px-6 py-4">
                      {tx.tx_hash ? (
                        <div className="flex flex-col gap-1">
                          <a 
                            href={`https://amoy.polygonscan.com/tx/${tx.tx_hash}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-mono text-sm font-semibold hover:underline"
                            style={{ color: "var(--teal-600)" }}
                            title={tx.tx_hash}
                          >
                            {truncateHash(tx.tx_hash)}
                          </a>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded w-max" style={{ background: "var(--surface-soft)", color: "var(--muted)", border: "1px solid var(--border-soft)" }}>
                            {tx.network}
                          </span>
                        </div>
                      ) : (
                        <span className="italic" style={{ color: "var(--muted)" }}>Menunggu konfirmasi...</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-semibold" style={{ color: "var(--section-title)" }}>
                        {tx.details?.type?.replace("GAS_", "") || tx.entity_type}
                      </div>
                      <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                        {tx.details?.deviceName || "Device Tidak Diketahui"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {tx.status === "SUCCESS" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                          Sukses
                        </span>
                      )}
                      {tx.status === "PENDING" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-1 text-xs font-semibold text-yellow-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
                          Memproses
                        </span>
                      )}
                      {tx.status === "FAILED" && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-red-500"></span>
                          Gagal (Retry: {tx.retry_count})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs" style={{ color: "var(--muted)" }}>
                      {formatDate(tx.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
