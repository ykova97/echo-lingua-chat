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

    // Check if we should reuse an existing ephemeral chat
    const reuseEnabled = Deno.env.get("REUSE_GUEST_CHAT") === "true";
    let existingChatId: string | null = null;

    if (reuseEnabled) {
      console.log("Chat reuse is enabled, checking for existing ephemeral chats");
      
      // Find an existing ephemeral chat created by this inviter that's still valid
      const { data: existingChats, error: existingError } = await supabase
        .from("chats")
        .select("id")
        .eq("created_by", inviterProfile.id)
        .eq("is_ephemeral", true)
        .gt("delete_after", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (!existingError && existingChats && existingChats.length > 0) {
        // Check each chat to find one with exactly 2 participants (inviter + 1 guest)
        for (const chat of existingChats) {
          const { data: participants, error: participantsError } = await supabase
            .from("chat_participants")
            .select("user_id")
            .eq("chat_id", chat.id);

          if (!participantsError && participants && participants.length === 2) {
            // Verify one is the inviter
            const hasInviter = participants.some(p => p.user_id === inviterProfile.id);
            const nonInviterCount = participants.filter(p => p.user_id !== inviterProfile.id).length;
            
            if (hasInviter && nonInviterCount === 1) {
              existingChatId = chat.id;
              console.log("Found reusable chat:", existingChatId);
              break;
            }
          }
        }
      }
    }

    // Rate limiting check (only if creating a new chat)
    if (!existingChatId) {
      const minuteBucket = new Date();
      minuteBucket.setSeconds(0, 0); // Truncate to minute
      const minuteBucketStr = minuteBucket.toISOString();

      // Check current rate limit
      const { data: rateLimit, error: rateLimitError } = await supabase
        .from("qr_rate_limits")
        .select("count")
        .eq("inviter_id", inviterProfile.id)
        .eq("minute_bucket", minuteBucketStr)
        .maybeSingle();

      if (rateLimit && rateLimit.count >= 5) {
        console.warn("Rate limit exceeded for inviter:", inviterProfile.id);
        return new Response(
          JSON.stringify({ 
            error: "Too many requests. Please wait a moment before creating another chat.",
            retryAfter: 60 
          }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update rate limit counter
      if (rateLimit) {
        await supabase
          .from("qr_rate_limits")
          .update({ count: rateLimit.count + 1 })
          .eq("inviter_id", inviterProfile.id)
          .eq("minute_bucket", minuteBucketStr);
      } else {
        await supabase
          .from("qr_rate_limits")
          .insert({
            inviter_id: inviterProfile.id,
            minute_bucket: minuteBucketStr,
            count: 1,
          });
      }
    }

    // Optional CAPTCHA check (placeholder for future implementation)
    const captchaEnabled = Deno.env.get("CAPTCHA_ENABLED") === "true";
    if (captchaEnabled) {
      console.log("CAPTCHA is enabled but not yet implemented");
      // TODO: Implement CAPTCHA verification here
      // For now, just log that it's enabled
    }

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

    // 3) Create or reuse ephemeral chat
    let chatId: string;
    
    if (existingChatId) {
      chatId = existingChatId;
      console.log("Reusing existing ephemeral chat:", chatId);
    } else {
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

      chatId = chat.id;
      console.log("Created ephemeral chat:", chatId);

      // Add inviter as participant only for new chats
      const { error: inviterError } = await supabase
        .from("chat_participants")
        .insert({ chat_id: chatId, user_id: inviterProfile.id });

      if (inviterError) {
        console.error("Failed to add inviter:", inviterError);
        throw inviterError;
      }
    }

    // 4) Add guest as participant
    const { error: guestParticipantError } = await supabase
      .from("chat_participants")
      .insert({ chat_id: chatId, user_id: guestSessionId });

    if (guestParticipantError) {
      console.error("Failed to add guest participant:", guestParticipantError);
      throw guestParticipantError;
    }

    console.log("Added guest participant to chat");

    // 5) Mint guest JWT
    const jwtSecret = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("GUEST_JWT_SECRET") || "";
    
    const payload = {
      aud: "authenticated",
      role: "authenticated",
      exp: getNumericDate(60 * 60 * 4), // 4 hours
      chat_id: chatId,
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
        chatId,
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
