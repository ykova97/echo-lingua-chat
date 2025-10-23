import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Globe, Reply, Smile, MoreVertical } from "lucide-react";
import { ReactionPicker } from "./ReactionPicker";
import { MessageReactions } from "./MessageReactions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
    reply_to_id?: string;
    reply_to_text?: string;
    reply_to_sender?: string;
    edited_at?: string;
    is_deleted?: boolean;
    reactions?: Array<{ reaction: string; user_id: string; user_name?: string; count: number }>;
    read_by?: number;
    total_participants?: number;
  };
  isOwn: boolean;
  showOriginal: boolean;
  currentUserId: string;
  onToggleOriginal: () => void;
  onReply?: () => void;
  onReaction?: (reaction: string) => void;
  onEdit?: () => void;
  onDelete?: () => void;
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
  onReply,
  onReaction,
  onEdit,
  onDelete
}: MessageBubbleProps) => {
  const displayText = message.is_deleted 
    ? "Message deleted" 
    : (showOriginal ? message.original_text : (message.translated_text || message.original_text));
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
          {message.reply_to_id && (
            <div className="mb-2 pl-2 border-l-2 border-border/50">
              <p className="text-xs text-muted-foreground">{message.reply_to_sender}</p>
              <p className="text-xs opacity-70 line-clamp-1">{message.reply_to_text}</p>
            </div>
          )}
          
          <div
            className={`rounded-2xl px-4 py-2.5 ${
              isOwn
                ? "bg-[hsl(var(--message-sent))] text-[hsl(var(--message-sent-foreground))]"
                : "bg-[hsl(var(--message-received))] text-[hsl(var(--message-received-foreground))]"
            } ${message.is_deleted ? 'italic opacity-60' : ''}`}
          >
            <p className="text-sm leading-relaxed">{displayText}</p>
            {message.edited_at && !message.is_deleted && (
              <p className="text-xs opacity-50 mt-1">Edited</p>
            )}
          </div>

          {!message.is_deleted && (
            <div className={`absolute top-0 ${isOwn ? 'left-0 -translate-x-full' : 'right-0 translate-x-full'} flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity -ml-2 mr-2`}>
              <ReactionPicker onReactionSelect={(reaction) => onReaction?.(reaction)}>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full bg-background shadow-sm">
                  <Smile className="h-4 w-4" />
                </Button>
              </ReactionPicker>
              
              {onReply && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-7 w-7 p-0 rounded-full bg-background shadow-sm"
                  onClick={onReply}
                >
                  <Reply className="h-4 w-4" />
                </Button>
              )}

              {isOwn && (onEdit || onDelete) && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 rounded-full bg-background shadow-sm">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {onEdit && <DropdownMenuItem onClick={onEdit}>Edit</DropdownMenuItem>}
                    {onDelete && <DropdownMenuItem onClick={onDelete} className="text-destructive">Delete</DropdownMenuItem>}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          )}

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
          
          {isOwn && message.read_by !== undefined && message.total_participants && (
            <span className="text-xs text-muted-foreground">
              {message.read_by === message.total_participants - 1 ? '✓✓ Read' : '✓ Delivered'}
            </span>
          )}
          
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