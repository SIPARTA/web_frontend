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
      .or(`wallet_address.eq.${address},metamask_address.eq.${address}`)
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
    await supabase.from("users").update({ nonce: null }).eq("id", user.id);

    let finalUser = user;
    const existingToken = req.cookies?.siparta_token;
    
    if (existingToken) {
      try {
        const decoded = jwt.verify(existingToken, process.env.JWT_SECRET || "siparta-fallback-secret-2026") as any;
        if (decoded && decoded.id && decoded.id !== user.id) {
          // Wallet account and currently logged in account are different. We need to link them.
          const { data: incidents } = await supabase.from("incident_events").select("id").eq("user_id", user.id);
          // Wait, actually the table is transaction_logs, but previous script said transactions_logs in error, but migration 0007 fixes it to transaction_logs. Let's query transaction_logs.
          const { data: txs } = await supabase.from("transaction_logs").select("id").eq("user_id", user.id);
          
          const isUserEmpty = (!incidents || incidents.length === 0) && (!txs || txs.length === 0);
          
          if (isUserEmpty && !user.wallet_address.startsWith("google:") && !user.wallet_address.startsWith("email:")) {
            // Delete the empty wallet user
            await supabase.from("users").delete().eq("id", user.id);
            // Update the logged in user
            const { data: updatedUser, error: updateErr } = await supabase
              .from("users")
              .update({ metamask_address: address })
              .eq("id", decoded.id)
              .select("*")
              .single();
            if (updateErr) throw updateErr;
            finalUser = updatedUser;
          } else {
            return res.status(400).json({ error: "Wallet ini sudah terhubung dengan akun SIPARTA lain." });
          }
        }
      } catch (e) {
        console.error("Token linking error", e);
      }
    }

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
