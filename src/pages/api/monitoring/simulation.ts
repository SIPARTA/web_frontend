/**
 * Next.js API Route — /api/monitoring/simulation
 * =================================================
 * Proxy ke FastAPI /api/v1/simulation/* endpoints.
 * Menyediakan data simulasi dari Dataset Sensor SIPARTA.csv
 * untuk demonstrasi website.
 *
 * SEMUA data ditandai sebagai SIMULATION / DEMO MODE.
 */

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
    return res.status(401).json({ error: "Unauthorized. Please authenticate with MetaMask." });
  }

  const { action, bahan, count } = req.query;

  try {
    let endpoint = `${BACKEND_URL}/api/v1/simulation`;

    if (action === "scenarios") {
      endpoint += "/scenarios";
    } else {
      // Default: sample
      endpoint += "/sample";
      const params = new URLSearchParams();
      if (bahan) params.set("bahan", String(bahan));
      if (count) params.set("count", String(count));
      params.set("random_pick", "true");
      endpoint += `?${params.toString()}`;
    }

    const backendRes = await fetch(endpoint);

    if (!backendRes.ok) {
      const errorData = await backendRes.json().catch(() => ({}));
      return res.status(backendRes.status).json({
        error: errorData.detail || `Backend returned HTTP ${backendRes.status}`,
        source: "SIMULATION",
        mode: "DEMO"
      });
    }

    const data = await backendRes.json();
    return res.status(200).json(data);

  } catch (err: unknown) {
    console.error("[API/monitoring/simulation] Error:", err);

    // Graceful fallback: return empty simulation result
    return res.status(200).json({
      source: "SIMULATION",
      mode: "DEMO",
      ai_model_loaded: false,
      results: [],
      error: `Gagal menghubungi backend simulasi: ${err instanceof Error ? err.message : "Unknown error"}`,
      fallback: true
    });
  }
}
