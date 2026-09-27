import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { wallet_address } = req.body;
  if (!wallet_address) {
    return res.status(400).json({ error: "Wallet address is required" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn("[API/auth] Supabase env vars missing.");
    return res.status(200).json({ success: true, user: { wallet_address } });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Cek apakah wallet sudah ada
    const { data: existing, error: findError } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", wallet_address)
      .single();

    if (findError && findError.code !== "PGRST116") { // PGRST116 = not found
      throw findError;
    }

    let user = existing;

    // Jika belum ada, masukkan data baru
    if (!existing) {
      const { data: inserted, error: insertError } = await supabase
        .from("users")
        .insert([{ wallet_address, role: "student" }])
        .select()
        .single();
        
      if (insertError) throw insertError;
      user = inserted;
    }

    return res.status(200).json({ success: true, user });
  } catch (err: any) {
    console.error("[API/auth] Supabase error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
