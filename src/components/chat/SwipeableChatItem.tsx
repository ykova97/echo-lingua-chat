import { useState, useRef, TouchEvent, useEffect } from "react";
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

const SWIPE_THRESHOLD = 60;
const DELETE_BUTTON_WIDTH = 80;
const MAX_SWIPE = 100;

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
  const startY = useRef(0);
  const currentX = useRef(0);
  const lastTime = useRef(0);
  const velocity = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset swipe when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        if (translateX !== 0) {
          setTranslateX(0);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [translateX]);

  const handleTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    currentX.current = startX.current;
    lastTime.current = Date.now();
    velocity.current = 0;
    setIsSwiping(false);
  };

  const handleTouchMove = (e: TouchEvent) => {
    const touch = e.touches[0];
    const deltaX = touch.clientX - startX.current;
    const deltaY = touch.clientY - startY.current;
    
    // Determine if this is a horizontal swipe
    if (!isSwiping && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 5) {
      setIsSwiping(true);
    }
    
    if (!isSwiping) return;
    
    // Prevent vertical scrolling while swiping
    e.preventDefault();
    
    // Calculate velocity
    const now = Date.now();
    const timeDelta = now - lastTime.current;
    if (timeDelta > 0) {
      velocity.current = (touch.clientX - currentX.current) / timeDelta;
    }
    
    currentX.current = touch.clientX;
    lastTime.current = now;
    
    // Only allow left swipe (negative values) with resistance
    if (deltaX < 0) {
      const resistance = 1 - Math.abs(deltaX) / (MAX_SWIPE * 2);
      const adjustedDelta = deltaX * Math.max(resistance, 0.3);
      setTranslateX(Math.max(adjustedDelta, -MAX_SWIPE));
    } else if (translateX < 0) {
      // Allow closing by swiping right
      setTranslateX(Math.min(0, translateX + deltaX));
    }
  };

  const handleTouchEnd = () => {
    if (!isSwiping) return;
    
    setIsSwiping(false);
    
    // Use velocity to determine final state
    const shouldOpen = translateX < -SWIPE_THRESHOLD || velocity.current < -0.5;
    
    if (shouldOpen) {
      setTranslateX(-DELETE_BUTTON_WIDTH);
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

  const handleChatClick = () => {
    if (Math.abs(translateX) < 5) {
      onChatClick();
    }
  };

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-2xl touch-pan-y">
      {/* Delete Button Background */}
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-destructive rounded-2xl flex items-center justify-center">
        <button
          onClick={handleDelete}
          className="w-full h-full flex items-center justify-center touch-manipulation"
          aria-label="Delete chat"
        >
          <Trash2 className="w-5 h-5 text-destructive-foreground" />
        </button>
      </div>

      {/* Chat Item */}
      <div
        onClick={handleChatClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full bg-card hover:active:bg-secondary/50 rounded-2xl p-4 border border-border flex items-center gap-4 relative cursor-pointer touch-manipulation select-none"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
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
      </div>
    </div>
  );
};

