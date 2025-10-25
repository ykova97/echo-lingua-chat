import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "https://deno.land/x/jose@v5.2.0/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  console.log("=== accept-qr-invite function invoked ===", { method: req.method, url: req.url });
  
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS request");
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false }});

    const body = await req.json();
    console.log("Received request body:", body);
    
    const { token, name, preferredLanguage = "en", baseUrl } = body || {};
    console.log("Parsed values:", { token, name, preferredLanguage, baseUrl });

    // Validate token
    if (!token || typeof token !== "string" || token.length < 10) {
      return new Response(JSON.stringify({ error: "Invalid or missing token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate name
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Name is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!baseUrl) {
      return new Response(JSON.stringify({ error: "baseUrl is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Querying guest_invites with token:", token);
    const { data: invite, error: invErr } = await supabase
      .from("guest_invites")
      .select("*")
      .eq("token", token)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    console.log("Invite query result:", { invite, invErr });
    
    if (invErr || !invite) {
      console.error("Invite lookup failed:", invErr);
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

    // Create JWT using jose library
    console.log("Creating guest JWT for chat:", chat.id, "guest:", guest.id);
    
    const jwtSecretString = Deno.env.get("GUEST_JWT_SECRET");
    if (!jwtSecretString) {
      throw new Error("GUEST_JWT_SECRET not configured");
    }
    
    const jwtSecret = new TextEncoder().encode(jwtSecretString);
    console.log("JWT secret length:", jwtSecret.length);
    
    const guestJwt = await new SignJWT({
      chat_id: chat.id,
      guest_session_id: guest.id,
      role: "guest",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("4h")
      .sign(jwtSecret);
    
    console.log("JWT created successfully");

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
