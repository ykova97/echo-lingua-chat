import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { createGuestSession } from "@/lib/createGuestSession";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = "https://zakhdgsapuahjuqsbsfd.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpha2hkZ3NhcHVhaGp1cXNic2ZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNjI5NTMsImV4cCI6MjA3NjczODk1M30.7lmWAZSEjHsF6IE1eekVZi_8PPXczm9jN-pk6i2cBPE";

interface Message {
  id: string;
  content: string;
  sender_type: string;
  created_at: string;
}

export default function GuestChatDirect() {
  const { token } = useParams<{ token: string }>();
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
      setError("No token provided");
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        const result = await createGuestSession({ token });
        
        if ('error' in result) {
          setError(result.error === 'invalid_or_expired' 
            ? "This link has expired. Ask them to show a new QR." 
            : String(result.error));
          setLoading(false);
          return;
        }

        setConversationId(result.conversation_id);
        setGuestId(result.guest_id);
        setGuestJwt(result.guest_jwt);
        
        // Load messages (don't use guest JWT, use anon key with RLS policy)
        const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        const { data: msgs, error: msgsError } = await client
          .from("messages")
          .select("id, original_text, sender_type, created_at")
          .eq("chat_id", result.conversation_id)
          .order("created_at", { ascending: true });

        console.log("Initial messages:", msgs, "error:", msgsError);

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
      } catch (err: any) {
        setError(err?.message || "Failed to join chat");
        setLoading(false);
      }
    };

    init();
  }, [token]);

  // Poll for new messages instead of realtime (guest JWT doesn't work with Supabase realtime)
  useEffect(() => {
    if (!conversationId) return;

    const pollMessages = async () => {
      try {
        const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        
        // Get the latest message timestamp we have
        const latestTimestamp = messages.length > 0 
          ? messages[messages.length - 1].created_at 
          : new Date(0).toISOString();
        
        const { data: newMsgs, error: pollError } = await client
          .from("messages")
          .select("id, original_text, sender_type, created_at")
          .eq("chat_id", conversationId)
          .gt("created_at", latestTimestamp)
          .order("created_at", { ascending: true });

        console.log("Poll result:", { newMsgs, pollError, latestTimestamp });

        if (newMsgs && newMsgs.length > 0) {
          setMessages(prev => [
            ...prev,
            ...newMsgs.map((msg) => ({
              id: msg.id,
              content: msg.original_text,
              sender_type: msg.sender_type,
              created_at: msg.created_at,
            }))
          ]);
          scrollToBottom();
        }
      } catch (err) {
        console.error("Error polling messages:", err);
      }
    };

    // Poll every 2 seconds
    const interval = setInterval(pollMessages, 2000);
    
    return () => clearInterval(interval);
  }, [conversationId, messages]);

  const handleSend = async () => {
    if (!newMessageText.trim() || !guestJwt || !conversationId) return;
    
    setSending(true);
    try {
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      console.log("Sending message...");
      
      const { data, error } = await client.functions.invoke("send-guest-message", {
        body: {
          chatId: conversationId,
          message: newMessageText.trim(),
          jwt: guestJwt,
        },
      });

      console.log("Send response:", { data, error });

      if (error) {
        console.error("Failed to send message:", error);
        throw error;
      }

      // Add message to local state immediately
      setMessages(prev => [
        ...prev,
        {
          id: data.id || crypto.randomUUID(),
          content: newMessageText.trim(),
          sender_type: "guest",
          created_at: new Date().toISOString(),
        }
      ]);

      setNewMessageText("");
      scrollToBottom();
    } catch (err: any) {
      console.error("Send error:", err);
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
        <p className="text-muted-foreground">Connecting...</p>
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
    <div className="flex flex-col h-screen bg-background" style={{ height: '100dvh' }}>
      <header className="border-b border-border p-4 flex-shrink-0">
        <h1 className="text-xl font-semibold text-center text-foreground">
          You are now connected
        </h1>
      </header>

      <ScrollArea className="flex-1 p-4 overflow-y-auto" ref={scrollRef}>
        <div className="space-y-3 max-w-2xl mx-auto">
          {messages.length === 0 ? (
            <p className="text-center text-muted-foreground">No messages yet</p>
          ) : (
            messages.map((msg) => (
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
            ))
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4 bg-background flex-shrink-0 safe-bottom">
        <div className="flex gap-2 max-w-2xl mx-auto pb-safe">
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
