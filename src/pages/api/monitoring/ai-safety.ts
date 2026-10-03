/**
 * Next.js API Route — /api/monitoring/ai-safety
 * =================================================
 * Endpoint Gemini AI context-aware untuk analisis keselamatan per-insiden.
 *
 * Menerima data deteksi aktual dari incident record di Monitoring,
 * lalu mengirim ke Gemini dengan prompt terstruktur menggunakan:
 *   1. Role Assignment — AI Keselamatan SIPARTA
 *   2. Instruction Clarity — format, batasan, aturan keselamatan
 *
 * Alur:
 *   Frontend (IncidentCard) → POST /api/monitoring/ai-safety
 *     → Server-side Gemini API call (API key aman)
 *     → Structured safety response → Frontend
 *
 * KEAMANAN:
 *   - GEMINI_API_KEY TIDAK pernah dikirim ke client
 *   - Input sensor data divalidasi sebelum masuk ke prompt
 *   - Response Gemini divalidasi sebelum dikembalikan
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAuthenticatedUser } from "../../../lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SafetyRequest {
  incident_id: string;
  incident_type: string;
  severity: "AMAN" | "WASPADA" | "BAHAYA";
  sensor_data: {
    mics5524?: number;
    tgs2600?: number;
    mq2?: number;
    mq135?: number;
  };
  timestamp: string;
  source_type?: string;
}

// ─── Prompt Engineering ───────────────────────────────────────────────────────

/**
 * ROLE ASSIGNMENT — System Instruction
 * Mengunci persona AI agar konservatif, defensif, dan aman.
 */
const SYSTEM_INSTRUCTION = `Anda adalah **Asisten Edukasi Keselamatan SIPARTA** (Sistem Pintar Deteksi Kimia Rumah Tangga).

PERAN ANDA:
- Memberikan edukasi keselamatan berbasis data deteksi sensor gas
- Memberikan rekomendasi mitigasi yang konservatif dan defensif
- BUKAN pengganti petugas keselamatan, tenaga medis, atau emergency responder

ATURAN KETAT YANG TIDAK BOLEH DILANGGAR:
1. JANGAN PERNAH mengarang/fabrikasi nilai sensor yang tidak ada dalam input
2. JANGAN menebak jenis gas jika data sensor tidak mencukupi — nyatakan ketidakpastian
3. JANGAN menyarankan eksperimen, pencampuran, atau penetralan zat kimia mandiri
4. JANGAN menyarankan mendekati/menyentuh sumber kebocoran tanpa APD profesional
5. Untuk status BAHAYA: prioritas UTAMA adalah EVAKUASI dan menjauh dari sumber
6. Hindari diagnosis medis — arahkan ke tenaga medis jika terpapar
7. Jika data ambigu/bertentangan: instruksikan mengandalkan alarm fisik dan menjauh
8. JANGAN memberikan instruksi yang mendorong eksperimen atau tindakan berisiko

FORMAT RESPONSE (JSON):
Kembalikan HANYA JSON valid tanpa markdown code block, dengan struktur:
{
  "gas_terdeteksi": "Nama gas atau 'Belum dapat ditentukan'",
  "status_risiko": "AMAN/WASPADA/BAHAYA",
  "ringkasan_bahaya": "Penjelasan singkat bahaya gas tersebut",
  "langkah_mitigasi": ["langkah 1", "langkah 2", "langkah 3"],
  "pertolongan_pertama": ["langkah P3K 1", "langkah P3K 2"],
  "hal_dihindari": ["hal 1", "hal 2"],
  "kapan_tinggalkan_area": "Kondisi kapan harus segera meninggalkan area",
  "kapan_hubungi_darurat": "Kondisi kapan harus menghubungi 112/119/Damkar",
  "catatan_ketidakpastian": "Catatan jika data sensor tidak cukup, atau null"
}`;

/**
 * INSTRUCTION CLARITY — User Prompt
 * Membangun prompt terstruktur dari data deteksi aktual.
 */
