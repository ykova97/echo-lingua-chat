import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Plus, LogOut, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Chat {
  id: string;
  type: string;
  name: string | null;
  created_at: string;
  participants: any[];
  last_message?: {
    text: string;
    created_at: string;
  };
}

const ChatList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    loadChats();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    
    setCurrentUser({ ...user, ...profile });
  };

  const loadChats = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get user's chats
      const { data: chatParticipants, error } = await supabase
        .from("chat_participants")
        .select(`
          chat_id,
          chats (
            id,
            type,
            name,
            created_at
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      // Get participants for each chat
      const chatsWithDetails = await Promise.all(
        (chatParticipants || []).map(async (cp: any) => {
          const chat = cp.chats;
          
          // Get all participants
          const { data: participants } = await supabase
            .from("chat_participants")
            .select(`
              user_id,
              profiles (
                name,
                profile_image,
                preferred_language
              )
            `)
            .eq("chat_id", chat.id);

          // Get last message
          const { data: lastMessage } = await supabase
            .from("messages")
            .select("original_text, created_at")
            .eq("chat_id", chat.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

          return {
            ...chat,
            participants: participants || [],
            last_message: lastMessage ? {
              text: lastMessage.original_text,
              created_at: lastMessage.created_at,
            } : undefined,
          };
        })
      );

      setChats(chatsWithDetails);
    } catch (error: any) {
      toast({
        title: "Error loading chats",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getChatName = (chat: Chat) => {
    if (chat.name) return chat.name;
    
    const otherParticipants = chat.participants.filter(
      (p: any) => p.user_id !== currentUser?.id
    );
    
    if (otherParticipants.length === 0) return "Chat";
    if (otherParticipants.length === 1) {
      return otherParticipants[0].profiles?.name || "User";
    }
    return `${otherParticipants[0].profiles?.name || "User"} and ${otherParticipants.length - 1} others`;
  };

  const getChatAvatar = (chat: Chat) => {
    const otherParticipants = chat.participants.filter(
      (p: any) => p.user_id !== currentUser?.id
    );
    return otherParticipants[0]?.profiles?.profile_image;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <MessageCircle className="w-12 h-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading your chats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Link</h1>
              <p className="text-xs text-muted-foreground">
                {currentUser?.name || "User"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="default" size="sm" onClick={() => navigate("/compose")}>
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Chat List */}
      <main className="max-w-4xl mx-auto p-4">
        {chats.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto">
              <MessageCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold">No conversations yet</h2>
          </div>
        ) : (
          <div className="space-y-2">
            {chats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => navigate(`/chat/${chat.id}`)}
                className="w-full bg-card hover:bg-secondary/50 rounded-2xl p-4 border border-border transition-colors duration-200 flex items-center gap-4"
              >
                <Avatar className="w-14 h-14">
                  <AvatarImage src={getChatAvatar(chat)} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {getInitials(getChatName(chat))}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left">
                  <h3 className="font-semibold text-foreground">{getChatName(chat)}</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    {chat.last_message?.text || "No messages yet"}
                  </p>
                </div>
                {chat.last_message && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(chat.last_message.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </main>

    </div>
  );
};

export default ChatList;