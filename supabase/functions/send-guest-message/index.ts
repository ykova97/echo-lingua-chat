import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chatId, message, name, jwt } = await req.json();

    if (!chatId || !message || !jwt) {
      return new Response(
        JSON.stringify({ error: "chatId, message, and jwt required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the guest JWT
    const jwtSecretString = Deno.env.get("GUEST_JWT_SECRET");
    if (!jwtSecretString) {
      throw new Error("GUEST_JWT_SECRET not configured");
    }

    const jwtSecret = new TextEncoder().encode(jwtSecretString);
    let payload: any;
    
    try {
      const cryptoKey = await crypto.subtle.importKey(
        "raw",
        jwtSecret,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      payload = await verify(jwt, cryptoKey);
    } catch (verifyError) {
      console.error("JWT verification failed:", verifyError);
      return new Response(
        JSON.stringify({ error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure the JWT matches the chatId
    if (payload.chat_id !== chatId) {
      return new Response(
        JSON.stringify({ error: "Unauthorized access to this chat" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const guestSessionId = payload.guest_session_id;

    console.log("Sending message for guest:", guestSessionId, "in chat:", chatId);

    // Insert the message
    const { data: newMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        chat_id: chatId,
        sender_id: guestSessionId,
        sender_type: 'guest',
        original_text: message,
        source_language: "auto", // Could detect language here
      })
      .select()
      .single();

    if (insertError) {
      console.error("Message insert failed:", insertError);
      throw insertError;
    }

    console.log("Message sent successfully:", newMessage.id);

    return new Response(
      JSON.stringify({
        id: newMessage.id,
        created_at: newMessage.created_at,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("send-guest-message error:", e);
    const errorMessage = e instanceof Error ? e.message : "Internal error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
