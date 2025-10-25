import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slug, name, preferredLanguage } = await req.json();

    console.log("start-guest-chat invoked with slug:", slug, "name:", name, "language:", preferredLanguage);

    if (!slug || !name || !preferredLanguage) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: slug, name, preferredLanguage" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // 1) Look up inviter profile by qr_slug
    const { data: inviterProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, name, max_guest_hours, qr_slug")
      .eq("qr_slug", slug)
      .single();

    if (profileError || !inviterProfile) {
      console.error("Profile lookup failed:", profileError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired QR code" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Found inviter profile:", inviterProfile.id, inviterProfile.name);

    // 2) Create guest session
    const guestSessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + inviterProfile.max_guest_hours * 3600_000);

    const { error: sessionError } = await supabase
      .from("guest_sessions")
      .insert({
        id: guestSessionId,
        invite_id: null, // Using QR slug flow, not token-based invite
        display_name: name,
        preferred_language: preferredLanguage,
        expires_at: expiresAt.toISOString(),
      });

    if (sessionError) {
      console.error("Failed to create guest session:", sessionError);
      throw sessionError;
    }

    console.log("Created guest session:", guestSessionId);

    // 3) Create ephemeral chat
    const deleteAfter = new Date(Date.now() + inviterProfile.max_guest_hours * 3600_000);

    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .insert({
        type: "direct",
        is_ephemeral: true,
        delete_after: deleteAfter.toISOString(),
        created_by: inviterProfile.id,
        name: `${name} ↔ Invite`,
      })
      .select("id")
      .single();

    if (chatError || !chat) {
      console.error("Failed to create chat:", chatError);
      throw chatError;
    }

    console.log("Created ephemeral chat:", chat.id);

    // 4) Insert two participants
    const participants = [
      { chat_id: chat.id, user_id: inviterProfile.id },
      { chat_id: chat.id, user_id: guestSessionId },
    ];

    const { error: participantsError } = await supabase
      .from("chat_participants")
      .insert(participants);

    if (participantsError) {
      console.error("Failed to add participants:", participantsError);
      throw participantsError;
    }

    console.log("Added participants to chat");

    // 5) Mint guest JWT
    const jwtSecret = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("GUEST_JWT_SECRET") || "";
    
    const payload = {
      aud: "authenticated",
      role: "authenticated",
      exp: getNumericDate(60 * 60 * 4), // 4 hours
      chat_id: chat.id,
      guest_session_id: guestSessionId,
    };

    const encoder = new TextEncoder();
    const keyData = encoder.encode(jwtSecret);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"]
    );
    const guestJwt = await create({ alg: "HS256", typ: "JWT" }, payload, cryptoKey);

    console.log("Minted guest JWT for session:", guestSessionId);

    // 6) Return response
    return new Response(
      JSON.stringify({
        chatId: chat.id,
        guestJwt,
        guest: {
          name,
          lang: preferredLanguage,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("start-guest-chat error:", e);
    const errorMessage = e instanceof Error ? e.message : "Internal error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
