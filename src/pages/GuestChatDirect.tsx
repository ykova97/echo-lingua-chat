import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { createGuestSession } from "@/lib/createGuestSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

console.log("🟢🟢🟢 GuestChatDirect module loaded");

interface Message {
  id: string;
  content: string;
  sender_type: string;
  created_at: string;
}

export default function GuestChatDirect() {
  console.log("🔵🔵🔵 GuestChatDirect component rendering");
  const { token } = useParams<{ token: string }>();
  console.log("🟡🟡🟡 Token from params:", token);
  
  const [conversationId, setConversationId] = useState<string>("");
  const [guestId, setGuestId] = useState<string>("");
  const [guestJwt, setGuestJwt] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessageText, setNewMessageText] = useState("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, 100);
  };

  useEffect(() => {
    if (!token) {
      setError("No token provided in URL");
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        setLoading(true);
        console.log("Initializing guest session with token:", token);
        
        const result = await createGuestSession({ token: token });
        
        if ('error' in result) {
          const errorMsg = String(result.error);
          console.error("Guest session error:", errorMsg);
          setError(errorMsg === 'invalid_or_expired' 
            ? "This link has expired. Ask them to show a new QR." 
            : errorMsg);
          setLoading(false);
          return;
        }

        if ('conversation_id' in result && 'guest_id' in result && 'guest_jwt' in result) {
          console.log("Session created:", result.conversation_id);
          setConversationId(String(result.conversation_id));
          setGuestId(String(result.guest_id));
          setGuestJwt(String(result.guest_jwt));
          
          // Load initial messages
          const client = createClient(
            import.meta.env.VITE_SUPABASE_URL,
            import.meta.env.VITE_SUPABASE_ANON_KEY,
            {
              global: {
                headers: {
                  Authorization: `Bearer ${result.guest_jwt}`
                }
              }
            }
          );
          
          const { data: msgs } = await client
            .from("messages")
            .select("id, original_text, sender_type, created_at, sender_id")
            .eq("chat_id", result.conversation_id)
            .order("created_at", { ascending: true });

          if (msgs) {
            setMessages(msgs.map((msg) => ({
              id: msg.id,
              content: msg.original_text,
              sender_type: msg.sender_type,
              created_at: msg.created_at,
            })));
          }
          
          setLoading(false);
          scrollToBottom();
        } else {
          setError("Failed to initialize session");
          setLoading(false);
        }
      } catch (err: any) {
        console.error("Error initializing guest session:", err);
        setError(err?.message || "Failed to join chat");
        setLoading(false);
      }
    };

    init();
  }, [token]);

  // Real-time subscription
  useEffect(() => {
    if (!conversationId || !guestJwt) return;

    const client = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${guestJwt}`
          }
        }
      }
    );
    
    const channel = client
      .channel(`chat:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          setMessages((prev) => [
            ...prev,
            {
              id: newMsg.id,
              content: newMsg.original_text,
              sender_type: newMsg.sender_type,
              created_at: newMsg.created_at,
            },
          ]);
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [conversationId, guestJwt]);

  const handleSend = async () => {
    if (!newMessageText.trim() || !guestJwt || !conversationId) return;

    setSending(true);
    try {
      const client = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        {
          global: {
            headers: {
              Authorization: `Bearer ${guestJwt}`
            }
          }
        }
      );

      const { error } = await client.from("messages").insert({
        chat_id: conversationId,
        sender_type: "guest",
        sender_id: guestId,
        original_text: newMessageText.trim(),
        source_language: "en",
      });

      if (error) throw error;

      setNewMessageText("");
      scrollToBottom();
    } catch (err: any) {
      toast({
        title: "Failed to send message",
        description: err?.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <p className="text-muted-foreground">Connecting...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-md p-6">
          <p className="text-lg text-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b border-border p-4">
        <h1 className="text-xl font-semibold text-center text-foreground">
          You are now connected
        </h1>
      </header>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-3 max-w-2xl mx-auto">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.sender_type === "guest" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`px-4 py-2 rounded-lg max-w-[80%] ${
                  msg.sender_type === "guest"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
              <span className="text-xs text-muted-foreground mt-1">
                {msg.sender_type === "guest" ? "You" : "Them"}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4">
        <div className="flex gap-2 max-w-2xl mx-auto">
          <Input
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            placeholder="Type a message..."
            onKeyPress={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sending}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={sending || !newMessageText.trim()}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
