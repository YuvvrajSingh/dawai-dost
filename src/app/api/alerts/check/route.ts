import { NextResponse } from "next/server";
import { checkAlerts } from "@/lib/server/push";

export const runtime = "nodejs";

/** For a cron job on serverless hosts. Protected by CRON_SECRET when set. */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const fired = await checkAlerts();
  return NextResponse.json({ ok: true, fired });
}
