import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    console.log("Processing guest chat close request");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { chatId } = await req.json();

    if (!chatId) {
      console.error("Missing chatId in request");
      return new Response(
        JSON.stringify({ error: "chatId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Scheduling chat ${chatId} for deletion in 5 minutes`);

    const deleteAfter = new Date(Date.now() + 5 * 60_000).toISOString(); // 5 minutes

    const { error } = await supabase
      .from("chats")
      .update({ delete_after: deleteAfter })
      .eq("id", chatId);

    if (error) {
      console.error("Failed to schedule chat deletion:", error);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Chat ${chatId} scheduled for deletion at ${deleteAfter}`);

    return new Response(
      JSON.stringify({ ok: true, deleteAfter }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error in guest-close:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
