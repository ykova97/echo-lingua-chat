import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "https://deno.land/x/jose@v5.2.0/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false }});

    const body = await req.json();
    console.log("Received request body:", body);
    
    const { token, name, preferredLanguage = "en", baseUrl } = body;
    console.log("Parsed values:", { token, name, preferredLanguage, baseUrl });

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

    console.log("Querying guest_invites with token:", token);
    const { data: invite, error: invErr } = await supabase
      .from("guest_invites")
      .select("*")
      .eq("token", token)
      .gt("expires_at", new Date().toISOString())
      .single();

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

    // Create JWT using jose library (compatible with Supabase JWT secrets)
    const jwtSecret = new TextEncoder().encode(
      Deno.env.get("SUPABASE_JWT_SECRET") || ""
    );
    
    const guestJwt = await new SignJWT({
      chat_id: chat.id,
      guest_session_id: guest.id,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setAudience("authenticated")
      .setExpirationTime("4h")
      .sign(jwtSecret);

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
