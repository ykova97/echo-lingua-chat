import { X } from "lucide-react";
import { Recipient } from "@/types/recipient";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface RecipientChipProps {
  recipient: Recipient;
  onRemove: () => void;
}

export const RecipientChip = ({ recipient, onRemove }: RecipientChipProps) => {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const chipStyles = recipient.is_valid
    ? recipient.is_link_user
      ? "bg-primary/10 text-primary border-primary/20"
      : "bg-muted text-muted-foreground border-border"
    : "bg-destructive/10 text-destructive border-destructive";

  return (
    <div
      className={`inline-flex items-center gap-1.5 h-[30px] pl-1.5 pr-2 rounded-full border transition-all duration-150 ${chipStyles}`}
    >
      <Avatar className="h-5 w-5">
        <AvatarImage src={recipient.avatar_url} alt={recipient.display_name} />
        <AvatarFallback className="text-[10px]">
          {getInitials(recipient.display_name)}
        </AvatarFallback>
      </Avatar>
      
      <span className="text-[13px] font-medium max-w-[120px] truncate">
        {recipient.display_name}
      </span>
      
      <Button
        variant="ghost"
        size="icon"
        onClick={onRemove}
        className="h-4 w-4 p-0 hover:bg-transparent"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
};
