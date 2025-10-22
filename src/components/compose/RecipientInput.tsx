import { useRef, useEffect, KeyboardEvent } from "react";
import { RecipientChip } from "./RecipientChip";
import { Recipient } from "@/types/recipient";
import { Input } from "@/components/ui/input";

interface RecipientInputProps {
  recipients: Recipient[];
  toFieldText: string;
  onToFieldTextChange: (text: string) => void;
  onRemoveRecipient: (recipientId: string) => void;
  onFocus: () => void;
}

export const RecipientInput = ({
  recipients,
  toFieldText,
  onToFieldTextChange,
  onRemoveRecipient,
  onFocus,
}: RecipientInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Handle backspace at beginning of input
    if (e.key === "Backspace" && toFieldText === "" && recipients.length > 0) {
      e.preventDefault();
      const lastRecipient = recipients[recipients.length - 1];
      
      // Highlight effect (could add visual state here)
      setTimeout(() => {
        onRemoveRecipient(lastRecipient.id);
      }, 100);
    }

    // Handle comma, enter, or space to commit
    if ([",", "Enter", " "].includes(e.key) && toFieldText.trim()) {
      e.preventDefault();
      // In a real app, this would validate and create a recipient
      // For now, just clear the field since suggestions will handle adding
      onToFieldTextChange("");
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pastedText = e.clipboardData.getData("text");
    
    // Check if multiple values (comma/newline separated)
    if (pastedText.includes(",") || pastedText.includes("\n")) {
      e.preventDefault();
      // Split and process multiple entries
      const entries = pastedText.split(/[,\n]/).map(s => s.trim()).filter(Boolean);
      
      // In a real app, you'd validate and create recipients for each
      console.log("Multiple entries pasted:", entries);
    }
  };

  return (
    <div className="py-3 px-4">
      <div className="flex items-start gap-2">
        <label className="text-[15px] text-muted-foreground pt-1.5 shrink-0">
          To:
        </label>
        
        <div 
          ref={containerRef}
          className="flex-1 flex flex-wrap gap-1.5 items-center min-h-[32px]"
        >
          {/* Recipient Chips */}
          {recipients.map((recipient) => (
            <RecipientChip
              key={recipient.id}
              recipient={recipient}
              onRemove={() => onRemoveRecipient(recipient.id)}
            />
          ))}
          
          {/* Input Field */}
          <Input
            ref={inputRef}
            type="text"
            value={toFieldText}
            onChange={(e) => onToFieldTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={onFocus}
            placeholder={recipients.length === 0 ? "Name or email" : ""}
            className="flex-1 min-w-[120px] border-0 shadow-none focus-visible:ring-0 px-0 h-[32px] text-[15px]"
          />
        </div>
      </div>
    </div>
  );
};
