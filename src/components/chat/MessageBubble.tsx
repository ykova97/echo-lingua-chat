import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Globe, Smile } from "lucide-react";
import { ReactionPicker } from "./ReactionPicker";
import { MessageReactions } from "./MessageReactions";

interface MessageBubbleProps {
  message: {
    id: string;
    sender_name?: string;
    sender_image?: string;
    original_text: string;
    translated_text?: string;
    source_language: string;
    target_language?: string;
    created_at: string;
    reactions?: Array<{ reaction: string; user_id: string; user_name?: string; count: number }>;
  };
  isOwn: boolean;
  showOriginal: boolean;
  currentUserId: string;
  onToggleOriginal: () => void;
  onReaction?: (reaction: string) => void;
}

const LANGUAGE_FLAGS: Record<string, string> = {
  en: "🇺🇸",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  uk: "🇺🇦",
  zh: "🇨🇳",
  ja: "🇯🇵",
  ko: "🇰🇷",
  ar: "🇸🇦",
  pt: "🇧🇷",
};

const MessageBubble = ({ 
  message, 
  isOwn, 
  showOriginal, 
  currentUserId,
  onToggleOriginal,
  onReaction
}: MessageBubbleProps) => {
  const displayText = showOriginal ? message.original_text : (message.translated_text || message.original_text);
  const hasTranslation = !isOwn && message.translated_text && message.translated_text !== message.original_text;

  return (
    <div className={`flex gap-2 ${isOwn ? "flex-row-reverse" : "flex-row"} group`}>
      {!isOwn && (
        <Avatar className="w-8 h-8">
          <AvatarImage src={message.sender_image} />
          <AvatarFallback className="bg-primary/10 text-primary text-xs">
            {message.sender_name?.[0] || "U"}
          </AvatarFallback>
        </Avatar>
      )}
      
      <div className={`flex flex-col ${isOwn ? "items-end" : "items-start"} max-w-[70%]`}>
        {!isOwn && (
          <span className="text-xs text-muted-foreground mb-1 px-2">
            {message.sender_name}
          </span>
        )}
        
        <div className="relative">
          <div
            className={`rounded-2xl px-4 py-2.5 ${
              isOwn
                ? "bg-[hsl(var(--message-sent))] text-[hsl(var(--message-sent-foreground))]"
                : "bg-[hsl(var(--message-received))] text-[hsl(var(--message-received-foreground))]"
            }`}
          >
            <p className="text-sm leading-relaxed">{displayText}</p>
          </div>

          {/* Reaction button - shows on hover */}
          <div className={`absolute top-0 ${isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} opacity-0 group-hover:opacity-100 transition-opacity -ml-2 mr-2`}>
            <ReactionPicker onReactionSelect={(reaction) => onReaction?.(reaction)}>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full bg-background shadow-sm">
                <Smile className="h-4 w-4" />
              </Button>
            </ReactionPicker>
          </div>

          {/* Show reactions */}
          {message.reactions && message.reactions.length > 0 && (
            <MessageReactions 
              reactions={message.reactions}
              currentUserId={currentUserId}
              onReactionClick={(reaction) => onReaction?.(reaction)}
            />
          )}
        </div>

        <div className="flex items-center gap-2 mt-1 px-2">
          <span className="text-xs text-muted-foreground">
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          
          {hasTranslation && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleOriginal}
              className="h-6 px-2 text-xs gap-1"
            >
              <span>{LANGUAGE_FLAGS[showOriginal ? message.target_language! : message.source_language]}</span>
              <Globe className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;