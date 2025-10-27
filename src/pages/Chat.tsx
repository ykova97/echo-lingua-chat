import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BASE = `${SUPABASE_URL}/functions/v1`;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MessageBubble from "@/components/chat/MessageBubble";


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
      const {
        data: { user },
      } = await supabase.auth.getUser();
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
    const { data: profs } = await supabase.from("profiles").select("id, name, profile_image").in("id", senderIds);

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
        
        // Mark all unread messages as read
        if (initialMessages.length > 0) {
          const unreadMessageIds = initialMessages
            .filter(m => m.sender_id !== currentUser.id)
            .map(m => m.id);
          
          if (unreadMessageIds.length > 0) {
            // Check which messages don't have read receipts yet
            const { data: existing } = await supabase
              .from("message_read_receipts")
              .select("message_id")
              .eq("user_id", currentUser.id)
              .in("message_id", unreadMessageIds);
            
            const existingIds = new Set((existing || []).map(r => r.message_id));
            const toInsert = unreadMessageIds.filter(id => !existingIds.has(id));
            
            if (toInsert.length > 0) {
              console.log('Marking messages as read:', toInsert);
              const { error } = await supabase
                .from("message_read_receipts")
                .insert(
                  toInsert.map(id => ({
                    message_id: id,
                    user_id: currentUser.id
                  }))
                );
              
              if (error) {
                console.error('Error marking messages as read:', error);
              } else {
                console.log('Successfully marked messages as read');
              }
            }
          }
        }
        
        // Auto-scroll to bottom after messages load
        setTimeout(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: "smooth",
            });
          }
        }, 100);
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
      .channel(`chat:${chatId}:updates:${currentUser.id}`)
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
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          
          // Get sender profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("name, profile_image")
            .eq("id", newMsg.sender_id)
            .single();
          
          // Add message to list immediately
          setMessages((prev) => [
            ...prev,
            {
              id: newMsg.id,
              sender_id: newMsg.sender_id,
              sender_name: profile?.name,
              sender_image: profile?.profile_image,
              original_text: newMsg.original_text,
              source_language: newMsg.source_language,
              created_at: newMsg.created_at,
              reply_to_id: newMsg.reply_to_id,
            },
          ]);
          
          // Mark as read if from someone else
          if (newMsg.sender_id !== currentUser.id) {
            // Check if already read
            const { data: existing } = await supabase
              .from("message_read_receipts")
              .select("id")
              .eq("message_id", newMsg.id)
              .eq("user_id", currentUser.id)
              .maybeSingle();
            
            if (!existing) {
              await supabase
                .from("message_read_receipts")
                .insert({
                  message_id: newMsg.id,
                  user_id: currentUser.id
                });
            }
          }
          
          // Auto-scroll to bottom
          setTimeout(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: "smooth",
              });
            }
          }, 100);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [currentUser?.id, chatId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !currentUser?.id || !chatId) return;

    const messageText = newMessage;
    setNewMessage("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Authentication required",
          description: "Please sign in to send messages",
          variant: "destructive",
        });
        return;
      }

      const res = await fetch(`${BASE}/translate-message`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          chatId: chatId,
          message: messageText,
          sourceLanguage: currentUser.preferred_language || "en",
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText);
      }
      
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      }, 0);
    } catch (error) {
      toast({
        title: "Error sending message",
        description: "Failed to send your message",
        variant: "destructive",
      });
      setNewMessage(messageText);
    }
  };

  const toggleOriginal = (messageId: string) => {
    setShowOriginalMap((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading chat...</div>;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Fixed header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card">
        <div className="px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/chats")} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Chat</h1>
        </div>
      </header>

      {/* Scrollable messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-6 space-y-4"
        style={{ overscrollBehavior: 'contain' }}
      >
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

      {/* Fixed input bar */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-card">
        <div className="p-4">
          <div className="flex gap-3">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type a message…"
              className="h-11 rounded-full"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
            />
            <Button onClick={handleSendMessage} size="icon" className="h-11 w-11 rounded-full" aria-label="Send">
              <Send className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Chat;
