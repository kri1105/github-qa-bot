import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(req: NextRequest) {
  // Read collection from URL path — avoids Next.js 15 async params issues
  const collection = req.nextUrl.pathname.split("/").pop() ?? "";
  try {
    const res  = await fetch(`${BACKEND}/api/files/${collection}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Proxy error";
    return NextResponse.json({ detail: msg }, { status: 502 });
  }
}
