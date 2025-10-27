import { useMemo } from "react";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
} from "@chatscope/chat-ui-kit-react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";

export interface ChatScopeMessage {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_image?: string;
  original_text: string;
  translated_text?: string;
  created_at: string;
}

type Props = {
  title: string;                 // Header title (chat or user name)
  onBack?: () => void;           // Back handler
  currentUserId: string;
  messages: ChatScopeMessage[];
  loading?: boolean;
  typing?: boolean;
  onSend: (text: string) => void;
};

export default function ChatScopeChat({
  title,
  onBack,
  currentUserId,
  messages,
  typing,
  onSend
}: Props) {
  useKeyboardInset();

  const items = useMemo(() => {
    return messages.map(m => ({
      key: m.id,
      text: m.translated_text ?? m.original_text,
      sender: m.sender_name || "",
      direction: m.sender_id === currentUserId ? ("outgoing" as const) : ("incoming" as const),
      createdAt: m.created_at
    }));
  }, [messages, currentUserId]);

  return (
    <div className="chat-shell">
      {/* Our own sticky header to match previous design */}
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

      {/* Chatscope fills remaining height */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <MainContainer style={{ height: "100%", minHeight: 0 }}>
          <ChatContainer>
            <MessageList>
              {items.map(m => (
                <Message
                  key={m.key}
                  model={{
                    message: m.text,
                    sentTime: m.createdAt,
                    sender: m.sender,
                    direction: m.direction,
                    position: "single"
                  }}
                />
              ))}
            </MessageList>

            {/* Input at bottom; kb-safe lifts it when iOS keyboard shows */}
            <div className="kb-safe">
              <MessageInput
                attachButton={false}
                placeholder="Type a message…"
                onSend={(text) => onSend(text)}
              />
            </div>
          </ChatContainer>
        </MainContainer>
      </div>
    </div>
  );
}
