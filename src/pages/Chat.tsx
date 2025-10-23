import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MessageBubble from "@/components/chat/MessageBubble";
import { ScrollArea } from "@/components/ui/scroll-area";

const PAGE_SIZE = 30;

interface Message {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_image?: string;
  original_text: string;
  translated_text?: string | null;
  source_language: string | null;
  created_at: string;
  reply_to_id?: string | null;
}

const Chat = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [showOriginalMap, setShowOriginalMap] = useState<Record<string, boolean>>({});

  // For scrolling behavior
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // --- Helpers ---
  const scrollToBottom = useCallback((smooth = true) => {
    const el = viewportRef.current;
    if (!el) return;
    const behavior: ScrollBehavior = smooth ? "smooth" : "auto";
    el.scrollTo({ top: el.scrollHeight, behavior });
  }, []);

  const userIsNearBottom = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return true;
    const threshold = 120; // px from bottom
    return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  }, []);

  // --- Auth & profile ---
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, name, preferred_language, profile_image")
          .eq("id", user.id)
          .maybeSingle();
        setCurrentProfile(profile || null);
      }
    })();
  }, []);

  // --- Pagination loader (bulk queries) ---
  async function loadMessagesPage(before?: string) {
    if (!chatId || !currentUser?.id) return { messages: [], nextCursor: null };

    let q = supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (before) q = q.lt("created_at", before);

    const { data: msgs, error } = await q;
    if (error) throw error;
    if (!msgs?.length) return { messages: [], nextCursor: null };

    // Bulk-load sender profiles
    const senderIds = Array.from(new Set(msgs.map((m: any) => m.sender_id)));
    const { data: profs } = await supabase.from("profiles").select("id, name, profile_image").in("id", senderIds);
    const profileMap = new Map((profs || []).map((p: any) => [p.id, p]));

    // Bulk-load this user’s translations
    const msgIds = msgs.map((m: any) => m.id);
    const { data: trans } = await supabase
      .from("message_translations")
      .select("message_id, translated_text")
      .eq("user_id", currentUser.id)
      .in("message_id", msgIds);
    const transMap = new Map((trans || []).map((t: any) => [t.message_id, t.translated_text]));

    // Assemble (ascending for display)
    const assembled: Message[] = msgs
      .map((m: any) => ({
        id: m.id,
        sender_id: m.sender_id,
        sender_name: profileMap.get(m.sender_id)?.name,
        sender_image: profileMap.get(m.sender_id)?.profile_image,
        original_text: m.original_text,
        translated_text: transMap.get(m.id) || null,
        source_language: m.source_language,
        created_at: m.created_at,
        reply_to_id: m.reply_to_id,
      }))
      .reverse();

    const nextCursor = msgs[msgs.length - 1].created_at; // oldest in this page
    return { messages: assembled, nextCursor };
  }

  // --- Initial load ---
  useEffect(() => {
    if (!currentUser?.id || !chatId) return;

    const loadInitial = async () => {
      try {
        setIsLoading(true);
        const { messages: initialMessages, nextCursor } = await loadMessagesPage();
        setMessages(initialMessages);
        setCursor(nextCursor);
        setHasMore(Boolean(nextCursor));
        // Scroll after first batch paints
        setTimeout(() => scrollToBottom(false), 0);
      } catch {
        toast({
          title: "Error loading messages",
          description: "Failed to load chat messages",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, chatId]);

  // --- Load older handler ---
  const handleLoadOlder = useCallback(async () => {
    if (!cursor || loadingMore) return;
    try {
      setLoadingMore(true);
      // Remember current scroll height to keep viewport from jumping
      const el = viewportRef.current;
      const prevHeight = el?.scrollHeight || 0;

      const { messages: older, nextCursor } = await loadMessagesPage(cursor);
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        setCursor(nextCursor);
        setHasMore(Boolean(nextCursor));
        // Maintain scroll position after prepending
        requestAnimationFrame(() => {
          if (!el) return;
          const newHeight = el.scrollHeight;
          el.scrollTop = newHeight - prevHeight + (el.scrollTop || 0);
        });
      } else {
        setHasMore(false);
      }
    } catch {
      toast({
        title: "Error",
        description: "Couldn’t load older messages.",
        variant: "destructive",
      });
    } finally {
      setLoadingMore(false);
    }
  }, [cursor, loadingMore, toast]);

  // --- Realtime: new message inserts for this chat ---
  useEffect(() => {
    if (!currentUser?.id || !chatId) return;

    const channel = supabase
      .channel(`chat:${chatId}:messages`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const m = payload.new as any;

          // Fetch sender profile once for the new message
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("id, name, profile_image")
            .eq("id", m.sender_id)
            .maybeSingle();

          // Fetch this user's translation if already created server-side
          const { data: myTrans } = await supabase
            .from("message_translations")
            .select("translated_text")
            .eq("user_id", currentUser.id)
            .eq("message_id", m.id)
            .maybeSingle();

          const composed: Message = {
            id: m.id,
            sender_id: m.sender_id,
            sender_name: senderProfile?.name,
            sender_image: senderProfile?.profile_image,
            original_text: m.original_text,
            translated_text: myTrans?.translated_text || null,
            source_language: m.source_language,
            created_at: m.created_at,
            reply_to_id: m.reply_to_id,
          };

          const shouldStick = userIsNearBottom() || m.sender_id === currentUser.id;
          setMessages((prev) => [...prev, composed]);
          if (shouldStick) scrollToBottom();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser?.id, chatId, scrollToBottom, userIsNearBottom]);

  // --- Realtime: translations for THIS user ---
  useEffect(() => {
    if (!currentUser?.id || !chatId) return;

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

  // --- Send via Edge Function (server does translations) ---
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser?.id || !chatId) return;

    try {
      const { error } = await supabase.functions.invoke("translate-message", {
        body: {
          chatId,
          message: newMessage,
          sourceLanguage: currentProfile?.preferred_language || "auto",
          replyToId: null,
          attachmentUrl: null,
          attachmentType: null,
        },
      });

      if (error) throw error;
      setNewMessage("");
      // Scroll to bottom so the just-sent message is visible as soon as it inserts
      setTimeout(() => scrollToBottom(), 0);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error sending message",
        description: "Failed to send your message",
        variant: "destructive",
      });
    }
  };

  const toggleOriginal = (messageId: string) => {
    setShowOriginalMap((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  // --- UI ---
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading chat...</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/chats")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Chat</h1>
      </header>

      {/* ScrollArea wrapper: attach ref to viewport for scroll control */}
      <ScrollArea className="flex-1">
        <div ref={viewportRef} className="h-full overflow-y-auto p-4">
          {/* Load older */}
          {hasMore && (
            <div className="flex justify-center mb-3">
              <Button variant="outline" size="sm" onClick={handleLoadOlder} disabled={loadingMore}>
                {loadingMore ? "Loading…" : "Load older"}
              </Button>
            </div>
          )}

          <div className="space-y-4" ref={listRef}>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={message.sender_id === currentUser?.id}
                showOriginal={showOriginalMap[message.id] || false}
                currentUserId={currentUser?.id || ""}
                onToggleOriginal={() => toggleOriginal(message.id)}
              />
            ))}
          </div>
        </div>
      </ScrollArea>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button onClick={handleSendMessage} size="icon" aria-label="Send">
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
