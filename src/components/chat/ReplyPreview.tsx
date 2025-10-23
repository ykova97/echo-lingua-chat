import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ReplyPreviewProps {
  replyingTo: {
    id: string;
    sender_name?: string;
    original_text: string;
  } | null;
  onCancel: () => void;
}

export const ReplyPreview = ({ replyingTo, onCancel }: ReplyPreviewProps) => {
  if (!replyingTo) return null;

  return (
    <div className="bg-secondary/50 border-l-4 border-primary px-4 py-2 flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground">
          Replying to {replyingTo.sender_name || "User"}
        </p>
        <p className="text-sm truncate">{replyingTo.original_text}</p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0"
        onClick={onCancel}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};
