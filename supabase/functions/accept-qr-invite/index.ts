import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Use SUPABASE_JWT_SECRET for signing guest JWTs
    const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET") || "";
    
    console.log("Environment check:", {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
      hasJwtSecret: !!jwtSecret,
      jwtSecretLength: jwtSecret?.length || 0,
    });

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false }});

    const { token, name, preferredLanguage = "en", baseUrl } = await req.json();

    if (!token || !name) {
      return new Response(JSON.stringify({ error: "token and name are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!baseUrl) {
      return new Response(JSON.stringify({ error: "baseUrl is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: invite, error: invErr } = await supabase
      .from("guest_invites")
      .select("*")
      .eq("token", token)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (invErr || !invite) {
      return new Response(JSON.stringify({ error: "Invalid or expired invite" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (invite.used_count >= invite.max_uses) {
      return new Response(JSON.stringify({ error: "Invite already used" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: guest, error: gErr } = await supabase
      .from("guest_sessions")
      .insert({
        invite_id: invite.id,
        display_name: name,
        preferred_language: preferredLanguage,
      })
      .select("*").single();

    if (gErr) throw gErr;

    const deleteAfter = new Date(Date.now() + 6 * 3600_000).toISOString();
    const { data: chat, error: cErr } = await supabase
      .from("chats")
      .insert({
        type: "direct",
        is_ephemeral: true,
        name: `${guest.display_name} ↔ Invite`,
        delete_after: deleteAfter,
        created_by: invite.inviter_id,
      })
      .select("id").single();

    if (cErr) throw cErr;

    await supabase.from("chat_participants").insert([
      { chat_id: chat.id, user_id: invite.inviter_id },
      { chat_id: chat.id, user_id: guest.id },
    ]);

    await supabase
      .from("guest_invites")
      .update({ used_count: invite.used_count + 1 })
      .eq("id", invite.id);

    const payload = {
      aud: "authenticated",
      role: "authenticated",
      exp: getNumericDate(60 * 60 * 4),
      chat_id: chat.id,
      guest_session_id: guest.id,
    };

    console.log("Creating JWT with secret length:", jwtSecret?.length);
    
    // Use TextEncoder to convert string to Uint8Array
    const encoder = new TextEncoder();
    const keyData = encoder.encode(jwtSecret);
    
    let guestJwt: string;
    try {
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        keyData,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
      );
      guestJwt = await create({ alg: "HS256", typ: "JWT" }, payload, cryptoKey);
      
      console.log("Successfully created JWT");
    } catch (keyError: any) {
      console.error("Error creating crypto key:", keyError);
      throw new Error(`Failed to create JWT: ${keyError?.message || 'Unknown error'}`);
    }
    
    const guestChatUrl = `${baseUrl.replace(/\/$/, "")}/guest-chat/${chat.id}`;

    return new Response(JSON.stringify({
      chatId: chat.id,
      guestJwt,
      guest: { id: guest.id, name: guest.display_name, lang: guest.preferred_language },
      url: guestChatUrl,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("accept-qr-invite error:", e);
    const errorMessage = e instanceof Error ? e.message : "Internal error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
