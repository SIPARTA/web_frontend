import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthenticatedUser } from "../../../lib/auth";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authUser = getAuthenticatedUser(req);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { incidentId } = req.body;
  
  if (!incidentId) {
    return res.status(400).json({ error: "incidentId is required" });
  }

  try {
    const FASTAPI_URL = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
    
    const response = await fetch(`${FASTAPI_URL}/api/v1/incidents/${incidentId}/verify-onchain`);
    
    if (!response.ok) {
      throw new Error(`FastAPI responded with ${response.status}`);
    }
    
    const data = await response.json();
    
    return res.status(200).json(data);
  } catch (error: any) {
    console.error("[API/verify] Error verifying onchain:", error);
    return res.status(500).json({ error: "Failed to verify onchain" });
  }
}
