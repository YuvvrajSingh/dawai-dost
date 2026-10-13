import { NextResponse } from "next/server";
import { getEngine } from "@/lib/server/engine";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const m = getEngine().get(id);
  return m ? NextResponse.json(m) : NextResponse.json({ error: "Not found" }, { status: 404 });
}
