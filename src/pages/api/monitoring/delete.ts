import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "../../../lib/auth";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized. Please authenticate with MetaMask." });
  }

  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ error: "Missing incident ID" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase configuration missing" });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Verifikasi record ada
  const { error: existError } = await supabase
    .from("incident_events")
    .select("id")
    .eq("id", id)
    .single();

  if (existError) {
    return res.status(404).json({ error: "Record not found or already deleted" });
  }

  const { error } = await supabase
    .from("incident_events")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[API/monitoring/delete] Supabase delete error:", error);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ success: true });
}
