import { useMemo, useRef, useState } from "react";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput
} from "@chatscope/chat-ui-kit-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Paperclip } from "lucide-react";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";

export interface ChatScopeMessage {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_image?: string;
  original_text: string;     // may be a plain message OR an image URL we send
  translated_text?: string;
  created_at: string;
  media_url?: string;        // optional explicit media url (if you add it later)
}

type Props = {
  title: string;
  onBack?: () => void;
  currentUserId: string;
  messages: ChatScopeMessage[];
  loading?: boolean;
  typing?: boolean;
  onSend: (text: string) => void;
  onAttach: (file: File) => void;    // <-- NEW: parent handles upload
};

const isImageUrl = (s: string | undefined) =>
  !!s && /(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp|avif))$/i.test(s);

export default function ChatScopeChat({
  title,
  onBack,
  currentUserId,
  messages,
  typing,
  onSend,
  onAttach
}: Props) {
  useKeyboardInset();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sending, setSending] = useState(false);

  const items = useMemo(() => {
    return messages.map(m => {
      const text = m.translated_text ?? m.original_text;
      const media = m.media_url || (isImageUrl(text) ? text : undefined);
      return {
        key: m.id,
        text,
        media,
        sender: m.sender_name || "",
        direction: m.sender_id === currentUserId ? ("outgoing" as const) : ("incoming" as const),
        createdAt: m.created_at
      };
    });
  }, [messages, currentUserId]);

  const triggerFilePicker = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    onAttach(f);
    // reset so selecting same file twice still triggers change
    e.target.value = "";
  };

  return (
    <div className="chat-shell">
      {/* Sticky header to match your design */}
      <header className="sticky-header border-b bg-background/80 supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 py-3 flex items-center gap-3">
          {onBack ? (
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          ) : null}
          <h1 className="text-lg font-semibold truncate">{title}</h1>
        </div>
      </header>

      {/* Chatscope area */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <MainContainer style={{ height: "100%", minHeight: 0 }}>
          <ChatContainer>
            <MessageList>
              {items.map(m => (
                <Message
                  key={m.key}
                  model={{
                    message: isImageUrl(m.media ?? "") ? "" : m.text,
                    sentTime: m.createdAt,
                    sender: m.sender,
                    direction: m.direction,
                    position: "single"
                  }}
                >
                  {/* Render image inline if the message is an image URL */}
                  {isImageUrl(m.media ?? "") && (
                    <Message.CustomContent>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.media!}
                        alt="attachment"
                        style={{
                          maxWidth: 260,
                          maxHeight: 280,
                          borderRadius: 14,
                          display: "block"
                        }}
                        loading="lazy"
                      />
                    </Message.CustomContent>
                  )}
                </Message>
              ))}
            </MessageList>

            {/* MessageInput must be direct child of ChatContainer */}
            <MessageInput
              attachButton={false}
              placeholder="Type a message…"
              onSend={async (text) => {
                if (!text.trim()) return;
                setSending(true);
                try { await onSend(text.trim()); }
                finally { setSending(false); }
              }}
              disabled={sending}
            />
          </ChatContainer>
        </MainContainer>
      </div>

      {/* Attach button - iOS style positioned on left */}
      <div className="absolute bottom-16 left-3 kb-safe pointer-events-none z-10">
        <div className="pointer-events-auto">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={triggerFilePicker} 
            aria-label="Attach"
            className="h-9 w-9 rounded-full bg-white hover:bg-gray-50 shadow-none border border-gray-300"
          >
            <Paperclip className="h-4 w-4 text-gray-500" />
          </Button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>
    </div>
  );
}
