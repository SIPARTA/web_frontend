import type { NextApiRequest, NextApiResponse } from "next";
import { getAuthenticatedUser } from "../../../lib/auth";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_DISEASE_API_URL || "https://siparta-backend.onrender.com";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized. Please authenticate with MetaMask." });
  }
  const querySource = req.query.source as string;
  const monitoringSource = querySource || process.env.NEXT_PUBLIC_MONITORING_SOURCE || "iot";

  try {
    const backendRes = await fetch(`${BACKEND_URL}/api/v1/devices/status`);
    if (!backendRes.ok) {
      return res.status(200).json({ online: false, devices: [] });
    }
    const data = await backendRes.json();

    let devices = data.devices || [];
    if (querySource !== "all") {
      if (monitoringSource === "droidcam") {
        devices = devices.filter((d: any) => d.device_type === "mobile_camera_test" || d.id === "11111111-1111-1111-1111-111111111111");
      } else {
        devices = devices.filter((d: any) => d.device_type === "real_iot" || d.device_type === "iot");
      }
    }

    const isOnline = devices.some((d: any) => d.is_active);

    return res.status(200).json({
      online: isOnline,
      devices: devices
    });
  } catch (err: any) {
    console.error("[API/monitoring/status] Error:", err);
    return res.status(200).json({ online: false, devices: [] });
  }
}
