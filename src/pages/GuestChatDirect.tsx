import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { createGuestSession } from "@/lib/createGuestSession";

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
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

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
        
        // Load messages
        const client = createClient(
          SUPABASE_URL,
          SUPABASE_ANON_KEY,
          {
            global: {
              headers: { Authorization: `Bearer ${result.guest_jwt}` }
            }
          }
        );
        
        const { data: msgs } = await client
          .from("messages")
          .select("id, original_text, sender_type, created_at")
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
      } catch (err: any) {
        setError(err?.message || "Failed to join chat");
        setLoading(false);
      }
    };

    init();
  }, [token]);

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
    <div className="flex flex-col h-screen bg-background">
      <header className="border-b border-border p-4">
        <h1 className="text-xl font-semibold text-center text-foreground">
          Connected - Step 3: Messages loaded
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
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
      </div>
    </div>
  );
}
