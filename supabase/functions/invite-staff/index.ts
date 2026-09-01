// ============================================================
// MedCare — invite-staff Edge Function
// ------------------------------------------------------------
// The one thing the browser is not allowed to do: create an account for
// somebody else. It needs the service_role key, which bypasses every RLS
// policy and so can never sit in a page anyone can open with DevTools.
// This function holds that key on the server, and does three things the
// admin page cannot:
//
//   1. Prove the caller is really an admin — against their STORED role,
//      not anything the browser claimed.
//   2. Send an invitation email via Supabase's admin API (which uses the
//      project's configured SMTP — Brevo, for MedCare).
//   3. Write the invited person's role, a column no client may set.
//
// It never sets a password. The invite email carries a one-time link to
// accept-invite.html, where the invited person sets their own.
//
// deploy: supabase functions deploy invite-staff  (verify_jwt on)
// The platform checks there is *a* valid JWT before this runs; the admin
// check below is what makes it an ADMIN's JWT specifically.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Trim, drop to null when empty, and cap the length. The same limits the
// profiles constraints enforce, applied before the value ever reaches the
// database so a too-long name is a clear 400 rather than a raw 23514.
function clip(v: unknown, max: number): string | null {
  const s = String(v ?? "").trim();
  return s ? s.slice(0, max) : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    return json({ error: "not_configured", detail: "Function env vars are missing." }, 500);
  }

  // ---- 1. Who is calling? ----
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "not_signed_in" }, 401);

  // The anon client is only used to validate the caller's token against
  // the auth server; it holds no privilege of its own.
  const asCaller = createClient(url, anonKey);
  const { data: userData, error: userErr } = await asCaller.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "not_signed_in" }, 401);
  const callerId = userData.user.id;

  // The privileged client. Everything past here runs as service_role.
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ---- 2. Is the caller an admin? ----
  // Read their STORED role. A browser can send any token it likes; it
  // cannot make profiles.role say 'admin' for a row it does not own.
  const { data: caller, error: callerErr } = await admin
    .from("profiles").select("role").eq("id", callerId).maybeSingle();
  if (callerErr) return json({ error: "role_lookup_failed", detail: callerErr.message }, 500);
  if (!caller || caller.role !== "admin") return json({ error: "not_admin" }, 403);

  // ---- 3. Validate the invitation ----
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = clip(body.full_name, 80);
  const displayName = clip(body.display_name, 60);
  const role = String(body.role ?? "");
  const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : undefined;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "bad_email" }, 400);
  // Staff only. Readers sign themselves up; nobody is invited as a reader,
  // and 'admin' is not smuggled in through a typo in some other value.
  if (role !== "editor" && role !== "admin") return json({ error: "bad_role" }, 400);

  // ---- 4. Send the invitation ----
  // inviteUserByEmail creates the auth user immediately (unconfirmed, no
  // password) and emails the one-time link. The `data` becomes the new
  // user's metadata: handle_new_user reads full_name/display_name from it,
  // and accept-invite.js reads invited_role from it to know where to send
  // them once they are in.
  const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, display_name: displayName, invited_role: role },
    redirectTo,
  });
  if (inviteErr) {
    const msg = inviteErr.message || "";
    if (/already.*(registered|exists)|duplicate/i.test(msg)) {
      return json({ error: "already_exists", detail: msg }, 409);
    }
    return json({ error: "invite_failed", detail: msg }, 400);
  }

  const newId = invited?.user?.id;
  if (!newId) {
    return json({ error: "invite_failed", detail: "No user was returned by the invite." }, 500);
  }

  // ---- 5. Grant the role ----
  // The on_auth_user_created trigger has already made a profile for the
  // new id, with role 'user' and the name from metadata. Only service_role
  // may change role, so it is set here rather than in the trigger (which
  // would then be trusting client-supplied metadata for a privilege).
  const { error: roleErr } = await admin
    .from("profiles").update({ role }).eq("id", newId);
  if (roleErr) {
    // The invitation is already out and the account exists — say so, so
    // the admin knows to fix the role from the list rather than re-invite.
    return json({ error: "role_assign_failed", detail: roleErr.message, email }, 500);
  }

  return json({ ok: true, email, role }, 200);
});
