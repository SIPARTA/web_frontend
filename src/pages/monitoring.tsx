/**
 * SIPARTA — Dashboard Monitoring Real-time
 * ==========================================
 * Menampilkan data insiden terbaru dari tabel incident_events (Supabase).
 * Menggunakan Supabase Realtime (WebSocket) untuk update tanpa refresh halaman.
 *
 * Data Flow:
 *   RPi → FastAPI → Supabase → Realtime WebSocket → Halaman ini
 */

import { useEffect, useState, useCallback, useRef } from "react";
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

interface GeminiSafetyResponse {
  gas_terdeteksi: string;
  status_risiko: string;
  ringkasan_bahaya: string;
  langkah_mitigasi: string[];
  pertolongan_pertama: string[];
  hal_dihindari: string[];
  kapan_tinggalkan_area: string;
  kapan_hubungi_darurat: string;
  catatan_ketidakpastian: string | null;
}

interface SystemStatus {
  gemini_ai: {
    name: string;
    api_status: "online" | "offline" | "unverified";
    backend_connectivity: "connected" | "disconnected" | "unverified";
    model_configured: string | null;
    last_checked: string;
    response_status: string;
    error_message: string | null;
  };
  ai_jst: {
    name: string;
    version: string | null;
    deployment_status: "deployed" | "not_deployed" | "unverified";
    model_loaded: "loaded" | "failed" | "unverified";
    inference_readiness: "ready" | "not_ready" | "unverified";
    last_checked: string;
    error_message: string | null;
  };
  dataset: {
    name: string;
    source: string;
    availability: "available" | "unavailable" | "unverified";
    sample_count: number | null;
    feature_count: number | null;
    version_or_updated: string | null;
    preprocessing_match: "matched" | "unmatched" | "unverified";
    last_checked: string;
    error_message: string | null;
  };
}

// ─── Simulation Types ─────────────────────────────────────────────────────────

interface SimulationSample {
  source: "SIMULATION";
  mode: "DEMO";
  disclaimer: string;
  sensor_data: SensorData;
  bahan_uji: string;
  label_aktual: string;
  prediksi_dataset: string;
  akurasi_sesuai: string;
  jst_realtime: { status: string; confidence: number; error?: string };
  jst_status: string;
}

interface SimulationScenario {
  bahan_uji: string;
  sample_count: number;
  risk_distribution: Record<string, number>;
}

type SimulationState = "STOPPED" | "RUNNING" | "PAUSED";


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

