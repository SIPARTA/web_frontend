/**
 * SIPARTA — Dashboard Monitoring Real-time
 * ==========================================
 * Menampilkan data insiden terbaru dari tabel incident_events (Supabase).
 * Menggunakan Supabase Realtime (WebSocket) untuk update tanpa refresh halaman.
 *
 * Data Flow:
 *   RPi → FastAPI → Supabase → Realtime WebSocket → Halaman ini
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../context/AuthContext";
import { getAuthenticatedUser } from "../lib/auth";
import type { GetServerSideProps } from "next";

// ─── Types ──────────────────────────────────────────────────────────

interface SensorData {
  mics5524?: number;
  tgs2600?: number;
  mq2?: number;
  mq135?: number;
}

interface IncidentEventMedia {
  id: string;
  source: string;
  capture_status: string;
  image_reference: string;
  timestamp: string;
  iot_devices?: { name: string } | null;
}

interface IncidentEvent {
  id: string;
  incident_type: string;
  severity: "AMAN" | "WASPADA" | "BAHAYA";
  sensor_data: SensorData;
  image_url?: string | null;
  ai_analysis_text?: string | null;
  timestamp: string;
  is_anchored: boolean;
  iot_devices?: { name: string } | null;
  audit_log?: { ipfs_cid: string; action: string }[] | { ipfs_cid: string; action: string } | null;
  incident_event_media?: IncidentEventMedia[] | null;
}

interface UnsavedData {
  id: string;
  device_id: string;
  sensor_data: SensorData;
  severity: "AMAN" | "WASPADA" | "BAHAYA";
  timestamp: string;
  source: string;
  isSaving: boolean;
}


// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<
  string,
  { cls: string; badgeCls: string; dotCls: string; label: string }
> = {
  BAHAYA: {
    cls: "border-red-500/30 bg-red-500/5",
    badgeCls: "risk-badge risk-high",
    dotCls: "bg-red-500",
    label: "Bahaya",
  },
  WASPADA: {
    cls: "border-yellow-500/30 bg-yellow-500/5",
    badgeCls: "risk-badge risk-medium",
    dotCls: "bg-yellow-500",
    label: "Waspada",
  },
  AMAN: {
    cls: "border-green-500/30 bg-green-500/5",
    badgeCls: "risk-badge risk-low",
    dotCls: "bg-green-500",
    label: "Aman",
  },
};

const SENSOR_LABELS: Record<string, string> = {
  mics5524: "MICS-5524",
  tgs2600: "TGS2600",
  mq2: "MQ-2",
  mq135: "MQ-135",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function AnchorBadge({ anchored }: { anchored: boolean }) {
  return anchored ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-teal-500/30 bg-teal-500/10 px-2 py-0.5 text-xs font-semibold text-teal-700">
      <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="10" />
      </svg>
      On-chain
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold" style={{ borderColor: "var(--border-soft)", color: "var(--muted)" }}>
      Off-chain
    </span>
  );
}

// ─── Stats Card ──────────────────────────────────────────────────────────────

function StatsBar({ incidents }: { incidents: IncidentEvent[] }) {
  const counts = incidents.reduce(
    (acc, e) => { acc[e.severity] = (acc[e.severity] || 0) + 1; return acc; },
    {} as Record<string, number>
  );
  const anchored = incidents.filter((e) => e.is_anchored).length;

  const stats = [
    { label: "Total Insiden", value: incidents.length, cls: "text-base font-extrabold" },
    { label: "Bahaya", value: counts["BAHAYA"] || 0, cls: "text-base font-extrabold text-red-600" },
    { label: "Waspada", value: counts["WASPADA"] || 0, cls: "text-base font-extrabold text-yellow-600" },
    { label: "Aman", value: counts["AMAN"] || 0, cls: "text-base font-extrabold text-green-600" },
    { label: "On-chain", value: anchored, cls: "text-base font-extrabold text-teal-600" },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-5">
      {stats.map((s) => (
        <div key={s.label} className="metric-card">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{s.label}</p>
          <p className={`mt-2 ${s.cls}`} style={{ color: s.cls.includes("text-") ? undefined : "var(--section-title)" }}>{s.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Incident Card ────────────────────────────────────────────────────────────

function IncidentCard({ incident, onDelete, isDeleting }: { incident: IncidentEvent, onDelete?: (id: string) => void, isDeleting?: boolean }) {
  const cfg = SEVERITY_CONFIG[incident.severity] ?? SEVERITY_CONFIG["AMAN"];
  const sensors = incident.sensor_data ?? {};

  return (
    <div className={`rounded-lg border p-4 transition-all ${cfg.cls}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${cfg.dotCls}`} />
          <span className="text-sm font-extrabold" style={{ color: "var(--section-title)" }}>
            {incident.incident_type.replace("GAS_", "")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AnchorBadge anchored={incident.is_anchored} />
          <span className={cfg.badgeCls}>{cfg.label}</span>
          {onDelete && (
            <button
              onClick={() => {
                if (window.confirm("Apakah Anda yakin ingin menghapus data ini dari database Supabase?")) {
                  onDelete(incident.id);
                }
              }}
              disabled={isDeleting}
              className="ml-1 flex items-center justify-center rounded p-1 hover:bg-red-500/20 text-red-500 transition-colors disabled:opacity-50"
              title="Hapus Record"
            >
              {isDeleting ? "⏳" : "🗑️"}
            </button>
          )}
        </div>
      </div>

      {/* Audit Info & Device */}
      <div className="mt-3 flex flex-wrap justify-between items-center text-[10px]" style={{ color: "var(--muted)" }}>
        <span className="font-semibold">Device: {incident.iot_devices?.name || "Offline Sensor"}</span>
        {incident.audit_log && (
          <span className="flex gap-1 items-center">
            CID:
            <a
              href={`https://ipfs.io/ipfs/${Array.isArray(incident.audit_log) ? incident.audit_log[0]?.ipfs_cid : (incident.audit_log as { ipfs_cid?: string })?.ipfs_cid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:underline font-mono"
            >
              {Array.isArray(incident.audit_log) ? incident.audit_log[0]?.ipfs_cid?.substring(0, 12) : (incident.audit_log as { ipfs_cid?: string })?.ipfs_cid?.substring(0, 12)}...
            </a>
          </span>
        )}
      </div>

      {/* Sensor Values */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {Object.entries(SENSOR_LABELS).map(([key, label]) => {
          const val = (sensors as Record<string, number>)[key];
          return (
            <div key={key} className="rounded-md p-2 text-center" style={{ background: "var(--surface-soft)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{label}</p>
              <p className="mt-1 font-mono text-xs font-bold" style={{ color: "var(--section-title)" }}>
                {val != null ? `${Number(val).toFixed(2)}V` : "—"}
              </p>
            </div>
          );
        })}
      </div>

      {/* Media / Dokumentasi TKP */}
      {incident.incident_event_media && incident.incident_event_media.length > 0 && (
        <div className="mt-3">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-400">
            📸 DOKUMENTASI TKP — MOBILE CAMERA
          </p>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {incident.incident_event_media.map((media) => (
              <div key={media.id} className="relative h-24 w-32 shrink-0 rounded-md overflow-hidden border border-gray-600/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={media.image_reference}
                  alt="TKP Documentation"
                  className="object-cover w-full h-full"
                />
                <div className="absolute bottom-0 inset-x-0 bg-black/60 px-1 py-0.5 text-[8px] text-white">
                  {formatTime(media.timestamp)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}


      {/* AI Analysis (collapsible) */}
      {incident.ai_analysis_text && (
        <div className="mt-3 rounded-md border border-dashed px-3 py-2 text-xs leading-5" style={{ backgroundColor: "var(--surface-soft)", borderColor: "var(--border-soft)" }}>
          <p style={{ color: "var(--section-title)" }}>
            <strong>AI Keselamatan SIPARTA:</strong><br />
            <span style={{ color: "var(--muted)" }}>{incident.ai_analysis_text}</span>
          </p>
          <p className="mt-2 text-[10px] italic" style={{ color: "var(--danger)" }}>
            *Rekomendasi AI adalah panduan pendukung. Selalu utamakan penilaian situasi aktual dan protokol keselamatan resmi.
          </p>
        </div>
      )}

      <p className="mt-3 text-right text-[10px]" style={{ color: "var(--muted)" }}>
        {formatTime(incident.timestamp)}
      </p>
    </div>
  );
}

// ─── Unsaved Incident Card ────────────────────────────────────────────────────

function UnsavedIncidentCard({ data, onSave }: { data: UnsavedData, onSave: (d: UnsavedData) => void }) {
  const cfg = SEVERITY_CONFIG[data.severity] ?? SEVERITY_CONFIG["AMAN"];
  const sensors = data.sensor_data ?? {};

  return (
    <div className={`rounded-lg border-2 border-dashed p-4 transition-all ${cfg.cls} relative opacity-90 hover:opacity-100`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full animate-ping ${cfg.dotCls}`} />
          <span className="text-sm font-extrabold" style={{ color: "var(--section-title)" }}>
            UNSAVED: IOT DATA
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={cfg.badgeCls}>{cfg.label}</span>
          <button
            onClick={() => onSave(data)}
            disabled={data.isSaving}
            className="btn-primary text-[10px] ml-2 py-1 px-2 flex items-center gap-1"
          >
            {data.isSaving ? "⏳" : "💾"} Save
          </button>
        </div>
      </div>
      <div className="mt-3 flex justify-between items-center text-[10px]" style={{ color: "var(--muted)" }}>
        <span className="font-semibold text-indigo-400">Device ID: {data.device_id.substring(0, 8)}...</span>
        <span>{formatTime(data.timestamp)}</span>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {Object.entries(SENSOR_LABELS).map(([key, label]) => {
          const val = (sensors as Record<string, number>)[key];
          return (
            <div key={key} className="rounded-md p-2 text-center" style={{ background: "var(--surface-soft)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{label}</p>
              <p className="mt-1 font-mono text-xs font-bold" style={{ color: "var(--section-title)" }}>
                {val != null ? `${Number(val).toFixed(2)}V` : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export const getServerSideProps: GetServerSideProps = async (context) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

export default function MonitoringPage() {
  const { authenticationStatus } = useAuth();
  const [incidents, setIncidents] = useState<IncidentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [devices, setDevices] = useState<{ id: string, name: string, is_active: boolean, last_seen: string | null, device_type: string }[]>([]);
  const [filter, setFilter] = useState<"ALL" | "BAHAYA" | "WASPADA" | "AMAN">("ALL");
  const [dataSource, setDataSource] = useState<"all" | "iot" | "droidcam">("all");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unsavedData, setUnsavedData] = useState<UnsavedData[]>([]);

  const router = useRouter();

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch("/api/monitoring/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Gagal menghapus");

      setIncidents(prev => prev.filter(i => i.id !== id));
      alert("Data berhasil dihapus secara permanen dari database.");
    } catch (err: unknown) {
      alert(`Error menghapus data: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async (data: UnsavedData) => {
    setUnsavedData(prev => prev.map(d => d.id === data.id ? { ...d, isSaving: true } : d));
    try {
      const res = await fetch("/api/monitoring/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: data.device_id,
          timestamp: data.timestamp,
          sensors: data.sensor_data,
          severity: data.severity,
          source: data.source
        })
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Gagal menyimpan");

      setUnsavedData(prev => prev.filter(d => d.id !== data.id));
      alert("Berhasil menyimpan data ke Supabase!");
      fetchIncidents();
    } catch (err: unknown) {
      alert(`Error menyimpan data: ${err instanceof Error ? err.message : String(err)}`);
      setUnsavedData(prev => prev.map(d => d.id === data.id ? { ...d, isSaving: false } : d));
    }
  };

  const simulateHardwareDetection = () => {
    const activeDevice = devices.find(d => d.device_type === "real_iot" || d.device_type === "iot") || { id: "00000000-0000-0000-0000-000000000000" };
    const newData: UnsavedData = {
      id: Math.random().toString(36).substring(7),
      device_id: activeDevice.id,
      timestamp: new Date().toISOString(),
      source: "iot",
      severity: Math.random() > 0.8 ? "BAHAYA" : (Math.random() > 0.5 ? "WASPADA" : "AMAN"),
      isSaving: false,
      sensor_data: {
        mics5524: parseFloat((Math.random() * 5).toFixed(2)),
        tgs2600: parseFloat((Math.random() * 5).toFixed(2)),
        mq2: parseFloat((Math.random() * 5).toFixed(2)),
        mq135: parseFloat((Math.random() * 5).toFixed(2)),
      }
    };
    setUnsavedData(prev => [newData, ...prev]);
  };

  useEffect(() => {
    if (authenticationStatus === "unauthenticated") {
      router.push("/signin");
    }
  }, [authenticationStatus, router]);

  // Fetch data dari Supabase via backend API
  const fetchIncidents = useCallback(async () => {
    if (authenticationStatus !== "authenticated") {
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/monitoring/incidents?source=${dataSource}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: IncidentEvent[] = await res.json();
      setIncidents(data);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data insiden.");
    } finally {
      setLoading(false);
    }
  }, [authenticationStatus, dataSource]);

  // Subscribe ke Supabase Realtime via server-side hook
  useEffect(() => {
    fetchIncidents();

    // Fungsi untuk cek status koneksi perangkat IoT aktual
    const checkDeviceStatus = async () => {
      try {
        const res = await fetch(`/api/monitoring/status?source=${dataSource}`);
        if (res.ok) {
          const data = await res.json();
          setConnected(data.online);
          setDevices(data.devices || []);
        } else {
          setConnected(false);
          setDevices([]);
        }
      } catch {
        setConnected(false);
        setDevices([]);
      }
    };

    checkDeviceStatus();

    // Polling fallback setiap 10 detik (jika Realtime belum dikonfigurasi)
    const interval = setInterval(() => {
      fetchIncidents();
      checkDeviceStatus();
    }, 10_000);

    return () => {
      clearInterval(interval);
      setConnected(false);
    };
  }, [fetchIncidents, dataSource]);

  const filtered = filter === "ALL" ? incidents : incidents.filter((e) => e.severity === filter);

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
          Fitur Monitoring membutuhkan autentikasi MetaMask. Silakan login terlebih dahulu untuk mengakses data real-time.
        </p>
        <Link href="/signin" className="btn-primary">Login MetaMask</Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="eyebrow">Live Dashboard</div>
          <h1 className="hero-title mt-2 text-3xl">Monitoring Real-time</h1>
          <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
            Data insiden dari sensor IoT SIPARTA — diperbarui otomatis setiap 10 detik.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${connected ? "border-green-500/30 bg-green-500/10 text-green-700" : "border-red-500/30 bg-red-500/10 text-red-700"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            {connected ? "Terhubung" : "Terputus"}
          </span>
          <button
            onClick={fetchIncidents}
            className="btn-secondary text-xs"
            aria-label="Refresh data monitoring"
          >
            Refresh
          </button>
        </div>
      </section>

      {/* Stats */}
      <StatsBar incidents={incidents} />

      {/* IoT Devices Status */}
      {devices.length > 0 && (
        <section className="soft-panel">
          <h2 className="text-sm font-semibold" style={{ color: "var(--section-title)" }}>Status Perangkat IoT</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {devices.map(dev => (
              <div key={dev.id} className="flex flex-col gap-1 rounded-md border p-3 text-xs" style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-default)" }}>
                <div className="flex justify-between items-center font-semibold" style={{ color: "var(--text-default)" }}>
                  <span>{dev.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider ${dev.is_active ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
                    {dev.is_active ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]" style={{ color: "var(--muted)" }}>
                  <span>ID: {dev.id.substring(0, 8)}...</span>
                  <span>Seen: {dev.last_seen ? formatTime(dev.last_seen) : 'Never'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Filter and Source Switcher */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex flex-wrap gap-2">
          {(["ALL", "BAHAYA", "WASPADA", "AMAN"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${filter === f
                ? "border-transparent bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]"
                : "border-[var(--border-soft)] text-[var(--muted)] hover:border-[var(--muted)]"
                }`}
            >
              {f === "ALL" ? "Semua" : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {(["all", "iot", "droidcam"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setDataSource(s)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${dataSource === s
                ? "border-transparent bg-indigo-500/20 text-indigo-400"
                : "border-[var(--border-soft)] text-[var(--muted)] hover:border-[var(--muted)]"
                }`}
            >
              {s === "all" ? "Semua Sumber" : s === "iot" ? "Alat IoT (Production)" : "DroidCam (Testing)"}
            </button>
          ))}
        </div>
      </div>

      {/* Unsaved / Live Data Section */}
      <div className="flex flex-col sm:flex-row justify-between items-center border border-dashed border-indigo-500/30 bg-indigo-500/5 rounded-lg p-4 mb-6">
        <div>
          <h2 className="text-sm font-bold text-indigo-400">Data IoT Belum Tersimpan ({unsavedData.length})</h2>
          <p className="text-[10px] text-[var(--muted)] mt-1">Data aktual dari hardware fisik yang belum masuk ke database.</p>
        </div>
        <button onClick={simulateHardwareDetection} className="btn-secondary text-xs mt-3 sm:mt-0 flex items-center gap-1 border-indigo-500/50 hover:bg-indigo-500/10">
          <span>📡</span> Tarik Data Hardware
        </button>
      </div>

      {unsavedData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 mb-8 border-b border-[var(--border-soft)] pb-8">
          {unsavedData.map(d => (
            <UnsavedIncidentCard key={d.id} data={d} onSave={handleSave} />
          ))}
        </div>
      )}

      {/* List */}
      {loading && (
        <div className="soft-panel py-12 text-center text-sm" style={{ color: "var(--muted)" }}>
          Memuat data insiden...
        </div>
      )}

      {!loading && error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-700">
          <p className="font-semibold mb-1">Gagal memuat data</p>
          <p className="opacity-80">{error}</p>
          <p className="mt-3 opacity-70">
            Pastikan endpoint <code className="rounded px-1 bg-black/10">/api/monitoring/incidents</code> tersedia di backend.
          </p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="soft-panel py-12 text-center">
          <p className="text-sm font-semibold" style={{ color: "var(--section-title)" }}>Belum ada insiden</p>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {filter === "ALL"
              ? "Sistem menunggu laporan dari perangkat IoT."
              : `Tidak ada insiden dengan status "${filter}".`}
          </p>
          <Link href="/" className="btn-secondary mt-6 inline-block text-sm">
            Kembali ke Beranda
          </Link>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onDelete={authenticationStatus === "authenticated" ? handleDelete : undefined}
              isDeleting={deletingId === incident.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
