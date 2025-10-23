import { useEffect, useState, useRef } from "react";
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
  translated_text?: string;
  source_language: string;
  created_at: string;
  reply_to_id?: string;
}

const Chat = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showOriginalMap, setShowOriginalMap] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  async function loadMessagesPage(before?: string) {
    if (!chatId) return { messages: [], nextCursor: null };
    
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

    const senderIds = Array.from(new Set(msgs.map((m) => m.sender_id)));
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, name, profile_image")
      .in("id", senderIds);

    const profileMap = new Map((profs || []).map((p) => [p.id, p]));

    const msgIds = msgs.map((m) => m.id);
    const { data: trans } = await supabase
      .from("message_translations")
      .select("message_id, translated_text, target_language")
      .eq("user_id", currentUser.id)
      .in("message_id", msgIds);

    const transMap = new Map((trans || []).map((t) => [t.message_id, t]));

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

    const nextCursor = msgs[msgs.length - 1].created_at;
    return { messages: assembled, nextCursor };
  }

  useEffect(() => {
    if (!currentUser?.id || !chatId) return;

    const loadInitialMessages = async () => {
      try {
        const { messages: initialMessages } = await loadMessagesPage();
        setMessages(initialMessages);
      } catch (error) {
        toast({
          title: "Error loading messages",
          description: "Failed to load chat messages",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadInitialMessages();
  }, [currentUser?.id, chatId]);

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
            prev.map((m) =>
              m.id === t.message_id ? { ...m, translated_text: t.translated_text } : m
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [currentUser?.id, chatId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser?.id || !chatId) return;

    try {
      const { error } = await supabase.from("messages").insert({
        chat_id: chatId,
        sender_id: currentUser.id,
        original_text: newMessage,
        source_language: "en",
      });

      if (error) throw error;
      setNewMessage("");
    } catch (error) {
      toast({
        title: "Error sending message",
        description: "Failed to send your message",
        variant: "destructive",
      });
    }
  };

  const toggleOriginal = (messageId: string) => {
    setShowOriginalMap((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        Loading chat...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      <header className="border-b p-4 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/chats")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-semibold">Chat</h1>
      </header>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4" ref={scrollRef}>
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
      </ScrollArea>

      <div className="border-t p-4">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          />
          <Button onClick={handleSendMessage} size="icon">
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
