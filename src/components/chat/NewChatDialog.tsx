import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChatCreated: (chatId: string) => void;
}

const NewChatDialog = ({ open, onOpenChange, onChatCreated }: NewChatDialogProps) => {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      loadUsers();
    }
  }, [open]);

  const loadUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .neq("id", user.id);

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      toast({
        title: "Error loading users",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(search.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    setSelected((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const createChat = async () => {
    if (selected.length === 0) return;

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Create chat
      const { data: chat, error: chatError } = await supabase
        .from("chats")
        .insert({
          type: selected.length === 1 ? "direct" : "group",
          created_by: user.id,
        })
        .select()
        .single();

      if (chatError) throw chatError;

      // Add participants
      const participants = [
        { chat_id: chat.id, user_id: user.id },
        ...selected.map((userId) => ({ chat_id: chat.id, user_id: userId })),
      ];

      const { error: participantsError } = await supabase
        .from("chat_participants")
        .insert(participants);

      if (participantsError) throw participantsError;

      toast({
        title: "Chat created!",
        description: "Start chatting in any language.",
      });

      onChatCreated(chat.id);
      setSelected([]);
      setSearch("");
    } catch (error: any) {
      toast({
        title: "Error creating chat",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getSelectedUsers = () => {
    return users.filter(u => selected.includes(u.id));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px] p-0 gap-0">
        {/* iMessage-style Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button
            onClick={() => onOpenChange(false)}
            className="text-primary text-[17px] font-normal"
          >
            Cancel
          </button>
          <h2 className="text-[17px] font-semibold">New Message</h2>
          <div className="w-[60px]" /> {/* Spacer for centering */}
        </div>

        {/* To: Field */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground text-[17px] pt-1">To:</span>
            <div className="flex-1 flex flex-wrap gap-2 items-center">
              {getSelectedUsers().map((user) => (
                <Badge
                  key={user.id}
                  variant="secondary"
                  className="rounded-full px-3 py-1 flex items-center gap-1"
                >
                  {user.name}
                  <button
                    onClick={() => toggleUser(user.id)}
                    className="hover:bg-secondary-foreground/10 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <input
                type="text"
                placeholder={selected.length === 0 ? "Name or phone number" : ""}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-transparent border-none outline-none text-[17px] placeholder:text-muted-foreground/60 min-w-[120px]"
              />
            </div>
          </div>
        </div>

        {/* Contacts List */}
        <div className="flex-1 overflow-y-auto">
          {filteredUsers.map((user) => {
            const isSelected = selected.includes(user.id);
            return (
              <button
                key={user.id}
                onClick={() => toggleUser(user.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border/50 ${
                  isSelected ? 'bg-secondary/30' : ''
                }`}
              >
                <Avatar className="w-10 h-10">
                  <AvatarImage src={user.profile_image} />
                  <AvatarFallback className="bg-primary/10 text-primary text-[15px]">
                    {user.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="font-normal text-[17px]">{user.name}</p>
                  <p className="text-[13px] text-muted-foreground">
                    {user.preferred_language}
                  </p>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Create Button - Only show when users selected */}
        {selected.length > 0 && (
          <div className="p-4 border-t border-border">
            <button
              onClick={createChat}
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground rounded-full py-3 text-[17px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Creating..." : `Create Chat ${selected.length > 1 ? `with ${selected.length} people` : ""}`}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NewChatDialog;