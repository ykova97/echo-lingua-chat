import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ContactSuggestionsProps {
  suggestions: any[];
  onSelectContact: (contact: any) => void;
}

export const ContactSuggestions = ({
  suggestions,
  onSelectContact,
}: ContactSuggestionsProps) => {
  const getInitials = (name: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <ScrollArea className="flex-1 animate-fade-in">
      <div className="divide-y divide-border/40">
        {suggestions.map((contact) => (
          <button
            key={contact.id}
            onClick={() => onSelectContact(contact)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors duration-150 text-left"
          >
            <Avatar className="h-10 w-10">
              <AvatarImage src={contact.profile_image} alt={contact.name} />
              <AvatarFallback>
                {getInitials(contact.name || "?")}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0">
              <div className="text-[17px] font-medium truncate">
                {contact.name || "Unknown User"}
              </div>
              <div className="text-[13px] text-muted-foreground truncate">
                {contact.email || contact.phone || contact.preferred_language}
              </div>
            </div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );
};
