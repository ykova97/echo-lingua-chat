import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function GuestChat() {
  const { chatId: routeChatId } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const guestJwt = sessionStorage.getItem("guestJwt") || "";
    const storedChatId = sessionStorage.getItem("guestChatId") || routeChatId || "";
    if (!guestJwt || !storedChatId) {
      navigate("/");
      return;
    }

    const c = createClient(
      import.meta.env.VITE_SUPABASE_URL!,
      import.meta.env.VITE_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${guestJwt}` } } }
    );

    setClient(c);
    setChatId(storedChatId);

    (async () => {
      const { data } = await c
        .from("messages")
        .select("*")
        .eq("chat_id", storedChatId)
        .order("created_at", { ascending: true });
      setMessages(data || []);

      const ch = c
        .channel(`guest:${storedChatId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${storedChatId}` },
          (payload) => setMessages((prev) => [...prev, payload.new])
        )
        .subscribe();

      return () => { c.removeChannel(ch); };
    })();
  }, [routeChatId, navigate]);

  const send = async () => {
    if (!text.trim() || !client || !chatId) return;
    const guestSessionId = sessionStorage.getItem("guestChatId");
    await client.from("messages").insert({ 
      chat_id: chatId, 
      sender_id: guestSessionId || chatId, // Use guest session ID as sender
      original_text: text, 
      source_language: "auto" 
    });
    setText("");
    setTimeout(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }), 0);
  };

  useEffect(() => {
    const onUnload = () => {
      if (!chatId) return;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      fetch(`${supabaseUrl}/functions/v1/guest-close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId, minutes: 5 }),
        keepalive: true,
      }).catch(() => {});
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [chatId]);

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="p-3 border-b">Temporary chat</header>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className="rounded-lg p-2 bg-secondary">
            {m.original_text}
          </div>
        ))}
      </div>
      <div className="p-3 border-t flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
          onKeyDown={(e) => (e.key === "Enter" && send())}
        />
        <Button onClick={send}>Send</Button>
      </div>
    </div>
  );
}
