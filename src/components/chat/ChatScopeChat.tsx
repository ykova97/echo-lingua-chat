import { useEffect, useMemo, useRef } from "react";
import {
  MainContainer,
  ChatContainer,
  MessageList,
  Message,
  MessageInput,
  ConversationHeader,
  Avatar,
  TypingIndicator
} from "@chatscope/chat-ui-kit-react";
import "@chatscope/chat-ui-kit-styles/dist/default/styles.min.css";
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
  avatarUrl?: string;            // Optional header avatar
  currentUserId: string;
  messages: ChatScopeMessage[];
  loading?: boolean;
  typing?: boolean;
  onSend: (text: string) => void;
};

export default function ChatScopeChat({
  title,
  avatarUrl,
  currentUserId,
  messages,
  loading,
  typing,
  onSend
}: Props) {
  useKeyboardInset();
  const listRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => {
    return messages.map(m => ({
      key: m.id,
      text: m.translated_text ?? m.original_text,
      sender: m.sender_name || "",
      direction: m.sender_id === currentUserId ? "outgoing" as const : "incoming" as const,
      createdAt: m.created_at
    }));
  }, [messages, currentUserId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const root = listRef.current?.querySelector(".cs-message-list__scroll-wrapper") as HTMLElement | null;
    root?.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
  }, [items.length]);

  return (
    <div className="chat-shell">
      {/* Sticky header (Chatscope ConversationHeader) */}
      <div className="sticky-header kb-safe border-b bg-background">
        <ConversationHeader>
          {avatarUrl ? <Avatar name={title} src={avatarUrl} /> : <Avatar name={title} />}
          <ConversationHeader.Content userName={title} info="" />
        </ConversationHeader>
      </div>

      {/* Chatscope container takes the rest of the height */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <MainContainer style={{ height: "100%", minHeight: 0 }}>
          <ChatContainer>
            <MessageList ref={listRef as any} typingIndicator={typing ? <TypingIndicator content="Typing…" /> : undefined}>
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
            {/* Sticky input at bottom; kb-safe lifts on iOS */}
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
