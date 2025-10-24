import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Send, AlertCircle } from "lucide-react";

interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  original_text: string;
  source_language: string;
  created_at: string;
}

export default function GuestChat() {
  const { chatId: urlChatId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<SupabaseClient | null>(null);
  const [chatId, setChatId] = useState<string>("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const guestSessionId = useRef<string>("");

  useEffect(() => {
    const initializeGuestChat = async () => {
      try {
        const guestJwt = sessionStorage.getItem("guestJwt");
        const storedChatId = sessionStorage.getItem("guestChatId");
        const guestName = sessionStorage.getItem("guestName");

        if (!guestJwt || !storedChatId) {
          console.error("Missing guest session data");
          setError("Invalid guest session. Please use a valid invite link.");
          setLoading(false);
          return;
        }

        // Verify URL matches stored chat
        if (urlChatId && urlChatId !== storedChatId) {
          console.error("Chat ID mismatch");
          setError("Invalid chat session");
          setLoading(false);
          return;
        }

        console.log(`Initializing guest chat for ${guestName} in chat ${storedChatId}`);

        // Create Supabase client with guest JWT
        const guestClient = createClient(
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

        setClient(guestClient);
        setChatId(storedChatId);

        // Fetch existing messages
        const { data: existingMessages, error: fetchError } = await guestClient
          .from("messages")
          .select("*")
          .eq("chat_id", storedChatId)
          .order("created_at", { ascending: true });

        if (fetchError) {
          console.error("Error fetching messages:", fetchError);
          toast.error("Failed to load messages");
        } else {
          setMessages(existingMessages || []);
          console.log(`Loaded ${existingMessages?.length || 0} existing messages`);
        }

        // Subscribe to new messages
        const channel = guestClient
          .channel(`guest-chat:${storedChatId}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "messages",
              filter: `chat_id=eq.${storedChatId}`
            },
            (payload) => {
              console.log("New message received:", payload.new);
              setMessages(prev => [...prev, payload.new as Message]);
              setTimeout(() => {
                scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
              }, 100);
            }
          )
          .subscribe((status) => {
            console.log("Subscription status:", status);
          });

        setLoading(false);

        // Cleanup function
        return () => {
          console.log("Cleaning up guest chat subscription");
          guestClient.removeChannel(channel);
        };
      } catch (err) {
        console.error("Error initializing guest chat:", err);
        setError("Failed to initialize chat");
        setLoading(false);
      }
    };

    initializeGuestChat();

    // Call guest-close when user leaves
    const handleUnload = async () => {
      const storedChatId = sessionStorage.getItem("guestChatId");
      if (storedChatId) {
        console.log("Guest leaving, scheduling chat deletion");
        try {
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/guest-close`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify({ chatId: storedChatId })
          });
        } catch (error) {
          console.error("Error calling guest-close:", error);
        }
      }
    };

    window.addEventListener("beforeunload", handleUnload);

    return () => {
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [urlChatId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || !client || !chatId || sending) return;

    setSending(true);

    try {
      console.log("Sending message:", text);

      const guestLang = sessionStorage.getItem("guestLang") || "en";
      
      const { error: insertError } = await client
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: guestSessionId.current || "guest",
          original_text: text.trim(),
          source_language: guestLang
        });

      if (insertError) {
        console.error("Error sending message:", insertError);
        toast.error("Failed to send message");
      } else {
        setText("");
        console.log("Message sent successfully");
      }
    } catch (err) {
      console.error("Unexpected error sending message:", err);
      toast.error("Failed to send message");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading chat...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center p-6">
        <Card className="w-full max-w-md p-6">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
            <h2 className="text-xl font-semibold">Unable to Load Chat</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={() => navigate("/")}>Go to Home</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex items-center justify-between p-4">
          <div>
            <h1 className="font-semibold">Temporary Chat</h1>
            <p className="text-xs text-muted-foreground">
              This chat will be automatically deleted
            </p>
          </div>
        </div>
      </header>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm">
              No messages yet. Start the conversation!
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className="rounded-lg p-3 bg-secondary max-w-[80%] break-words"
            >
              <p className="text-sm">{message.original_text}</p>
              <span className="text-xs text-muted-foreground mt-1 block">
                {new Date(message.created_at).toLocaleTimeString()}
              </span>
            </div>
          ))
        )}
      </div>

      <div className="sticky bottom-0 border-t bg-card p-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a message..."
            disabled={sending}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            size="icon"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
