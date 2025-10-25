import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  const { data: chats, error: listErr } = await supabase
    .from("chats")
    .select("id")
    .eq("is_ephemeral", true)
    .lt("delete_after", new Date().toISOString());

  if (listErr) {
    console.error("List expired chats error:", listErr);
    return new Response(JSON.stringify({ ok: false, error: listErr.message }), { status: 500 });
  }
  if (!chats?.length) return new Response(JSON.stringify({ ok: true, deleted: 0 }));

  const chatIds = chats.map(c => c.id);

  const del = async (table: string, col = "chat_id") => {
    const { error } = await supabase.from(table).delete().in(col, chatIds);
    if (error) console.error(`Delete ${table} error:`, error);
  };

  await del("message_translations", "message_id");
  await del("message_reactions");
  await del("message_read_receipts");
  await del("messages");
  await del("chat_participants");

  const { error: delChatsErr } = await supabase.from("chats").delete().in("id", chatIds);
  if (delChatsErr) {
    console.error("Delete chats error:", delChatsErr);
    return new Response(JSON.stringify({ ok: false, error: delChatsErr.message }), { status: 500 });
  }

  return new Response(JSON.stringify({ ok: true, deleted: chatIds.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
