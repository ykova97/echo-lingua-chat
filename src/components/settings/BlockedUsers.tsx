import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface BlockedUser {
  id: string;
  blocked_id: string;
  blocked_user: {
    name: string;
    profile_image?: string;
  };
}

export const BlockedUsers = () => {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("blocked_users")
        .select(`
          id,
          blocked_id,
          profiles:blocked_id (
            name,
            profile_image
          )
        `)
        .eq("blocker_id", user.id);

      setBlockedUsers(
        (data || []).map((item: any) => ({
          id: item.id,
          blocked_id: item.blocked_id,
          blocked_user: item.profiles,
        }))
      );
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const unblockUser = async (blockId: string) => {
    try {
      await supabase.from("blocked_users").delete().eq("id", blockId);

      toast({
        title: "User unblocked",
        description: "User has been unblocked successfully",
      });

      await loadBlockedUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (blockedUsers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No blocked users
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {blockedUsers.map((blocked) => (
        <div
          key={blocked.id}
          className="flex items-center gap-3 p-3 bg-secondary/20 rounded-lg"
        >
          <Avatar className="w-10 h-10">
            <AvatarImage src={blocked.blocked_user.profile_image} />
            <AvatarFallback className="bg-primary/10 text-primary">
              {blocked.blocked_user.name[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <p className="font-medium">{blocked.blocked_user.name}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => unblockUser(blocked.id)}
          >
            Unblock
          </Button>
        </div>
      ))}
    </div>
  );
};
