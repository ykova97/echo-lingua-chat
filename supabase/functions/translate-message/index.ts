// supabase/functions/translate-message/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_AI_API_KEY")!; // set in Env

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const body = await req.json();
    const { chatId, message, sourceLanguage, replyToId, attachmentUrl, attachmentType } = body;

    if (!chatId || !message) {
      return new Response(JSON.stringify({ error: "chatId and message are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1) Insert base message (no translations yet)
    const { data: inserted, error: msgErr } = await supabaseAdmin
      .from("messages")
      .insert({
        chat_id: chatId,
        original_text: message,
        source_language: sourceLanguage || null,
        reply_to_id: replyToId || null,
        attachment_url: attachmentUrl || null,
        attachment_type: attachmentType || null,
        // sender_id comes from RLS; if you require system insert, pass from client auth
      })
      .select("*")
      .single();

    if (msgErr) throw msgErr;
    const newMessage = inserted;

    // 2) Get participants
    const { data: participants, error: partErr } = await supabaseAdmin
      .from("chat_participants")
      .select("user_id")
      .eq("chat_id", chatId);

    if (partErr) throw partErr;

    // 3) Profiles → preferred_language map
    const userIds = participants.map((p) => p.user_id);
    const { data: profiles, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, preferred_language")
      .in("id", userIds);

    if (profErr) throw profErr;

    const langMap = new Map<string, string>((profiles || []).map((p) => [p.id, p.preferred_language || "en"]));

    // 4) Determine source language (detect lazily if not provided & not empty)
    const srcLang = sourceLanguage && sourceLanguage.trim() !== "" ? sourceLanguage : "auto";

    // 5) Group recipients by target language
    const byLang = new Map<string, string[]>(); // lang -> [userIds]
    for (const p of participants) {
      const lang = langMap.get(p.user_id) || "en";
      if (!byLang.has(lang)) byLang.set(lang, []);
      byLang.get(lang)!.push(p.user_id);
    }

    // 6) Translate once per target language (with cache)
    const results: { message_id: string; user_id: string; translated_text: string; target_language: string }[] = [];

    async function translateOnceWithCache(text: string, src: string, dst: string) {
      if (src === dst || dst === "auto") return text;

      const key = await sha256(`${src}|${dst}|${text}`);
      // DB cache
      const { data: cached } = await supabaseAdmin
        .from("translation_cache")
        .select("translated_text")
        .eq("hash", key)
        .maybeSingle();

      if (cached?.translated_text) {
        // touch last_used
        await supabaseAdmin.from("translation_cache").update({ last_used: new Date().toISOString() }).eq("hash", key);
        return cached.translated_text as string;
      }

      // Call Lovable AI Gateway (keep the same model you had)
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `You are a professional translator. Translate into ${dst}. Preserve meaning, names, emojis, punctuation, and tone. Output only the translated text.`,
            },
            { role: "user", content: text },
          ],
          temperature: 0.2,
        }),
      });

      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(`AI translate failed: ${resp.status} ${t}`);
      }
      const data = await resp.json();
      const translatedText: string = data?.choices?.[0]?.message?.content?.trim() ?? "";

      // Save to cache
      await supabaseAdmin.from("translation_cache").insert({
        hash: key,
        source_lang: src,
        target_lang: dst,
        text,
        translated_text: translatedText,
      });

      return translatedText;
    }

    for (const [dstLang, userList] of byLang) {
      const translated =
        srcLang === dstLang || srcLang === "auto" ? message : await translateOnceWithCache(message, srcLang, dstLang);

      results.push(
        ...userList.map((uid) => ({
          message_id: newMessage.id,
          user_id: uid,
          translated_text: translated,
          target_language: dstLang,
        })),
      );
    }

    // 7) Bulk insert translations
    if (results.length > 0) {
      const { error: insErr } = await supabaseAdmin.from("message_translations").insert(results);
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({ success: true, messageId: newMessage.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("translate-message error:", error?.message);
    return new Response(JSON.stringify({ error: error?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
