import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ReactionPickerProps {
  onReactionSelect: (reaction: string) => void;
  children: ReactNode;
}

const REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🙏", "👏", "🔥"];

export const ReactionPicker = ({ onReactionSelect, children }: ReactionPickerProps) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        {children}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2" align="center">
        <div className="flex gap-1">
          {REACTIONS.map((reaction) => (
            <Button
              key={reaction}
              variant="ghost"
              size="sm"
              className="h-10 w-10 p-0 text-xl hover:scale-125 transition-transform"
              onClick={() => onReactionSelect(reaction)}
            >
              {reaction}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};