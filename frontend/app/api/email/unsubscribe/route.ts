import { NextResponse, type NextRequest } from "next/server";
import { setOptOutByToken } from "@/lib/lifecycle/optOut";

/**
 * RFC 8058 one-click unsubscribe: mail clients (Gmail, Apple Mail) POST
 * `List-Unsubscribe=One-Click` here, from the List-Unsubscribe header of
 * every lifecycle email. No login; the signed token says who.
 *
 * People clicking the link in the email land on /unsubscribe instead.
 */

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const ok = await setOptOutByToken(req.nextUrl.searchParams.get("t"), true);
    return ok ? new NextResponse(null, { status: 204 }) : NextResponse.json({ error: "invalid token" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "could not unsubscribe" }, { status: 500 });
  }
}

/** A GET (a prefetcher, or someone pasting the link) goes to the page. */
export function GET(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/unsubscribe";
  return NextResponse.redirect(url, 303);
}
