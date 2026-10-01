import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthenticatedUser } from "../../../lib/auth";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_DISEASE_API_URL || "https://siparta-backend.onrender.com";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/v1/system-status`);
    if (!backendRes.ok) {
      return res.status(backendRes.status).json({
        ai_jst: "offline",
        gemini_ai: "offline",
        iot_production: "offline",
        droidcam_testing: "offline"
      });
    }
    const data = await backendRes.json();
    return res.status(200).json(data);
  } catch (err: any) {
    console.error("[API/monitoring/system-status] Error:", err);
    return res.status(500).json({
      ai_jst: "offline",
      gemini_ai: "offline",
      iot_production: "offline",
      droidcam_testing: "offline"
    });
  }
}
