import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type AppRole = "admin" | "moderator" | "user";

interface UserWithRole {
  id: string;
  name: string;
  profile_image?: string;
  roles: AppRole[];
}

const AdminPanel = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: hasAdminRole } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (!hasAdminRole) {
        toast({
          title: "Access denied",
          description: "You don't have admin privileges",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      setIsAdmin(true);
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, profile_image");

      const { data: userRoles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      const usersWithRoles: UserWithRole[] = (profiles || []).map((profile) => ({
        id: profile.id,
        name: profile.name,
        profile_image: profile.profile_image || undefined,
        roles: userRoles
          ?.filter((ur) => ur.user_id === profile.id)
          .map((ur) => ur.role as AppRole) || [],
      }));

      setUsers(usersWithRoles);
    } catch (error: any) {
      toast({
        title: "Error loading users",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateUserRole = async (userId: string, role: AppRole) => {
    try {
      // Remove existing roles
      await supabase.from("user_roles").delete().eq("user_id", userId);

      // Add new role
      await supabase.from("user_roles").insert({
        user_id: userId,
        role,
      });

      toast({
        title: "Role updated",
        description: "User role has been updated successfully",
      });

      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="h-screen flex flex-col bg-background">
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold">Admin Panel</h1>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="text-xl font-semibold mb-4">Manage User Roles</h2>
          {users.map((user) => (
            <div
              key={user.id}
              className="bg-card border border-border rounded-lg p-4 flex items-center gap-4"
            >
              <Avatar className="w-12 h-12">
                <AvatarImage src={user.profile_image} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user.name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-muted-foreground">
                  Current role: {user.roles[0] || "user"}
                </p>
              </div>
              <Select
                value={user.roles[0] || "user"}
                onValueChange={(value) => updateUserRole(user.id, value as AppRole)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="moderator">Moderator</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default AdminPanel;
