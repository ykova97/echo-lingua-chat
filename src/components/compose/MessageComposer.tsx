import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";

interface MessageComposerProps {
  onSend: (message: string) => void;
}

export const MessageComposer = ({ onSend }: MessageComposerProps) => {
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (message.trim()) {
      onSend(message);
      setMessage("");
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border/40 p-4 safe-area-inset-bottom bg-background">
      <div className="flex items-end gap-2">
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message"
          className="flex-1 min-h-[36px] max-h-[120px] resize-none text-[15px] rounded-[20px] border-border/40"
          rows={1}
        />
        
        <Button
          onClick={handleSend}
          disabled={!message.trim()}
          size="icon"
          className="h-9 w-9 rounded-full shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};
