import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { nanoid } from "https://esm.sh/nanoid@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { inviterId, ttlHours = 24, maxUses = 1 } = body;

    if (!inviterId) {
      return new Response(JSON.stringify({ error: "inviterId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use baseUrl from request or fall back to PUBLIC_APP_URL secret
    const baseUrl = body?.baseUrl || Deno.env.get("PUBLIC_APP_URL");
    
    if (!baseUrl) {
      return new Response(JSON.stringify({ error: "baseUrl or PUBLIC_APP_URL must be configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000).toISOString();

    const { data, error } = await supabase.from("guest_invites").insert({
      inviter_id: inviterId,
      token,
      expires_at: expiresAt,
      max_uses: maxUses,
    }).select("id, token, expires_at").single();

    if (error) throw error;

    // The correct invite link for guests
    const inviteUrl = `${baseUrl.replace(/\/$/, "")}/guest/${data.token}`;

    return new Response(JSON.stringify({ inviteUrl, token: data.token, expiresAt: data.expires_at }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-qr-invite error:", e);
    const errorMessage = e instanceof Error ? e.message : "Internal error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
