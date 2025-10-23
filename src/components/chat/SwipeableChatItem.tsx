import { useState, useRef, TouchEvent } from "react";
import { Trash2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SwipeableChatItemProps {
  chatId: string;
  chatName: string;
  chatAvatar: string | undefined;
  lastMessage: string;
  lastMessageTime: string | undefined;
  onChatClick: () => void;
  onDelete: (chatId: string) => void;
}

export const SwipeableChatItem = ({
  chatId,
  chatName,
  chatAvatar,
  lastMessage,
  lastMessageTime,
  onChatClick,
  onDelete,
}: SwipeableChatItemProps) => {
  const [translateX, setTranslateX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef(0);
  const currentX = useRef(0);

  const handleTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setIsSwiping(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isSwiping) return;
    
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    
    // Only allow left swipe (negative values)
    if (diff < 0) {
      setTranslateX(Math.max(diff, -100)); // Limit to -100px
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    
    // If swiped more than 50px, keep it open at -80px, otherwise close it
    if (translateX < -50) {
      setTranslateX(-80);
    } else {
      setTranslateX(0);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(chatId);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete Button Background */}
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-destructive flex items-center justify-center">
        <button
          onClick={handleDelete}
          className="w-full h-full flex items-center justify-center"
        >
          <Trash2 className="w-5 h-5 text-destructive-foreground" />
        </button>
      </div>

      {/* Chat Item */}
      <button
        onClick={onChatClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full bg-card hover:bg-secondary/50 rounded-2xl p-4 border border-border transition-all duration-200 flex items-center gap-4 relative"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        <Avatar className="w-14 h-14">
          <AvatarImage src={chatAvatar} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {getInitials(chatName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 text-left min-w-0">
          <h3 className="font-semibold text-foreground truncate">{chatName}</h3>
          <p className="text-sm text-muted-foreground truncate">
            {lastMessage}
          </p>
        </div>
        {lastMessageTime && (
          <span className="text-xs text-muted-foreground shrink-0">
            {lastMessageTime}
          </span>
        )}
      </button>
    </div>
  );
};

