import jwt from "jsonwebtoken";
import type { NextApiRequest } from "next";

export function getAuthenticatedUser(req: NextApiRequest) {
  const token = req.cookies.siparta_token;
  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "siparta-fallback-secret-2026");
    return decoded as { address: string; role: string; id: string };
  } catch (err) {
    return null;
  }
}
