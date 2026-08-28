// OAuth landing: exchanges the PKCE code, then moves the Gmail refresh token
// into Vault via the store_gmail_connection definer function. The token
// never touches a table and never reaches the browser again.
import { NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/connect?error=missing_code", url.origin));
  }

  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session) {
    return NextResponse.redirect(new URL("/connect?error=exchange_failed", url.origin));
  }

  const refreshToken = data.session.provider_refresh_token;
  const email = data.session.user.email;
  if (!refreshToken || !email) {
    // Google only issues a refresh token on a prompt=consent flow; without it
    // the import pipeline can't run, so treat this as a failed connect.
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/connect?error=no_refresh_token", url.origin));
  }

  const { error: rpcError } = await supabase.rpc("store_gmail_connection", {
    p_email: email,
    p_refresh_token: refreshToken,
  });
  if (rpcError) {
    console.error("store_gmail_connection failed:", rpcError.message);
    return NextResponse.redirect(new URL("/connect?error=store_failed", url.origin));
  }

  return NextResponse.redirect(new URL("/plan", url.origin));
}
