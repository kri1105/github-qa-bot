import { NextRequest, NextResponse } from "next/server";

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8080";

export async function GET(
  _req: NextRequest,
  { params }: { params: { collection: string } },
) {
  try {
    const res  = await fetch(`${BACKEND}/api/files/${params.collection}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Proxy error";
    return NextResponse.json({ detail: msg }, { status: 502 });
  }
}
