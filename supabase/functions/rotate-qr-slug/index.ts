import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Generate random URL-safe base62-style slug
function generateQrSlug(): string {
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: authHeader } }
      }
    );

    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("rotate-qr-slug invoked for user:", user.id);

    // Generate new unique slug
    let newSlug = generateQrSlug();
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("qr_slug", newSlug)
        .maybeSingle();

      if (!existing) {
        isUnique = true;
      } else {
        newSlug = generateQrSlug();
        attempts++;
      }
    }

    if (!isUnique) {
      throw new Error("Failed to generate unique slug after multiple attempts");
    }

    console.log("Generated new slug:", newSlug);

    // Update user's profile with new slug and timestamp
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        qr_slug: newSlug,
        qr_rotated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (updateError) {
      console.error("Failed to update profile:", updateError);
      throw updateError;
    }

    console.log("Successfully rotated QR slug for user:", user.id);

    const baseUrl = Deno.env.get("PUBLIC_APP_URL") || Deno.env.get("SUPABASE_URL")!;
    const joinUrl = `${baseUrl.replace(/\/$/, "")}/join/${newSlug}`;

    return new Response(
      JSON.stringify({
        qrSlug: newSlug,
        joinUrl,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (e) {
    console.error("rotate-qr-slug error:", e);
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
