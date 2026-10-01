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

    // Ekstrak nonce dari message
    const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/);
    if (!nonceMatch || nonceMatch[1] !== user.nonce) {
      return res.status(401).json({ error: "Invalid nonce in message" });
    }

    // Validasi EIP-4361 properties
    const domainMatch = message.match(/^([a-zA-Z0-9.-]+) wants you to sign in/);
    const uriMatch = message.match(/URI: (https?:\/\/[^\n]+)/);
    const chainIdMatch = message.match(/Chain ID: (\d+)/);

    // Dapatkan host dari request (bisa dari headers.host)
    const reqHost = req.headers.host;
    
    if (domainMatch && reqHost && domainMatch[1] !== reqHost) {
      return res.status(401).json({ error: "Invalid domain in SIWE message" });
    }
    if (chainIdMatch && chainIdMatch[1] !== "80002") {
      return res.status(401).json({ error: "Invalid Chain ID in SIWE message. Must be 80002 (Polygon Amoy)" });
    }

    // Verifikasi signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
      return res.status(401).json({ error: "Signature verification failed" });
    }

    // Kosongkan nonce agar tidak bisa dipakai ulang (prevent replay attack)
    await supabase.from("users").update({ nonce: null }).eq("id", user.id);

    const finalUser = user;

    const token = jwt.sign(
      { address: finalUser.wallet_address, role: finalUser.role, id: finalUser.id },
      process.env.JWT_SECRET || "siparta-fallback-secret-2026",
      { expiresIn: "1d" }
    );

    res.setHeader("Set-Cookie", `siparta_token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`);

    // Kirim balik data user yang valid sebagai session
    return res.status(200).json({ success: true, user: finalUser });
  } catch (err: any) {
    console.error("[API/auth/verify] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
