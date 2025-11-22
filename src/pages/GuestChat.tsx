import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MessageBubble from "@/components/chat/MessageBubble";
import { ScrollArea } from "@/components/ui/scroll-area";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BASE = `${SUPABASE_URL}/functions/v1`;
const ORIGIN = (import.meta as any)?.env?.VITE_PUBLIC_APP_URL || window.location.origin;

interface Message {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_image?: string;
  original_text: string;
  translated_text?: string;
  source_language: string;
  created_at: string;
}

export default function GuestChat() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Helper: guest info
  const guestJwt = sessionStorage.getItem("guestJwt") || "";
  const guestName = sessionStorage.getItem("guestName") || "Guest";
  const guestSessionId = sessionStorage.getItem("guestSessionId") || "";

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load initial messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`${BASE}/load-chat-messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ chatId, guestJwt }),
        });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        setMessages(data.messages || []);
      } catch (err) {
        console.error("Error loading messages:", err);
        toast({
          title: "Load error",
          description: "Unable to load messages.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    if (chatId && guestJwt) fetchMessages();
  }, [chatId, guestJwt, toast]);

  // Subscribe to new messages
  useEffect(() => {
    if (!chatId) return;

    const pollMessages = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/load-chat-messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId, guestJwt }),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data.messages || []);
        }
      } catch (err) {
        console.error("Error polling messages:", err);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollMessages);
  }, [chatId, guestJwt]);

  // Send message handler
  const handleSend = async () => {
    if (!newMessage.trim() || !chatId) return;
    setSending(true);
    try {
      const res = await fetch(`${BASE}/send-guest-message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatId,
          message: newMessage.trim(),
          name: guestName,
          jwt: guestJwt,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      // Optimistic append
      setMessages((prev) => [
        ...prev,
        {
          id: data.id || Date.now().toString(),
          sender_id: guestSessionId,
          sender_name: guestName,
          original_text: newMessage.trim(),
          source_language: "auto",
          created_at: new Date().toISOString(),
        },
      ]);
      setNewMessage("");
    } catch (err) {
      console.error("Send failed:", err);
      toast({
        title: "Message failed",
        description: "Could not send your message.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  // Notify backend on tab close (guest-close)
  useEffect(() => {
    const handleUnload = async () => {
      try {
        if (!chatId) return;
        await fetch(`${BASE}/guest-close`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chatId }),
        });
      } catch (error) {
        console.error("Error calling guest-close:", error);
      }
    };

    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [chatId]);

  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading chat…</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Sticky Header */}
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center gap-3 p-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold truncate">Chat with Host</h1>
      </header>

      {/* Scrollable Message Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        <div className="space-y-4 pb-24">
          {messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_id === guestSessionId}
              showOriginal={false}
              currentUserId={guestSessionId}
              onToggleOriginal={() => {}}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Sticky Input */}
      <div className="sticky bottom-0 border-t bg-background p-3">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message…"
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <Button size="icon" onClick={handleSend} disabled={sending}>
            <Send className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
