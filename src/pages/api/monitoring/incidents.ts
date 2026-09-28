/**
 * Next.js API Route — /api/monitoring/incidents
 * ================================================
 * Proxy tipis antara frontend dan Supabase.
 * Frontend tidak memegang Supabase key; backend route ini yang memegang.
 *
 * Query: Ambil 100 insiden terbaru, diurutkan dari yang paling baru.
 * sensor_data dan ai_analysis_text diambil langsung dari DB.
 * IPFS hydration hanya digunakan sebagai fallback untuk record lama.
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "../../../lib/auth";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized. Please authenticate with MetaMask." });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // Kembalikan array kosong jika Supabase belum dikonfigurasi (dev mode)
    console.warn("[API/monitoring] Supabase env vars tidak diset. Returning empty array.");
    return res.status(200).json([]);
  }

  const querySource = req.query.source as string;
  const monitoringSource = querySource || process.env.NEXT_PUBLIC_MONITORING_SOURCE || "iot";

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabase
      .from("incident_events")
      .select("id, incident_type, severity, sensor_data, ai_analysis_text, image_url, timestamp, is_anchored, audit_log(ipfs_cid, action), incident_event_media(id, source, capture_status, image_reference, timestamp)")
      .order("timestamp", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[API/monitoring] Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    let mappedData = (data ?? []).map(incident => {
      // Tentukan source_type berdasarkan data
      let sourceType = "iot";
      if (incident.incident_type === "VISUAL_AUDIT" || (incident.incident_event_media && incident.incident_event_media.length > 0)) {
        sourceType = "droidcam";
      }
      
      return {
        ...incident,
        source_type: sourceType
      };
    });

    // Filter berdasarkan mode aktif jika querySource 'all' tidak diberikan
    if (querySource !== "all") {
      mappedData = mappedData.filter(incident => incident.source_type === monitoringSource);
    }

    // Fallback: Hydrate sensor data via IPFS hanya untuk record LAMA tanpa sensor_data
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_DISEASE_API_URL || "http://127.0.0.1:8000";
    for (const incident of mappedData) {
      // Hanya hydrate jika sensor_data kosong/null (record lama sebelum fix)
      if (!incident.sensor_data && incident.audit_log) {
        const log = Array.isArray(incident.audit_log) ? incident.audit_log[0] : incident.audit_log;
        const cid = log?.ipfs_cid;
        if (cid) {
          try {
             const decryptRes = await fetch(`${backendUrl}/api/v1/incidents/decrypted/${cid}`);
             if (decryptRes.ok) {
                const dec = await decryptRes.json();
                if (dec.decrypted_data && dec.decrypted_data.sensor_data) {
                    incident.sensor_data = dec.decrypted_data.sensor_data;
                }
             }
          } catch(e) { console.error("[API/monitoring] Failed to decrypt CID:", cid, e); }
        }
      }
    }

    return res.status(200).json(mappedData);
  } catch (err: unknown) {
    console.error("[API/monitoring] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
