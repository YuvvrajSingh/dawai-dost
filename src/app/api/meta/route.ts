import { NextResponse } from "next/server";
import { getEngine } from "@/lib/server/engine";

export const runtime = "nodejs";

export async function GET() {
  const e = getEngine();
  return NextResponse.json({ builtAt: e.builtAt, products: e.products.length, sources: e.sources, ocr: !!process.env.GEMINI_API_KEY });
}
