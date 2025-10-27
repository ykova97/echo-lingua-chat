import { useEffect, useMemo, useRef, useState } from "react";
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
  const listRef = useRef<HTMLDivElement | null>(null);
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

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const root = listRef.current?.querySelector(".cs-message-list__scroll-wrapper") as HTMLElement | null;
    root?.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
  }, [items.length]);

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
            <MessageList ref={listRef as any}>
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

            {/* Composer with paperclip + iOS kb-safe */}
            <div className="kb-safe border-t bg-background">
              <div className="flex items-center gap-1 px-2 pt-1">
                <Button variant="ghost" size="icon" onClick={triggerFilePicker} aria-label="Attach">
                  <Paperclip className="h-5 w-5" />
                </Button>

                <div className="flex-1">
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
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </ChatContainer>
        </MainContainer>
      </div>
    </div>
  );
}
