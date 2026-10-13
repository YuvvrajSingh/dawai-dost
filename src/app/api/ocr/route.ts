import { NextResponse } from "next/server";
import { readStrip } from "@/lib/strip-reader";
export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "OCR is not configured on the server." }, { status: 501 });
  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ error: "Send an image upload." }, { status: 400 }); }
  const file = form.get("image");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No image received." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Image is larger than 8 MB." }, { status: 413 });
  if (!file.size || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return NextResponse.json({ error: "Upload a JPEG, PNG or WebP image." }, { status: 415 });
  try { return NextResponse.json(await readStrip(file)); }
  catch (e) {
    console.error("[ocr]", (e as Error).message);
    return NextResponse.json({ error: "We could not read this image. Try a clearer photo." }, { status: 502 });
  }
}
