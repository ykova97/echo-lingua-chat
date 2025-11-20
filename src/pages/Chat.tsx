import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import ChatScopeChat, { ChatScopeMessage } from "@/components/chat/ChatScopeChat";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const PAGE_SIZE = 30;

export default function Chat() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ChatScopeMessage[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chatTitle, setChatTitle] = useState("Chat");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    })();
  }, []);

  // Load initial messages + chat meta
  useEffect(() => {
    if (!chatId || !currentUser?.id) return;

    (async () => {
      try {
        // Load chat meta (optional: name/avatar)
        const { data: chat } = await supabase
          .from("chats")
          .select("*")
          .eq("id", chatId)
          .single();
        if (chat?.name) setChatTitle(chat.name);

        await loadMessages();
      } catch (err) {
        toast({ title: "Error", description: "Failed to load chat.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, currentUser?.id]);

  async function loadMessages(before?: string) {
    if (!chatId) return;

    let query = supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (before) query = query.lt("created_at", before);

    const { data: msgs, error } = await query;
    if (error) throw error;
    if (!msgs?.length) {
      setMessages([]);
      return;
    }

    const senderIds = Array.from(new Set(msgs.map((m: any) => m.sender_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, name, profile_image")
      .in("id", senderIds);

    const profileMap = new Map((profs || []).map((p: any) => [p.id, p]));

    const msgIds = msgs.map((m: any) => m.id);
    const { data: trans } = await supabase
      .from("message_translations")
      .select("message_id, translated_text, target_language")
      .eq("user_id", currentUser!.id)
      .in("message_id", msgIds);

    const transMap = new Map((trans || []).map((t: any) => [t.message_id, t.translated_text]));

    const assembled: ChatScopeMessage[] = msgs
      .map((m: any) => ({
        id: m.id,
        sender_id: m.sender_id,
        sender_name: profileMap.get(m.sender_id)?.name,
        sender_image: profileMap.get(m.sender_id)?.profile_image,
        original_text: m.original_text,
        translated_text: transMap.get(m.id),
        created_at: m.created_at,
        media_url: m.attachment_url
      }))
      .reverse();

    setMessages(assembled);
    
    // Mark messages from other users as read
    if (currentUser?.id) {
      const otherUsersMessages = msgs.filter((m: any) => m.sender_id !== currentUser.id);
      if (otherUsersMessages.length > 0) {
        // Get existing read receipts to avoid duplicates
        const { data: existingReceipts } = await supabase
          .from("message_read_receipts")
          .select("message_id")
          .eq("user_id", currentUser.id)
          .in("message_id", otherUsersMessages.map((m: any) => m.id));
        
        const existingReceiptIds = new Set((existingReceipts || []).map((r: any) => r.message_id));
        
        // Create read receipts for messages without them
        const receiptsToCreate = otherUsersMessages
          .filter((m: any) => !existingReceiptIds.has(m.id))
          .map((m: any) => ({
            message_id: m.id,
            user_id: currentUser.id,
            read_at: new Date().toISOString()
          }));
        
        if (receiptsToCreate.length > 0) {
          await supabase
            .from("message_read_receipts")
            .insert(receiptsToCreate);
        }
      }
    }
  }

  // Live translation updates (optional)
  useEffect(() => {
    if (!currentUser?.id || !chatId) return;
    const ch = supabase
      .channel(`chat:${chatId}:translations:${currentUser.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "message_translations", filter: `user_id=eq.${currentUser.id}` },
        (payload) => {
          const t = payload.new as any;
          setMessages(prev => prev.map(m => m.id === t.message_id ? { ...m, translated_text: t.translated_text } : m));
        })
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [currentUser?.id, chatId]);

  const handleSend = async (text: string) => {
    if (!text.trim() || !currentUser?.id || !chatId) return;
    try {
      // Call the translate-message edge function which handles both insertion and translation
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate-message`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId: chatId,
          message: text.trim(),
          sourceLanguage: "en"
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send message");
      }

      // Reload messages to show the new one with translations
      await loadMessages();
    } catch (error) {
      console.error("Send error:", error);
      toast({ title: "Send failed", description: "Could not send your message.", variant: "destructive" });
    }
  };

  const handleAttach = async (file: File) => {
    try {
      if (!currentUser?.id || !chatId) return;

      // 1) Upload to Supabase Storage
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${chatId}/${currentUser.id}/${uuidv4()}.${ext}`;

      const { error: upErr } = await supabase.storage.from("chat-uploads").upload(path, file, {
        upsert: false,
        cacheControl: "3600",
        contentType: file.type || "image/jpeg",
      });
      if (upErr) throw upErr;

      // 2) Get public URL
      const { data: pub } = supabase.storage.from("chat-uploads").getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      // 3) Create a message that carries the image URL in original_text (no schema change required)
      const { error: msgErr } = await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: currentUser.id,
        original_text: publicUrl,    // our wrapper will render this as an image bubble
        source_language: "en"
      });
      if (msgErr) throw msgErr;

      // 4) Optionally reload messages or optimistically append
      await loadMessages();
    } catch (e) {
      toast({
        title: "Attachment failed",
        description: "Could not upload or send the picture.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="chat-shell">
        <div className="sticky-header border-b bg-background px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/chats")}><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-lg font-semibold truncate">{chatTitle}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center">Loading…</div>
      </div>
    );
  }

  return (
    <ChatScopeChat
      title={chatTitle}
      onBack={() => navigate("/chats")}
      currentUserId={currentUser?.id || ""}
      messages={messages}
      onSend={handleSend}
      onAttach={handleAttach}
    />
  );
}
