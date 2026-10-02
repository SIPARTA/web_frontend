/**
 * Next.js API Route — /api/monitoring/incidents
 * ================================================
 * Proxy tipis antara frontend dan Supabase.
 * Frontend tidak memegang Supabase key; backend route ini yang memegang.
 *
 * Query: Ambil 100 insiden terbaru, diurutkan dari yang paling baru.
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

  const authUser = getAuthenticatedUser(req);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized. Please authenticate with MetaMask." });
  }
  
  const userRole = authUser.role;
  const userId = authUser.id;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // Kembalikan array kosong jika Supabase belum dikonfigurasi (dev mode)
    console.warn("[API/monitoring] Supabase env vars tidak diset. Returning empty array.");
    return res.status(200).json([]);
  }

  const querySource = req.query.source as string;
  const monitoringSource = querySource || process.env.NEXT_PUBLIC_MONITORING_SOURCE || "iot";

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let data: any[] | null = null;
    let error: any = null;

    // Try full query first (assumes migrations 0001-0006 are applied)
    let fullQuery = supabase
      .from("incident_events")
      .select("id, incident_type, severity, image_url, timestamp, is_anchored, audit_log(ipfs_cid, action), incident_event_media(id, source, capture_status, image_reference, timestamp), iot_devices(user_id)")
      .order("timestamp", { ascending: false })
      .limit(100);
      
    // Apply DB level isolation if possible (requires 0007 migration)
    if (userRole !== "admin") {
       fullQuery = fullQuery.eq("user_id", userId);
    }

    const resFull = await fullQuery;

    data = resFull.data;
    error = resFull.error;

    // If there's an error (likely PGRST200 or 42703 missing column/relationship because production DB is outdated)
    if (error) {
      console.warn("[API/monitoring] Full query failed, attempting fallback query. Error:", error.message);
      let resFallback = await supabase
        .from("incident_events")
        .select("id, incident_type, severity, image_url, timestamp, is_anchored, iot_devices(user_id)")
        .order("timestamp", { ascending: false })
        .limit(100);
        
      if (resFallback.error) {
        // Ultimate fallback without iot_devices relationship
        resFallback = await supabase
          .from("incident_events")
          .select("id, incident_type, severity, image_url, timestamp, is_anchored")
          .order("timestamp", { ascending: false })
          .limit(100);
          
        if (resFallback.error) {
           console.error("[API/monitoring] Supabase fallback error:", resFallback.error);
           return res.status(500).json({ error: resFallback.error.message });
        }
      }
      data = resFallback.data;
      error = null;
    }
    
    // In-memory ownership filtering for fallback if DB column isolation failed/skipped
    if (userRole !== "admin" && data) {
       data = data.filter((inc: any) => {
          // If the DB level filter worked, we wouldn't need this, but if column was missing, we check iot_devices
          if (inc.user_id !== undefined && inc.user_id == userId) return true;
          // Fallback to checking device owner
          if (inc.iot_devices && inc.iot_devices.user_id == userId) return true;
          // If no ownership info is present but we are in fallback, assume unauthorized (or handle as needed)
          return false;
       });
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

    // Hydrate sensor data using FastAPI decryption endpoint
    const backendUrl = process.env.NODE_ENV === "production"
      ? (process.env.NEXT_PUBLIC_DISEASE_API_URL || "https://siparta-backend.onrender.com")
      : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000");
    for (const incident of mappedData) {
      if (incident.audit_log && incident.audit_log.length > 0) {
        // array audit_log depends on the exact structure, supabase returns an array for one-to-many
        const log = Array.isArray(incident.audit_log) ? incident.audit_log[0] : incident.audit_log;
        const cid = log?.ipfs_cid;
        if (cid) {
          try {
             const res = await fetch(`${backendUrl}/api/v1/incidents/decrypted/${cid}`);
             if (res.ok) {
                const dec = await res.json();
                if (dec.decrypted_data && dec.decrypted_data.sensor_data) {
                    incident.sensor_data = dec.decrypted_data.sensor_data;
                }
             }
          } catch(e) { console.error("[API/monitoring] Failed to decrypt CID:", cid, e); }
        }
      }
    }

    return res.status(200).json(mappedData);
  } catch (err: any) {
    console.error("[API/monitoring] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
