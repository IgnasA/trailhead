"use client";

import { useState } from "react";
import { supabaseBrowser } from "../../lib/supabase/client";

export function ConnectButton() {
  const [busy, setBusy] = useState(false);

  async function connect() {
    setBusy(true);
    const supabase = supabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/gmail.readonly",
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent", // required for Google to issue a refresh token
        },
      },
    });
  }

  return (
    <button className="btn btn-primary" onClick={connect} disabled={busy}>
      {busy ? "Opening Google…" : "Continue with Google"}
    </button>
  );
}