function IncidentCard({ incident, onDelete, isDeleting, onRequestAI, aiResult, aiLoading }: {
  incident: IncidentEvent,
  onDelete?: (id: string) => void,
  isDeleting?: boolean,
  onRequestAI?: (incident: IncidentEvent) => void,
  aiResult?: GeminiSafetyResponse | null,
  aiLoading?: boolean,
}) {
  const cfg = SEVERITY_CONFIG[incident.severity] ?? SEVERITY_CONFIG["AMAN"];
  const sensors = incident.sensor_data ?? {};
  const [showAI, setShowAI] = useState(false);

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

      {/* AI Analysis from DB (saved during pipeline) */}
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

      {/* Gemini AI Safety Button & Panel */}
      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => {
            if (!aiResult && onRequestAI) {
              onRequestAI(incident);
            }
            setShowAI(!showAI);
          }}
          disabled={aiLoading}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[10px] font-semibold transition-colors hover:bg-teal-500/10"
          style={{ borderColor: "var(--border-soft)", color: "var(--teal-600, #0d9488)" }}
        >
          {aiLoading ? (
            <><span className="animate-spin">⏳</span> Menganalisis...</>
          ) : (
            <><span>🤖</span> {showAI ? "Tutup Analisis AI" : "Analisis Keselamatan AI"}</>
          )}
        </button>
      </div>

      {/* AI Safety Response Panel */}
      {showAI && aiResult && (
        <div className="mt-3 rounded-lg border p-4 text-xs leading-relaxed space-y-3" style={{ backgroundColor: "var(--surface-soft)", borderColor: "var(--border-soft)" }}>
          <div className="flex items-center gap-2">
            <span className="text-sm">🤖</span>
            <span className="font-bold text-sm" style={{ color: "var(--section-title)" }}>Analisis Keselamatan AI</span>
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold tracking-wider ${aiResult.status_risiko === "BAHAYA" ? "bg-red-500/20 text-red-600" :
              aiResult.status_risiko === "WASPADA" ? "bg-yellow-500/20 text-yellow-600" :
                "bg-green-500/20 text-green-600"
              }`}>{aiResult.status_risiko}</span>
          </div>

          <div className="rounded-md p-2" style={{ background: "var(--bg-default)" }}>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>Gas Terdeteksi</p>
            <p className="font-semibold" style={{ color: "var(--section-title)" }}>{aiResult.gas_terdeteksi}</p>
          </div>

          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--muted)" }}>Ringkasan Bahaya</p>
            <p style={{ color: "var(--foreground)" }}>{aiResult.ringkasan_bahaya}</p>
          </div>

          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1 text-orange-500">⚡ Langkah Mitigasi Segera</p>
            <ul className="list-disc list-inside space-y-1" style={{ color: "var(--foreground)" }}>
              {aiResult.langkah_mitigasi.map((step, i) => <li key={i}>{step}</li>)}
            </ul>
          </div>

          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1 text-blue-500">🩹 Pertolongan Pertama</p>
            <ul className="list-disc list-inside space-y-1" style={{ color: "var(--foreground)" }}>
              {aiResult.pertolongan_pertama.map((step, i) => <li key={i}>{step}</li>)}
            </ul>
          </div>

          <div>
            <p className="text-[9px] font-bold uppercase tracking-widest mb-1 text-red-500">🚫 Hal yang Harus Dihindari</p>
            <ul className="list-disc list-inside space-y-1" style={{ color: "var(--foreground)" }}>
              {aiResult.hal_dihindari.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md p-2 border border-red-500/20 bg-red-500/5">
              <p className="text-[9px] font-bold uppercase tracking-widest mb-1 text-red-500">🚪 Tinggalkan Area</p>
              <p className="text-[10px]" style={{ color: "var(--foreground)" }}>{aiResult.kapan_tinggalkan_area}</p>
            </div>
            <div className="rounded-md p-2 border border-orange-500/20 bg-orange-500/5">
              <p className="text-[9px] font-bold uppercase tracking-widest mb-1 text-orange-500">📞 Hubungi Darurat</p>
              <p className="text-[10px]" style={{ color: "var(--foreground)" }}>{aiResult.kapan_hubungi_darurat}</p>
            </div>
          </div>

          {aiResult.catatan_ketidakpastian && (
            <div className="rounded-md p-2 border border-yellow-500/20 bg-yellow-500/5">
              <p className="text-[9px] font-bold uppercase tracking-widest mb-1 text-yellow-600">⚠️ Catatan Ketidakpastian</p>
              <p className="text-[10px]" style={{ color: "var(--foreground)" }}>{aiResult.catatan_ketidakpastian}</p>
            </div>
          )}

          <p className="text-[9px] italic pt-1 border-t" style={{ color: "var(--danger)", borderColor: "var(--border-soft)" }}>
            *Rekomendasi AI adalah panduan pendukung edukasi keselamatan. Selalu utamakan penilaian situasi aktual, protokol keselamatan resmi, dan arahan petugas yang kompeten.
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

// ─── Status Panel ─────────────────────────────────────────────────────────────

function StatusPanel({ status }: { status: SystemStatus | null }) {
  if (!status) return null;

  return (
    <section className="soft-panel mt-6 mb-6">
      <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--section-title)" }}>
        Status Integrasi Sistem AI & Dataset
      </h2>
      <div className="grid gap-3 sm:grid-cols-1 lg:grid-cols-3">
        {/* Card: Gemini AI */}
        <div className="flex flex-col gap-2 rounded-md border p-4 text-xs" style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-default)" }}>
          <div className="flex justify-between items-center font-semibold pb-2 border-b" style={{ borderColor: "var(--border-soft)", color: "var(--text-default)" }}>
            <span>{status.gemini_ai.name}</span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider ${status.gemini_ai.api_status === 'online' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
              {status.gemini_ai.api_status === 'online' ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div className="flex flex-col gap-1 mt-1" style={{ color: "var(--muted)" }}>
            <div className="flex justify-between"><span>Konektivitas Backend:</span> <span className="font-medium">{status.gemini_ai.backend_connectivity}</span></div>
            <div className="flex justify-between"><span>Model:</span> <span className="font-medium">{status.gemini_ai.model_configured || "-"}</span></div>
            <div className="flex justify-between"><span>Response Status:</span> <span className="font-medium">{status.gemini_ai.response_status}</span></div>
            <div className="flex justify-between"><span>Last Checked:</span> <span className="font-medium">{formatTime(status.gemini_ai.last_checked)}</span></div>
            {status.gemini_ai.error_message && (
              <div className="mt-2 text-[10px] text-red-500 p-2 rounded bg-red-500/10 font-medium">
                {status.gemini_ai.error_message}
              </div>
            )}
          </div>
        </div>

        {/* Card: AI JST */}
        <div className="flex flex-col gap-2 rounded-md border p-4 text-xs" style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-default)" }}>
          <div className="flex justify-between items-center font-semibold pb-2 border-b" style={{ borderColor: "var(--border-soft)", color: "var(--text-default)" }}>
            <span>{status.ai_jst.name}</span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider ${status.ai_jst.inference_readiness === 'ready' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
              {status.ai_jst.inference_readiness === 'ready' ? 'READY' : 'ERROR'}
            </span>
          </div>
          <div className="flex flex-col gap-1 mt-1" style={{ color: "var(--muted)" }}>
            <div className="flex justify-between"><span>Version:</span> <span className="font-medium">{status.ai_jst.version || "-"}</span></div>
            <div className="flex justify-between"><span>Status Deployment:</span> <span className="font-medium">{status.ai_jst.deployment_status}</span></div>
            <div className="flex justify-between"><span>Model Loaded:</span> <span className="font-medium">{status.ai_jst.model_loaded}</span></div>
            <div className="flex justify-between"><span>Last Checked:</span> <span className="font-medium">{formatTime(status.ai_jst.last_checked)}</span></div>
            {status.ai_jst.error_message && (
              <div className="mt-2 text-[10px] text-red-500 p-2 rounded bg-red-500/10 font-medium">
                {status.ai_jst.error_message}
              </div>
            )}
          </div>
        </div>

        {/* Card: Dataset */}
        <div className="flex flex-col gap-2 rounded-md border p-4 text-xs" style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-default)" }}>
          <div className="flex justify-between items-center font-semibold pb-2 border-b" style={{ borderColor: "var(--border-soft)", color: "var(--text-default)" }}>
            <span>{status.dataset.name}</span>
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold tracking-wider ${status.dataset.availability === 'available' ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
              {status.dataset.availability === 'available' ? 'AVAILABLE' : 'ERROR'}
            </span>
          </div>
          <div className="flex flex-col gap-1 mt-1" style={{ color: "var(--muted)" }}>
            <div className="flex justify-between"><span>Source:</span> <span className="font-medium">{status.dataset.source}</span></div>
            <div className="flex justify-between"><span>Preprocessing Match:</span> <span className="font-medium">{status.dataset.preprocessing_match}</span></div>
            <div className="flex justify-between"><span>Last Checked:</span> <span className="font-medium">{formatTime(status.dataset.last_checked)}</span></div>
            {status.dataset.error_message && (
              <div className="mt-2 text-[10px] text-red-500 p-2 rounded bg-red-500/10 font-medium">
                {status.dataset.error_message}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Simulation Card ──────────────────────────────────────────────────────────

function SimulationCard({ sample, index }: { sample: SimulationSample; index: number }) {
  const severity = sample.jst_status === "INFERENCE_FAILED" || sample.jst_status === "INFERENCE_UNAVAILABLE"
    ? sample.label_aktual?.toUpperCase()
    : sample.jst_realtime?.status || "AMAN";
  const cfg = SEVERITY_CONFIG[severity] ?? SEVERITY_CONFIG["AMAN"];
  const sensors = sample.sensor_data ?? {};

  return (
    <div className={`rounded-lg border p-4 transition-all ${cfg.cls} relative`}>
      {/* SIMULATION badge */}
      <div className="absolute top-2 right-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-purple-600 animate-pulse">
          SIMULATION
        </span>
      </div>

      <div className="flex items-start justify-between gap-4 pr-24">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${cfg.dotCls}`} />
          <span className="text-sm font-extrabold" style={{ color: "var(--section-title)" }}>
            {sample.bahan_uji}
          </span>
        </div>
        <span className={cfg.badgeCls}>{cfg.label}</span>
      </div>

      {/* Source info */}
      <div className="mt-2 text-[10px] flex flex-wrap gap-3" style={{ color: "var(--muted)" }}>
        <span>Sumber: Dataset Sensor SIPARTA.csv</span>
        <span>Label Dataset: {sample.label_aktual}</span>
      </div>

      {/* Sensor Values (ADC) */}
      <div className="mt-3 grid grid-cols-4 gap-2">
        {Object.entries(SENSOR_LABELS).map(([key, label]) => {
          const val = (sensors as Record<string, number>)[key];
          return (
            <div key={key} className="rounded-md p-2 text-center" style={{ background: "var(--surface-soft)" }}>
              <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{label}</p>
              <p className="mt-1 font-mono text-xs font-bold" style={{ color: "var(--section-title)" }}>
                {val != null ? Math.round(val) : "—"}
              </p>
              <p className="text-[8px]" style={{ color: "var(--muted)" }}>ADC</p>
            </div>
          );
        })}
      </div>

      {/* JST Inference Result */}
      <div className="mt-3 rounded-md border p-2 text-xs" style={{ borderColor: "var(--border-soft)", background: "var(--surface-soft)" }}>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Inferensi JST Real-time</span>
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded ${sample.jst_status === "INFERENCE_FAILED" ? "bg-red-500/20 text-red-600" :
            sample.jst_status === "INFERENCE_UNAVAILABLE" ? "bg-gray-500/20 text-gray-600" :
              sample.jst_realtime?.status === "BAHAYA" ? "bg-red-500/20 text-red-600" :
                sample.jst_realtime?.status === "WASPADA" ? "bg-yellow-500/20 text-yellow-600" :
                  "bg-green-500/20 text-green-600"
            }`}>
            {sample.jst_status === "INFERENCE_FAILED" ? "INFERENCE FAILED" :
              sample.jst_status === "INFERENCE_UNAVAILABLE" ? "MODEL NOT LOADED" :
                `${sample.jst_realtime?.status} (${sample.jst_realtime?.confidence}%)`}
          </span>
        </div>
        {sample.jst_status !== "INFERENCE_FAILED" && sample.jst_status !== "INFERENCE_UNAVAILABLE" && (
          <div className="mt-1 flex justify-between text-[10px]" style={{ color: "var(--muted)" }}>
            <span>Prediksi Dataset: {sample.prediksi_dataset}</span>
            <span>Kecocokan: {sample.akurasi_sesuai === "True" ? "Sesuai" : "Tidak Sesuai"}</span>
          </div>
        )}
        {sample.jst_realtime?.error && (
          <p className="mt-1 text-[10px] text-red-500">{sample.jst_realtime.error}</p>
        )}
      </div>
    </div>
  );
}

// ─── Simulation Control Panel ─────────────────────────────────────────────────

function SimulationPanel({
  simState, onStart, onPause, onStop, onSingleFetch,
  scenarios, selectedScenario, onSelectScenario,
  intervalSec, onSetInterval, simHistory, aiModelLoaded,
  onClearHistory
}: {
  simState: SimulationState;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onSingleFetch: () => void;
  scenarios: SimulationScenario[];
  selectedScenario: string;
  onSelectScenario: (s: string) => void;
  intervalSec: number;
  onSetInterval: (n: number) => void;
  simHistory: SimulationSample[];
  aiModelLoaded: boolean;
  onClearHistory: () => void;
}) {
  return (
    <section className="rounded-lg border-2 border-dashed border-purple-500/30 bg-purple-500/5 p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-sm font-bold" style={{ color: "var(--section-title)" }}>Simulasi Deteksi Gas</h2>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>
              Data berasal dari Dataset Sensor SIPARTA.csv.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider ${simState === "RUNNING" ? "bg-green-500/20 text-green-600 animate-pulse" :
            simState === "PAUSED" ? "bg-yellow-500/20 text-yellow-600" :
              "bg-gray-500/20 text-gray-500"
            }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${simState === "RUNNING" ? "bg-green-500" :
              simState === "PAUSED" ? "bg-yellow-500" :
                "bg-gray-400"
              }`} />
            {simState === "RUNNING" ? "SIMULATION RUNNING" :
              simState === "PAUSED" ? "SIMULATION PAUSED" :
                "SIMULATION STOPPED"}
          </span>
          {!aiModelLoaded && (
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-500">
              JST Model Not Loaded
            </span>
          )}
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Scenario Selector */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Skenario Gas</label>
          <select
            value={selectedScenario}
            onChange={(e) => onSelectScenario(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-default)", color: "var(--text-default)" }}
          >
            <option value="">Semua Bahan Uji (Acak)</option>
            {scenarios.map(s => (
              <option key={s.bahan_uji} value={s.bahan_uji}>
                {s.bahan_uji} ({s.sample_count} sampel)
              </option>
            ))}
          </select>
        </div>

        {/* Interval */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--muted)" }}>Interval (detik)</label>
          <select
            value={intervalSec}
            onChange={(e) => onSetInterval(Number(e.target.value))}
            className="rounded-md border px-3 py-1.5 text-xs font-medium"
            style={{ borderColor: "var(--border-soft)", backgroundColor: "var(--bg-default)", color: "var(--text-default)" }}
          >
            {[3, 5, 8, 10, 15, 30].map(n => (
              <option key={n} value={n}>{n}s</option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {simState === "STOPPED" && (
            <button onClick={onStart} className="rounded-md bg-green-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-green-700 transition-colors">
              Mulai Simulasi
            </button>
          )}
          {simState === "RUNNING" && (
            <button onClick={onPause} className="rounded-md bg-yellow-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-yellow-700 transition-colors">
              Pause
            </button>
          )}
          {simState === "PAUSED" && (
            <button onClick={onStart} className="rounded-md bg-green-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-green-700 transition-colors">
              Lanjutkan
            </button>
          )}
          {simState !== "STOPPED" && (
            <button onClick={onStop} className="rounded-md bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 transition-colors">
              Stop
            </button>
          )}
          <button
            onClick={onSingleFetch}
            disabled={simState === "RUNNING"}
            className="rounded-md border px-4 py-1.5 text-xs font-bold transition-colors hover:bg-purple-500/10 disabled:opacity-40"
            style={{ borderColor: "var(--border-soft)", color: "var(--section-title)" }}
          >
            Ambil 1 Sampel
          </button>
          {simHistory.length > 0 && (
            <button
              onClick={onClearHistory}
              className="rounded-md border px-3 py-1.5 text-xs font-bold text-red-500 hover:bg-red-500/10 transition-colors"
              style={{ borderColor: "var(--border-soft)" }}
            >
              Bersihkan ({simHistory.length})
            </button>
          )}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="rounded-md border border-purple-500/20 bg-purple-500/5 px-3 py-2 text-[10px]" style={{ color: "var(--muted)" }}>
        Seluruh data di panel ini adalah simulasi dari dataset.
      </div>
    </section>
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
  const [dataSource, setDataSource] = useState<"all" | "iot" | "droidcam" | "simulation">("all");

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [unsavedData, setUnsavedData] = useState<UnsavedData[]>([]);
  const [aiResults, setAiResults] = useState<Record<string, GeminiSafetyResponse>>({});
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  // ─── Simulation State ─────────────────────────────────────────────────────
  const [simState, setSimState] = useState<SimulationState>("STOPPED");
  const [simHistory, setSimHistory] = useState<SimulationSample[]>([]);
  const [simScenarios, setSimScenarios] = useState<SimulationScenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState("");
  const [simIntervalSec, setSimIntervalSec] = useState(5);
  const [simAiLoaded, setSimAiLoaded] = useState(false);
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const router = useRouter();

  // ─── Gemini AI Safety Analysis Handler ─────────────────────────────────────
  const handleRequestAI = async (incident: IncidentEvent) => {
    // Jangan re-request jika sudah ada hasil
    if (aiResults[incident.id]) return;

    setAiLoadingId(incident.id);
    try {
      const res = await fetch("/api/monitoring/ai-safety", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          incident_id: incident.id,
          incident_type: incident.incident_type,
          severity: incident.severity,
          sensor_data: incident.sensor_data || {},
          timestamp: incident.timestamp,
          source_type: incident.incident_type === "VISUAL_AUDIT" ? "droidcam" : "iot",
        })
      });
      const data: GeminiSafetyResponse = await res.json();
      setAiResults(prev => ({ ...prev, [incident.id]: data }));
    } catch (err: unknown) {
      setAiResults(prev => ({
        ...prev, [incident.id]: {
          gas_terdeteksi: "Gagal menganalisis",
          status_risiko: incident.severity,
          ringkasan_bahaya: `Gagal menghubungi layanan AI: ${err instanceof Error ? err.message : "Unknown error"}`,
          langkah_mitigasi: ["Ikuti prosedur keselamatan umum setempat"],
          pertolongan_pertama: ["Hubungi tenaga medis jika merasa terpapar"],
          hal_dihindari: ["Jangan mendekati sumber kebocoran"],
          kapan_tinggalkan_area: "Segera jika mencium bau tajam atau merasa tidak nyaman",
          kapan_hubungi_darurat: "Hubungi 112/119 jika ada indikasi kebocoran gas",
          catatan_ketidakpastian: "Layanan AI tidak dapat dihubungi. Gunakan protokol keselamatan standar.",
        }
      }));
    } finally {
      setAiLoadingId(null);
    }
  };

  // ─── Simulation Handlers ──────────────────────────────────────────────────

  const fetchSimScenarios = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring/simulation?action=scenarios");
      if (!res.ok) return;
      const data = await res.json();
      if (data.scenarios) setSimScenarios(data.scenarios);
    } catch { /* silent */ }
  }, []);

  const fetchSimSample = useCallback(async () => {
    try {
      const params = new URLSearchParams({ count: "1" });
      if (selectedScenario) params.set("bahan", selectedScenario);
      const res = await fetch(`/api/monitoring/simulation?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.ai_model_loaded !== undefined) setSimAiLoaded(data.ai_model_loaded);
      if (data.results && data.results.length > 0) {
        setSimHistory(prev => [data.results[0], ...prev].slice(0, 50));
      }
    } catch (err) {
      console.error("Simulation fetch error:", err);
    }
  }, [selectedScenario]);

  const startSimulation = useCallback(() => {
    setSimState("RUNNING");
    fetchSimSample();
    if (simTimerRef.current) clearInterval(simTimerRef.current);
    simTimerRef.current = setInterval(fetchSimSample, simIntervalSec * 1000);
  }, [fetchSimSample, simIntervalSec]);

  const pauseSimulation = useCallback(() => {
    setSimState("PAUSED");
    if (simTimerRef.current) { clearInterval(simTimerRef.current); simTimerRef.current = null; }
  }, []);

  const stopSimulation = useCallback(() => {
    setSimState("STOPPED");
    if (simTimerRef.current) { clearInterval(simTimerRef.current); simTimerRef.current = null; }
  }, []);

  // Reset interval when settings change and simulation is running
  useEffect(() => {
    if (simState === "RUNNING") {
      if (simTimerRef.current) clearInterval(simTimerRef.current);
      simTimerRef.current = setInterval(fetchSimSample, simIntervalSec * 1000);
    }
    return () => { if (simTimerRef.current) clearInterval(simTimerRef.current); };
  }, [simIntervalSec, simState, fetchSimSample]);

  // Load scenarios on mount
  useEffect(() => {
    if (authenticationStatus === "authenticated") {
      fetchSimScenarios();
    }
  }, [authenticationStatus, fetchSimScenarios]);

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

    // Fungsi untuk cek system status
    const checkSystemStatus = async () => {
      try {
        const res = await fetch("/api/monitoring/system-status");
        if (res.ok) {
          const data = await res.json();
          setSystemStatus(data);
        }
      } catch (err) {
        console.error("Gagal fetch system status", err);
      }
    };

    checkDeviceStatus();
    checkSystemStatus();

    // Polling fallback setiap 10 detik (jika Realtime belum dikonfigurasi)
    const interval = setInterval(() => {
      fetchIncidents();
      checkDeviceStatus();
      checkSystemStatus();
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
          Fitur Monitoring membutuhkan autentikasi (MetaMask atau Google). Silakan login terlebih dahulu untuk mengakses data real-time.
        </p>
        <Link href="/signin" className="btn-primary">Masuk ke SIPARTA</Link>
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

      {/* System Status Panel */}
      <StatusPanel status={systemStatus} />

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
          {(["all", "iot", "droidcam", "simulation"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setDataSource(s)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors ${dataSource === s
                ? s === "simulation" ? "border-transparent bg-purple-500/20 text-purple-500" : "border-transparent bg-indigo-500/20 text-indigo-400"
                : "border-[var(--border-soft)] text-[var(--muted)] hover:border-[var(--muted)]"
                }`}
            >
              {s === "all" ? "Semua Sumber" : s === "iot" ? "Alat IoT (Production)" : s === "droidcam" ? "DroidCam (Testing)" : "🔬 Simulasi (Demo)"}
            </button>
          ))}
        </div>
      </div>

      {/* Unsaved / Live Data Section */}
      {unsavedData.length > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center border border-dashed border-indigo-500/30 bg-indigo-500/5 rounded-lg p-4 mb-6">
          <div>
            <h2 className="text-sm font-bold text-indigo-400">Data IoT Belum Tersimpan ({unsavedData.length})</h2>
            <p className="text-[10px] text-[var(--muted)] mt-1">Data aktual dari hardware fisik yang belum masuk ke database.</p>
          </div>
        </div>
      )}

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

      {/* ─── Simulation Panel ──────────────────────────────────────────── */}
      {(dataSource === "simulation" || dataSource === "all") && (
        <SimulationPanel
          simState={simState}
          onStart={startSimulation}
          onPause={pauseSimulation}
          onStop={stopSimulation}
          onSingleFetch={fetchSimSample}
          scenarios={simScenarios}
          selectedScenario={selectedScenario}
          onSelectScenario={setSelectedScenario}
          intervalSec={simIntervalSec}
          onSetInterval={setSimIntervalSec}
          simHistory={simHistory}
          aiModelLoaded={simAiLoaded}
          onClearHistory={() => setSimHistory([])}
        />
      )}

      {/* Simulation History Cards */}
      {(dataSource === "simulation" || dataSource === "all") && simHistory.length > 0 && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {simHistory
              .filter(s => {
                if (filter === "ALL") return true;
                const sev = s.jst_status === "INFERENCE_FAILED" || s.jst_status === "INFERENCE_UNAVAILABLE"
                  ? s.label_aktual?.toUpperCase()
                  : s.jst_realtime?.status || "";
                return sev === filter;
              })
              .map((sample, i) => (
                <SimulationCard key={`sim-${i}-${sample.bahan_uji}`} sample={sample} index={i} />
              ))}
          </div>
        </>
      )}

      {/* ─── Production Incident List ──────────────────────────────────── */}
      {dataSource !== "simulation" && (
        <>
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
                  onRequestAI={handleRequestAI}
                  aiResult={aiResults[incident.id] || null}
                  aiLoading={aiLoadingId === incident.id}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
