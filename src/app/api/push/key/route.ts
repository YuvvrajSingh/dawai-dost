import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/lib/server/push";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ publicKey: vapidPublicKey() });
}
