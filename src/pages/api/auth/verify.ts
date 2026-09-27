import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";
import jwt from "jsonwebtoken";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { address, signature, message } = req.body;
  
  if (!address || !signature || !message) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase configuration missing" });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Ambil data user dari Supabase
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", address)
      .single();

    if (userError || !user) {
      return res.status(401).json({ error: "User not found in database" });
    }

    if (!user.nonce) {
      return res.status(401).json({ error: "No nonce found. Please request a new nonce." });
    }

    // Ekstrak nonce dari message (baris terakhir)
    const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
    if (!nonceMatch || nonceMatch[1] !== user.nonce) {
      return res.status(401).json({ error: "Invalid nonce in message" });
    }

    // Verifikasi signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: "Signature verification failed" });
    }

    // Kosongkan nonce agar tidak bisa dipakai ulang (prevent replay attack)
    await supabase.from("users").update({ nonce: null }).eq("wallet_address", address);

    const token = jwt.sign(
      { address: user.wallet_address, role: user.role, id: user.id },
      process.env.JWT_SECRET || "siparta-fallback-secret-2026",
      { expiresIn: "1d" }
    );

    res.setHeader("Set-Cookie", `siparta_token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`);

    // Kirim balik data user yang valid sebagai session
    return res.status(200).json({ success: true, user });
  } catch (err: any) {
    console.error("[API/auth/verify] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
