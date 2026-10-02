import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { access_token } = req.body;
  
  if (!access_token) {
    return res.status(400).json({ error: "Missing access token" });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase configuration missing" });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify token using Supabase
    const { data: { user: sbUser }, error: userError } = await supabase.auth.getUser(access_token);

    if (userError || !sbUser) {
      return res.status(401).json({ error: "Invalid Email Auth token" });
    }

    const providerId = `email:${sbUser.id}`;
    
    // Check if user already exists in public.users
    const { data: existingUser, error: findError } = await supabase
      .from("users")
      .select("*")
      .eq("wallet_address", providerId)
      .single();

    let targetUser = existingUser;

    if (findError && findError.code !== "PGRST116") {
      throw findError;
    }

    if (!existingUser) {
      // Create new user for Email login
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert([{ 
          wallet_address: providerId, 
          role: "student",
          name: sbUser.user_metadata?.full_name || sbUser.email || "Email User"
        }])
        .select()
        .single();
        
      if (insertError) throw insertError;
      targetUser = newUser;
    } else {
      // Optionally update name if missing
      if (!existingUser.name && sbUser.user_metadata?.full_name) {
        const { data: updatedUser } = await supabase
          .from("users")
          .update({ name: sbUser.user_metadata.full_name })
          .eq("wallet_address", providerId)
          .select()
          .single();
        if (updatedUser) targetUser = updatedUser;
      }
    }

    // Generate unified siparta JWT (identical to SIWE flow)
    const token = jwt.sign(
      { address: targetUser.wallet_address, role: targetUser.role, id: targetUser.id },
      process.env.JWT_SECRET || "siparta-fallback-secret-2026",
      { expiresIn: "1d" }
    );

    res.setHeader("Set-Cookie", `siparta_token=${token}; HttpOnly; Path=/; Max-Age=86400; SameSite=Strict`);

    // Return unified user data
    return res.status(200).json({ success: true, user: targetUser });
  } catch (err: any) {
    console.error("[API/auth/email] Error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
