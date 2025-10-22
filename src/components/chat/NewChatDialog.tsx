import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New Chat</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* User List */}
          <div className="max-h-80 overflow-y-auto space-y-2">
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => toggleUser(user.id)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary transition-colors"
              >
                <Avatar>
                  <AvatarImage src={user.profile_image} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {user.name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <p className="font-medium">{user.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {user.preferred_language}
                  </p>
                </div>
                {selected.includes(user.id) && (
                  <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                    <Check className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={createChat}
              disabled={selected.length === 0 || loading}
              className="flex-1"
            >
              {loading ? "Creating..." : `Chat ${selected.length > 0 ? `(${selected.length})` : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewChatDialog;