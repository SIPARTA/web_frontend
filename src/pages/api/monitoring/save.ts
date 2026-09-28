import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "../../../lib/auth";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized. Please authenticate with MetaMask." });
  }

  const { device_id, timestamp, sensors, severity } = req.body;

  if (!timestamp || !sensors || !severity) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase configuration missing" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Validasi IDempotency: Hindari duplikasi berdasarkan device_id dan timestamp
  let query = supabase
    .from("incident_events")
    .select("id")
    .eq("timestamp", timestamp);

  if (device_id) {
    query = query.eq("device_id", device_id);
  }

  const { data: existing, error: existError } = await query.maybeSingle();

  if (existError && existError.code !== "PGRST116") {
    return res.status(500).json({ error: `Check duplicate failed: ${existError.message}` });
  }

  if (existing) {
    return res.status(409).json({ error: "Data already saved (Duplicate detected)" });
  }

  // Insert data baru
  const incident_type = `GAS_${severity.toUpperCase()}`;
  
  const payload: Record<string, unknown> = {
    incident_type,
    severity: severity.toUpperCase(),
    timestamp,
    is_anchored: false,
  };

  if (device_id) {
    payload.device_id = device_id;
  }

  const { data, error } = await supabase
    .from("incident_events")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("[API/monitoring/save] Supabase insert error:", error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json(data);
}
