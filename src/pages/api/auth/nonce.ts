import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { address } = req.query;
  if (!address || typeof address !== "string") {
    return res.status(400).json({ error: "Address is required" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase configuration missing" });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Cek apakah user ada, jika tidak buat baru dengan role default
    const { data: user, error: findError } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", address)
      .single();

    let targetUser = user;

    if (findError && findError.code !== "PGRST116") {
      throw findError;
    }

    if (!user) {
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert([{ wallet_address: address, role: "student" }])
        .select()
        .single();
      if (insertError) throw insertError;
      targetUser = newUser;
    }

    // Generate nonce
    const nonce = crypto.randomBytes(32).toString("hex");

    // Simpan nonce ke database
    const { error: updateError } = await supabase
      .from("users")
      .update({ nonce })
      .eq("wallet_address", address);
      
    if (updateError) throw updateError;

    return res.status(200).json({ nonce });
  } catch (err: any) {
    console.error("[API/auth/nonce] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
