// inside Chat.tsx
const PAGE_SIZE = 30;

async function loadMessagesPage(before?: string) {
  // 1) get latest page of messages
  let query = supabase
    .from("messages")
    .select("*")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (before) {
    query = query.lt("created_at", before);
  }

  const { data: msgs, error } = await query;
  if (error) throw error;
  if (!msgs || msgs.length === 0) return { messages: [], nextCursor: null };

  // 2) bulk fetch profiles
  const senderIds = Array.from(new Set(msgs.map((m) => m.sender_id)));
  const { data: profs } = await supabase.from("profiles").select("id, name, profile_image").in("id", senderIds);

  const profileMap = new Map((profs || []).map((p) => [p.id, p]));

  // 3) bulk fetch translations for current user
  const msgIds = msgs.map((m) => m.id);
  const { data: trans } = await supabase
    .from("message_translations")
    .select("message_id, translated_text, target_language")
    .eq("user_id", currentUser.id)
    .in("message_id", msgIds);

  const transMap = new Map((trans || []).map((t) => [t.message_id, t]));

  // 4) assemble and reverse to ascending for display
  const assembled = msgs
    .map((m) => ({
      id: m.id,
      sender_id: m.sender_id,
      sender_name: profileMap.get(m.sender_id)?.name,
      sender_image: profileMap.get(m.sender_id)?.profile_image,
      original_text: m.original_text,
      translated_text: transMap.get(m.id)?.translated_text,
      source_language: m.source_language,
      created_at: m.created_at,
      reply_to_id: m.reply_to_id,
    }))
    .reverse();

  const nextCursor = msgs[msgs.length - 1].created_at; // oldest in this page
  return { messages: assembled, nextCursor };
}

// Realtime: also listen to new translations for THIS user
useEffect(() => {
  if (!currentUser?.id) return;
  const ch = supabase
    .channel(`chat:${chatId}:translations:${currentUser.id}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "message_translations",
        filter: `user_id=eq.${currentUser.id}`,
      },
      (payload) => {
        const t = payload.new as any;
        // Update one message in-place with its translation
        setMessages((prev) =>
          prev.map((m) => (m.id === t.message_id ? { ...m, translated_text: t.translated_text } : m)),
        );
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(ch);
  };
}, [currentUser?.id, chatId]);
