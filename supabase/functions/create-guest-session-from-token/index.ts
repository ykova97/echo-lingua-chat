import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Simple in-memory rate limiting (per IP)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

function checkRateLimit(ip: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetAt) {
    // New window or expired window
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true };
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return {
      allowed: false,
      error: `Rate limit exceeded. Max ${MAX_REQUESTS_PER_WINDOW} requests per minute.`,
    };
  }

  record.count++;
  return { allowed: true };
}

// Cleanup old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(ip);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP for rate limiting
    const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0] || 
                     req.headers.get("x-real-ip") || 
                     "unknown";

    // Check rate limit
    const rateLimitCheck = checkRateLimit(clientIp);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: "rate_limit_exceeded", message: rateLimitCheck.error }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { token, display_name } = body;

    // Input validation
    if (!token || typeof token !== "string") {
      return new Response(
        JSON.stringify({ error: "invalid_input", message: "Token is required and must be a string" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate token length (UUIDs are 36 characters)
    if (token.length < 10 || token.length > 100) {
      return new Response(
        JSON.stringify({ error: "invalid_input", message: "Token format is invalid" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate display_name if provided
    if (display_name !== undefined && display_name !== null) {
      if (typeof display_name !== "string") {
        return new Response(
          JSON.stringify({ error: "invalid_input", message: "Display name must be a string" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (display_name.length > 100) {
        return new Response(
          JSON.stringify({ error: "invalid_input", message: "Display name must be less than 100 characters" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    console.log("Creating guest session from token:", token.substring(0, 8) + "...");

    // 1. Look up the share token (guest_invites table)
    const { data: invite, error: inviteError } = await supabase
      .from("guest_invites")
      .select("*")
      .eq("token", token)
      .single();

    if (inviteError || !invite) {
      console.error("Token not found:", inviteError);
      return new Response(
        JSON.stringify({ error: "invalid_or_expired", message: "Token not found or invalid" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Check if token is expired
    const now = new Date();
    const expiresAt = new Date(invite.expires_at);
    if (expiresAt < now) {
      console.error("Token expired:", invite.expires_at);
      return new Response(
        JSON.stringify({ error: "invalid_or_expired", message: "Token has expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Check if max uses exceeded
    if (invite.used_count >= invite.max_uses) {
      console.error("Token max uses exceeded:", invite.used_count, "/", invite.max_uses);
      return new Response(
        JSON.stringify({ error: "invalid_or_expired", message: "Token has reached maximum uses" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Increment used_count
    const { error: updateError } = await supabase
      .from("guest_invites")
      .update({ used_count: invite.used_count + 1 })
      .eq("id", invite.id);

    if (updateError) {
      console.error("Failed to update used_count:", updateError);
      throw updateError;
    }

    // 5. Create guest_session
    const guestExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const { data: guestSession, error: guestError } = await supabase
      .from("guest_sessions")
      .insert({
        invite_id: invite.id,
        display_name: display_name || "Guest",
        preferred_language: "en",
        expires_at: guestExpiresAt,
      })
      .select()
      .single();

    if (guestError || !guestSession) {
      console.error("Failed to create guest session:", guestError);
      throw guestError;
    }

    console.log("Created guest session:", guestSession.id);

    // 6. Create conversation (chat)
    const chatExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .insert({
        created_by: invite.inviter_id,
        guest_session_id: guestSession.id,
        is_ephemeral: true,
        delete_after: chatExpiresAt,
        type: "direct",
        active: true,
      })
      .select()
      .single();

    if (chatError || !chat) {
      console.error("Failed to create chat:", chatError);
      throw chatError;
    }

    console.log("Created chat:", chat.id);

    // 7. Add participants to the chat
    const { error: participantError } = await supabase
      .from("chat_participants")
      .insert([
        { chat_id: chat.id, user_id: invite.inviter_id },
        { chat_id: chat.id, user_id: guestSession.id },
      ]);

    if (participantError) {
      console.error("Failed to add participants:", participantError);
      // Don't throw - chat is created, this is non-critical
    }

    console.log("Guest session created successfully");

    // Generate JWT for guest with chat_id claim
    const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET") || Deno.env.get("GUEST_JWT_SECRET");
    if (!jwtSecret) {
      console.error("JWT secret not configured");
      throw new Error("JWT secret not configured");
    }

    // Import jose for JWT generation
    const { SignJWT } = await import("https://deno.land/x/jose@v5.1.0/index.ts");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const nowTimestamp = Math.floor(Date.now() / 1000);
    
    const guestJwt = await new SignJWT({
      aud: "authenticated",
      exp: nowTimestamp + (24 * 60 * 60), // 24 hours
      iat: nowTimestamp,
      iss: supabaseUrl,
      sub: guestSession.id,
      chat_id: chat.id,
      role: "anon",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .sign(new TextEncoder().encode(jwtSecret));

    console.log("Generated JWT for guest");

    return new Response(
      JSON.stringify({
        conversation_id: chat.id,
        guest_id: guestSession.id,
        guest_jwt: guestJwt,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("create-guest-session-from-token error:", e);
    const errorMessage = e instanceof Error ? e.message : "Internal error";
    return new Response(
      JSON.stringify({ error: "server_error", message: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
