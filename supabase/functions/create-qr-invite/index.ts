import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { nanoid } from "https://esm.sh/nanoid@4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Creating QR invite token");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { inviterId, ttlHours = 24, maxUses = 1 } = await req.json();

    if (!inviterId) {
      console.error("Missing inviterId in request");
      return new Response(
        JSON.stringify({ error: "inviterId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = nanoid(24);
    const expiresAt = new Date(Date.now() + ttlHours * 3600_000).toISOString();

    console.log(`Creating invite for user ${inviterId}, token: ${token}, expires: ${expiresAt}`);

    const { data, error } = await supabase
      .from("guest_invites")
      .insert({
        inviter_id: inviterId,
        token,
        expires_at: expiresAt,
        max_uses: maxUses,
      })
      .select("*")
      .single();

    if (error) {
      console.error("Database error creating invite:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const inviteUrl = `${Deno.env.get("PUBLIC_APP_URL") || "http://localhost:8080"}/guest/${token}`;
    
    console.log(`Invite created successfully: ${inviteUrl}`);

    return new Response(
      JSON.stringify({ inviteUrl, token, expiresAt: data.expires_at }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
