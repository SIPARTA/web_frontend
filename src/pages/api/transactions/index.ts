import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "../../../lib/auth";

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const authUser = getAuthenticatedUser(req);
  if (!authUser) {
    return res.status(401).json({ error: "Unauthorized. Please authenticate with MetaMask." });
  }

  const userRole = authUser.role;
  const userId = authUser.id;
  const address = authUser.address;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: "Supabase configuration missing" });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Base query for transaction_logs
    let query = supabase
      .from("transaction_logs")
      .select(`
        id,
        tx_hash,
        status,
        audit_log_id,
        error_message,
        created_at,
        retry_count
      `)
      .order("created_at", { ascending: false })
      .limit(100);

    const { data, error } = await query;

    if (error) {
      console.error("[API/transactions] Supabase error:", error);
      return res.status(500).json({ error: error.message });
    }

    const enrichedData = await Promise.all(
      (data || []).map(async (tx) => {
        try {
          let details = null;
          let ownerAddress = null;

          if (tx.audit_log_id) {
            const { data: audit, error: auditErr } = await supabase
              .from("audit_log")
              .select("incident_event_id, action, incident_events(incident_type, severity, iot_devices(user_id, name))")
              .eq("id", tx.audit_log_id)
              .maybeSingle();
              
            if (auditErr) console.error("[API/transactions] Audit query error:", auditErr);
              
            if (audit && audit.incident_events) {
              const incident = audit.incident_events as any;
              details = {
                type: incident.incident_type,
                severity: incident.severity,
                deviceName: incident.iot_devices?.name,
                action: audit.action
              };
              
              const userId = incident.iot_devices?.user_id;
              
              if (userId) {
                const { data: owner, error: ownerErr } = await supabase
                  .from("users")
                  .select("wallet_address")
                  .eq("id", userId)
                  .maybeSingle();
                  
                if (ownerErr) console.error("[API/transactions] Owner query error:", ownerErr);
                  
                if (owner) {
                  ownerAddress = owner.wallet_address;
                }
              }
            }
          }
          
          return {
            ...tx,
            details,
            ownerAddress,
            network: "Polygon Amoy"
          };
        } catch (innerErr) {
          console.error("[API/transactions] Error processing tx:", tx.id, innerErr);
          return { ...tx, details: null, ownerAddress: null, network: "Polygon Amoy" };
        }
      })
    );

    // Filter by ownership if not admin (and if an address is provided)
    let finalData = enrichedData;
    if (userRole !== "admin" && address) {
      finalData = enrichedData.filter(
        tx => tx.ownerAddress && tx.ownerAddress.toLowerCase() === (address as string).toLowerCase()
      );
    }

    return res.status(200).json(finalData);
  } catch (err: any) {
    console.error("[API/transactions] Unexpected error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
