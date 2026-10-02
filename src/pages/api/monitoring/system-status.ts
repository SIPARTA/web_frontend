import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthenticatedUser } from "../../../lib/auth";

const BACKEND_URL = process.env.NODE_ENV === "production" 
  ? (process.env.NEXT_PUBLIC_DISEASE_API_URL || "https://siparta-backend.onrender.com")
  : (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000");

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized." });
  }

  const now_iso = new Date().toISOString();
  
  // Construct Gemini Status locally in Next.js
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const gemini_ai_info = {
    name: "Google Gemini API (Safety Analysis)",
    api_status: hasGeminiKey ? "online" : "offline",
    backend_connectivity: hasGeminiKey ? "connected" : "disconnected",
    model_configured: "gemini-1.5-flash", 
    last_checked: now_iso,
    response_status: hasGeminiKey ? "ok" : "error",
    error_message: hasGeminiKey ? null : "GEMINI_API_KEY tidak ditemukan di environment variable frontend."
  };

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/v1/system-status`);
    if (!backendRes.ok) {
      return res.status(200).json({
        gemini_ai: gemini_ai_info,
        ai_jst: {
          name: "SIPARTA ANN Sensor Classification",
          version: null,
          deployment_status: "not_deployed",
          model_loaded: "unverified",
          inference_readiness: "unverified",
          last_checked: now_iso,
          error_message: `Gagal menghubungi backend: HTTP ${backendRes.status}`
        },
        dataset: {
          name: "SIPARTA Real Sensor Dataset",
          source: "Unknown",
          availability: "unverified",
          sample_count: null,
          feature_count: null,
          version_or_updated: null,
          preprocessing_match: "unverified",
          last_checked: now_iso,
          error_message: `Gagal menghubungi backend: HTTP ${backendRes.status}`
        }
      });
    }
    
    const data = await backendRes.json();
    return res.status(200).json({
      gemini_ai: gemini_ai_info,
      ai_jst: data.ai_jst,
      dataset: data.dataset
    });
    
  } catch (err: any) {
    console.error("[API/monitoring/system-status] Error:", err);
    return res.status(200).json({
      gemini_ai: gemini_ai_info,
      ai_jst: {
        name: "SIPARTA ANN Sensor Classification",
        version: null,
        deployment_status: "not_deployed",
        model_loaded: "unverified",
        inference_readiness: "unverified",
        last_checked: now_iso,
        error_message: "Network Error: Gagal menghubungi FastAPI Backend."
      },
      dataset: {
        name: "SIPARTA Real Sensor Dataset",
        source: "Unknown",
        availability: "unverified",
        sample_count: null,
        feature_count: null,
        version_or_updated: null,
        preprocessing_match: "unverified",
        last_checked: now_iso,
        error_message: "Network Error: Gagal menghubungi FastAPI Backend."
      }
    });
  }
}