function buildDetectionPrompt(data: SafetyRequest): string {
  const sensorInfo = data.sensor_data || {};
  
  let sourceLabel = "IoT Hardware (Production)";
  if (data.source_type === "droidcam") {
    sourceLabel = "DroidCam (Development/Testing)";
  } else if (data.source_type === "simulation") {
    sourceLabel = "Data Simulasi (DEMO MODE)";
  }
  
  return `[SIPARTA DETECTION RECORD]
ID Insiden: ${data.incident_id}
Sumber: ${sourceLabel}
Jenis Insiden: ${data.incident_type}
Status Klasifikasi: ${data.severity}
Waktu Deteksi: ${data.timestamp}

[PANDUAN REFERENSI SENSOR]
- MICS-5524: Mengukur Karbon Monoksida (CO) dan Gas Mudah Terbakar
- TGS2600: Mengukur Polutan Udara (VOC Ringan, Metana, Isobutana)
- MQ-2: Mengukur Asap, Propana, Hidrogen (H2)
- MQ-135: Mengukur Amonia (NH3), Benzena, Hidrogen Sulfida (H2S), CO2
*Catatan: Nilai di atas 2.0V mengindikasikan konsentrasi gas signifikan
${data.source_type === "simulation" ? "\n*PERHATIAN: Ini adalah simulasi (DEMO MODE). Harap pastikan respons Anda tetap mengedukasi tanpa menyatakan ini adalah insiden fisik nyata, namun berikan analisis layaknya data ini nyata untuk pembelajaran.*" : ""}

[DATA PEMBACAAN SENSOR AKTUAL (Tegangan Output ADC)]
- MICS-5524: ${sensorInfo.mics5524 != null ? `${sensorInfo.mics5524} Volt` : "TIDAK TERSEDIA"}
- TGS2600: ${sensorInfo.tgs2600 != null ? `${sensorInfo.tgs2600} Volt` : "TIDAK TERSEDIA"}
- MQ-2: ${sensorInfo.mq2 != null ? `${sensorInfo.mq2} Volt` : "TIDAK TERSEDIA"}
- MQ-135: ${sensorInfo.mq135 != null ? `${sensorInfo.mq135} Volt` : "TIDAK TERSEDIA"}

Berdasarkan data di atas, berikan analisis keselamatan dalam format JSON yang diminta.
Jika data sensor tidak tersedia atau bernilai 0, nyatakan ketidakpastian.
Jangan mengarang nilai sensor atau jenis gas yang tidak sesuai dengan data aktual.`;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateSensorValue(val: unknown): number | null {
  if (val == null) return null;
  const num = Number(val);
  if (isNaN(num) || num < 0 || num > 10) return null; // Reasonable voltage range
  return num;
}

function sanitizeInput(body: SafetyRequest): SafetyRequest {
  return {
    incident_id: String(body.incident_id || "").slice(0, 100),
    incident_type: String(body.incident_type || "").slice(0, 50),
    severity: (["AMAN", "WASPADA", "BAHAYA"].includes(body.severity) ? body.severity : "AMAN") as "AMAN" | "WASPADA" | "BAHAYA",
    sensor_data: {
      mics5524: validateSensorValue(body.sensor_data?.mics5524) ?? undefined,
      tgs2600: validateSensorValue(body.sensor_data?.tgs2600) ?? undefined,
      mq2: validateSensorValue(body.sensor_data?.mq2) ?? undefined,
      mq135: validateSensorValue(body.sensor_data?.mq135) ?? undefined,
    },
    timestamp: String(body.timestamp || new Date().toISOString()).slice(0, 50),
    source_type: String(body.source_type || "iot").slice(0, 20),
  };
}

// ─── Fallback ─────────────────────────────────────────────────────────────────

const FALLBACK_RESPONSE = {
  gas_terdeteksi: "Belum dapat ditentukan",
  status_risiko: "WASPADA",
  ringkasan_bahaya: "Data deteksi belum cukup untuk menentukan jenis/tingkat bahaya secara pasti.",
  langkah_mitigasi: [
    "Segera menjauh dari area yang diduga terkontaminasi dan menuju lokasi aman.",
    "Hindari menghirup gas atau uap yang tidak diketahui jenisnya.",
    "Jangan memasuki kembali area berbahaya tanpa perlindungan dan pelatihan yang sesuai.",
    "Jika terdapat korban, jangan melakukan penyelamatan yang dapat membahayakan diri sendiri.",
    "Jika aman dilakukan, bantu korban menuju udara segar dan segera cari bantuan medis apabila mengalami gangguan pernapasan, pusing berat, penurunan kesadaran, atau gejala serius lainnya.",
    "Hubungi petugas tanggap darurat atau pihak berwenang jika terdapat indikasi kebocoran atau bahaya kimia.",
    "Jangan mencoba menghentikan kebocoran, mencampur bahan kimia, atau melakukan tindakan mitigasi teknis tanpa kompetensi dan perlindungan yang sesuai."
  ],
  pertolongan_pertama: [
    "Pindahkan korban ke area dengan udara segar jika aman untuk dilakukan.",
    "Segera cari bantuan medis jika korban mengalami gangguan pernapasan, pusing, atau mual."
  ],
  hal_dihindari: [
    "Jangan menyalakan api atau membuat percikan listrik di area kejadian.",
    "Jangan menyentuh sumber kebocoran tanpa APD.",
    "Jangan mencoba mencampur bahan kimia untuk menetralisir keadaan."
  ],
  kapan_tinggalkan_area: "Segera tinggalkan area jika mencium bau tajam, merasa pusing, atau alarm fisik berbunyi.",
  kapan_hubungi_darurat: "Hubungi 112/119/Damkar jika terdapat tanda kebocoran bahan kimia atau gas yang tidak terkendali.",
  catatan_ketidakpastian: "Peringatan: Prosedur umum ini BUKAN pengganti panduan khusus bahan kimia, lembar data keselamatan (SDS), petugas tanggap darurat, atau tenaga medis.",
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Auth check
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized. Please authenticate with MetaMask." });
  }

  // API key check
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.length < 10) {
    console.warn("[AI-Safety] GEMINI_API_KEY tidak tersedia. Returning fallback.");
    return res.status(200).json({
      ...FALLBACK_RESPONSE,
      catatan_ketidakpastian: "API Key Gemini belum dikonfigurasi. Rekomendasi ini berdasarkan protokol keselamatan umum.",
    });
  }

  // Mencegah penggunaan token OAuth sebagai API key untuk Gemini
  if (apiKey.startsWith("ya29.") || apiKey.startsWith("AQ.")) {
    console.error("[AI-Safety] Kesalahan Kredensial: Ditemukan OAuth 2.0 Access Token, sedangkan SDK @google/generative-ai membutuhkan API Key dari Google AI Studio.");
    return res.status(200).json({
      ...FALLBACK_RESPONSE,
      catatan_ketidakpastian: "Layanan AI tidak dapat diakses karena masalah autentikasi. Menggunakan prosedur keselamatan umum.",
    });
  }

  // Validate & sanitize input
  const sanitized = sanitizeInput(req.body);

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: SYSTEM_INSTRUCTION,
    });

    const prompt = buildDetectionPrompt(sanitized);

    const result = await model.generateContent(prompt);
    const response = result.response;
    let text = response.text().trim();

    // Parse JSON response dari Gemini
    // Bersihkan markdown code block jika ada
    text = text.replace(/```(?:json)?\s*/g, "").replace(/```\s*/g, "").trim();

    try {
      const parsed = JSON.parse(text);

      // Validasi response: pastikan field wajib ada
      const required = ["gas_terdeteksi", "status_risiko", "ringkasan_bahaya", "langkah_mitigasi"];
      for (const field of required) {
        if (!(field in parsed)) {
          console.warn(`[AI-Safety] Missing field '${field}' in Gemini response. Using fallback.`);
          return res.status(200).json(FALLBACK_RESPONSE);
        }
      }

      // Validasi: pastikan status_risiko konsisten
      if (!["AMAN", "WASPADA", "BAHAYA"].includes(parsed.status_risiko)) {
        parsed.status_risiko = sanitized.severity;
      }

      return res.status(200).json(parsed);
    } catch {
      // Gemini mengembalikan response non-JSON
      console.error("[AI-Safety] Gemini response is not valid JSON:", text.slice(0, 200));
      return res.status(200).json({
        ...FALLBACK_RESPONSE,
        ringkasan_bahaya: text.slice(0, 500), // Use raw text as summary
        catatan_ketidakpastian: "Response AI dalam format teks bebas. Interpretasi mungkin tidak terstruktur sempurna.",
      });
    }
  } catch (error: unknown) {
    let userErrorMessage = "Layanan AI mengalami gangguan.";
    
    if (error instanceof Error) {
      // Sembunyikan credential dari log
      const safeLogMsg = error.message.replace(/key=([^&\s]+)/g, "key=***");
      console.error("[AI-Safety] Gemini API error:", safeLogMsg);
      
      if (error.message.includes("401") || error.message.includes("invalid authentication credentials") || error.message.includes("ACCESS_TOKEN_TYPE_UNSUPPORTED")) {
        console.error("[AI-Safety] Authentication failure: API Key is invalid or not accepted.");
        userErrorMessage = "Layanan AI tidak dapat diakses karena masalah autentikasi.";
      } else if (error.message.includes("429") || error.message.includes("quota") || error.message.includes("rate limit")) {
        userErrorMessage = "Layanan AI sedang sibuk (rate limit).";
      } else if (error.message.includes("timeout") || error.message.includes("fetch failed") || error.message.includes("503")) {
        userErrorMessage = "Layanan AI mengalami timeout atau tidak dapat dijangkau.";
      }
    } else {
      console.error("[AI-Safety] Unknown Gemini API error:", error);
    }

    // Rate limit / timeout / auth error — return safe fallback
    return res.status(200).json({
      ...FALLBACK_RESPONSE,
      catatan_ketidakpastian: `${userErrorMessage} Ikuti prosedur keselamatan umum.`,
    });
  }
}
