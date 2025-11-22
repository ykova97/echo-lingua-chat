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
    // Get the authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false }
      }
    );

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized. Please log in." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Generating share link for user:", user.id);

    // Generate a secure random token (32 characters minimum)
    const token = crypto.randomUUID();
    
    // Calculate expiration time (24 hours from now)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // Use service role to insert into guest_invites table (which serves as share_tokens)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { data: shareToken, error: insertError } = await supabaseAdmin
      .from("guest_invites")
      .insert({
        inviter_id: user.id,
        token: token,
        expires_at: expiresAt,
        max_uses: 10,
        used_count: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to create share token:", insertError);
      throw insertError;
    }

    // Build the share URL with hardcoded production domain
    const shareUrl = `https://lynk-chat.com/guest/${token}`;

    console.log("Share link generated successfully:", shareUrl);

    return new Response(
      JSON.stringify({ 
        share_url: shareUrl,
        token: token,
        expires_at: expiresAt,
        max_uses: 10
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("generate-share-link error:", e);
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
