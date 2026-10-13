import { NextResponse } from "next/server";
import { getEngine } from "@/lib/server/engine";
import type { CompositionQuery } from "@/lib/types";

export const runtime = "nodejs";

/** Compare by composition confirmed on the strip (used after OCR when the brand isn't in the catalog). */
export async function POST(req: Request) {
  const q = (await req.json().catch(() => null)) as CompositionQuery | null;
  if (!q || !Array.isArray(q.ingredients) || !q.ingredients.length || q.ingredients.length > 6) {
    return NextResponse.json({ error: "Send the salts and strengths from the strip." }, { status: 400 });
  }
  const c = getEngine().compareComposition(q);
  return c ? NextResponse.json(c) : NextResponse.json({ error: "Every salt needs a strength." }, { status: 422 });
}
