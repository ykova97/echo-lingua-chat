import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const encoder = new TextEncoder();

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
    console.log("Processing guest invite acceptance");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    const { token, name, preferredLanguage } = await req.json();
    
    if (!token || !name || !preferredLanguage) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "token, name, preferredLanguage required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Validating invite token: ${token}`);

    // Validate invite token
    const { data: invite, error: invErr } = await supabase
      .from("guest_invites")
      .select("*")
      .eq("token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (invErr || !invite) {
      console.error("Invalid or expired invite:", invErr);
      return new Response(
        JSON.stringify({ error: "Invalid or expired invite" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invite.used_count >= invite.max_uses) {
      console.error("Invite already fully used");
      return new Response(
        JSON.stringify({ error: "Invite already used" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating guest session for: ${name}`);

    // Create guest session
    const { data: guest, error: gErr } = await supabase
      .from("guest_sessions")
      .insert({
        invite_id: invite.id,
        display_name: name,
        preferred_language: preferredLanguage
      })
      .select("*")
      .single();

    if (gErr || !guest) {
      console.error("Failed to create guest session:", gErr);
      return new Response(
        JSON.stringify({ error: gErr?.message || "Failed to create guest session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Creating ephemeral chat for guest ${guest.id}`);

    // Create ephemeral chat between inviter and this guest
    const { data: chat, error: cErr } = await supabase
      .from("chats")
      .insert({
        type: "direct",
        is_ephemeral: true,
        created_by: invite.inviter_id,
        name: `${guest.display_name} ↔ Invite`,
        delete_after: new Date(Date.now() + 6 * 3600_000).toISOString() // auto delete after 6h
      })
      .select("*")
      .single();

    if (cErr || !chat) {
      console.error("Failed to create chat:", cErr);
      return new Response(
        JSON.stringify({ error: cErr?.message || "Failed to create chat" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Adding participants to chat ${chat.id}`);

    // Add inviter as real participant
    const { error: inviterErr } = await supabase
      .from("chat_participants")
      .insert({ chat_id: chat.id, user_id: invite.inviter_id });

    if (inviterErr) {
      console.error("Failed to add inviter as participant:", inviterErr);
    }

    // Add guest as virtual participant (guest.id not in auth.users, but fine for chat scoping)
    const { error: guestErr } = await supabase
      .from("chat_participants")
      .insert({ chat_id: chat.id, user_id: guest.id });

    if (guestErr) {
      console.error("Failed to add guest as participant:", guestErr);
    }

    // Increment usage count
    await supabase
      .from("guest_invites")
      .update({ used_count: invite.used_count + 1 })
      .eq("id", invite.id);

    console.log(`Generating JWT token for guest session ${guest.id}`);

    // Issue a short-lived JWT scoped to this chat
    const payload = {
      aud: "authenticated",
      role: "authenticated",
      exp: getNumericDate(60 * 60), // 1 hour
      chat_id: chat.id, // used by RLS policies
      guest_session_id: guest.id
    };

    // Convert JWT secret to CryptoKey
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(jwtSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );

    const tokenForGuest = await create(
      { alg: "HS256", typ: "JWT" },
      payload,
      key
    );

    console.log(`Guest invite accepted successfully, chat ${chat.id} created`);

    return new Response(
      JSON.stringify({
        chatId: chat.id,
        supabaseUrl,
        guestJwt: tokenForGuest,
        guest: {
          id: guest.id,
          name: guest.display_name,
          lang: guest.preferred_language
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in accept-qr-invite:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
