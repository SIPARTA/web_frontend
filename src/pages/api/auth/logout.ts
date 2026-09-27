import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Clear the siparta_token cookie
  res.setHeader("Set-Cookie", "siparta_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict");
  return res.status(200).json({ success: true });
}
