import { useMemo, useRef, useState } from "react";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
} from "@chatscope/chat-ui-kit-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";
import IOSComposer from "./IOSComposer";

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
          </ChatContainer>
        </MainContainer>
      </div>

      {/* iOS-style composer at bottom */}
      <IOSComposer
        onSend={async (text) => {
          setSending(true);
          try { await onSend(text); }
          finally { setSending(false); }
        }}
        onAttach={onAttach}
      />
    </div>
  );
}
