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

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return json({ error: "not_signed_in" }, 401);

  const asCaller = createClient(url, anonKey);
  const { data: userData, error: userErr } = await asCaller.auth.getUser(token);
  if (userErr || !userData?.user) return json({ error: "not_signed_in" }, 401);
  const callerId = userData.user.id;

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: caller, error: callerErr } = await admin
    .from("profiles").select("role").eq("id", callerId).maybeSingle();
  if (callerErr) return json({ error: "role_lookup_failed", detail: callerErr.message }, 500);
  if (!caller || caller.role !== "admin") return json({ error: "not_admin" }, 403);

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = clip(body.full_name, 80);
  const displayName = clip(body.display_name, 60);
  const role = String(body.role ?? "");
  const redirectTo = typeof body.redirectTo === "string" ? body.redirectTo : undefined;

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: "bad_email" }, 400);

  if (role !== "editor" && role !== "admin") return json({ error: "bad_role" }, 400);

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

  const { error: roleErr } = await admin
    .from("profiles").update({ role }).eq("id", newId);
  if (roleErr) {

    return json({ error: "role_assign_failed", detail: roleErr.message, email }, 500);
  }

  return json({ ok: true, email, role }, 200);
});
