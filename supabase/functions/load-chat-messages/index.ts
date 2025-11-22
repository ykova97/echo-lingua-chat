import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { chatId, guestJwt } = await req.json();

    if (!chatId) {
      return new Response(JSON.stringify({ error: "chatId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    console.log("Loading messages for chat:", chatId);

    // Get messages
    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (messagesError) throw messagesError;

    // Get sender profiles
    const senderIds = [...new Set(messages.map(m => m.sender_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, profile_image")
      .in("id", senderIds);

    const { data: guestSessions } = await supabase
      .from("guest_sessions")
      .select("id, display_name")
      .in("id", senderIds);

    // Create lookup maps
    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const guestMap = new Map(guestSessions?.map(g => [g.id, g]) || []);

    // Enrich messages with sender info
    const enrichedMessages = messages.map(msg => {
      const profile = profileMap.get(msg.sender_id);
      const guest = guestMap.get(msg.sender_id);
      
      return {
        ...msg,
        sender_name: profile?.name || guest?.display_name || "Unknown",
        sender_image: profile?.profile_image || null,
      };
    });

    console.log(`Loaded ${enrichedMessages.length} messages`);

    return new Response(
      JSON.stringify({ messages: enrichedMessages }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("load-chat-messages error:", e);
    const errorMessage = e instanceof Error ? e.message : "Internal error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
