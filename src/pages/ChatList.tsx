import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Plus, LogOut, Settings, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { SwipeableChatItem } from "@/components/chat/SwipeableChatItem";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  unread_count?: number;
}

const ChatList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadChats();
    }
  }, [currentUser]);

  // Reload chats when component comes back into focus
  useEffect(() => {
    const handleFocus = () => {
      if (currentUser) {
        loadChats();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) {
      
      // Subscribe to new messages and read receipts for real-time updates
      const channel = supabase
        .channel('chat-list-updates')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
          },
          async (payload) => {
            const newMsg = payload.new as any;
            
            // Check if this message is in one of the user's chats
            const { data: isParticipant } = await supabase
              .from('chat_participants')
              .select('chat_id')
              .eq('chat_id', newMsg.chat_id)
              .eq('user_id', currentUser.id)
              .maybeSingle();
            
            if (!isParticipant) return;
            
            // Update the chat list
            setChats(prev => {
              const chatIndex = prev.findIndex(c => c.id === newMsg.chat_id);
              
              if (chatIndex === -1) {
                // New chat - reload all chats
                loadChats();
                return prev;
              }
              
              // Update existing chat
              const updatedChats = [...prev];
              const chat = updatedChats[chatIndex];
              
              // Update last message
              updatedChats[chatIndex] = {
                ...chat,
                last_message: {
                  text: newMsg.original_text,
                  created_at: newMsg.created_at,
                },
                // Increment unread count if message is from someone else
                unread_count: newMsg.sender_id !== currentUser.id 
                  ? (chat.unread_count || 0) + 1 
                  : chat.unread_count || 0,
              };
              
              // Move this chat to the top of the list
              const [updatedChat] = updatedChats.splice(chatIndex, 1);
              return [updatedChat, ...updatedChats];
            });
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'message_read_receipts',
            filter: `user_id=eq.${currentUser.id}`,
          },
          async (payload) => {
            const receipt = payload.new as any;
            
            // Get the chat_id for this message
            const { data: message } = await supabase
              .from('messages')
              .select('chat_id')
              .eq('id', receipt.message_id)
              .single();
            
            if (!message) return;
            
            // Decrement unread count for this chat
            setChats(prev => 
              prev.map(chat => 
                chat.id === message.chat_id && chat.unread_count && chat.unread_count > 0
                  ? { ...chat, unread_count: chat.unread_count - 1 }
                  : chat
              )
            );
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentUser]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      } else if (event === 'SIGNED_IN') {
        // Refresh user data when signed in
        checkAuth();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate]);

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .single();
      
      if (profile) {
        setCurrentUser({ ...session.user, ...profile });
      }
    } catch (error) {
      console.error("Auth check error:", error);
    }
  };

  const loadChats = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const user = session.user;

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

          // Get unread count
          const { data: messages } = await supabase
            .from("messages")
            .select("id")
            .eq("chat_id", chat.id)
            .neq("sender_id", user.id);

          let unreadCount = 0;
          if (messages) {
            for (const msg of messages) {
              const { data: readReceipt } = await supabase
                .from("message_read_receipts")
                .select("id")
                .eq("message_id", msg.id)
                .eq("user_id", user.id)
                .maybeSingle();
              
              if (!readReceipt) {
                unreadCount++;
              }
            }
          }

          return {
            ...chat,
            participants: participants || [],
            last_message: lastMessage ? {
              text: lastMessage.original_text,
              created_at: lastMessage.created_at,
            } : undefined,
            unread_count: unreadCount,
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

  const handleDeleteChat = async () => {
    if (!chatToDelete) return;

    const deletedChatId = chatToDelete;
    
    // Close dialog first
    setChatToDelete(null);

    try {
      // Optimistically remove from UI immediately
      setChats((prevChats) => prevChats.filter((chat) => chat.id !== deletedChatId));

      // Delete all related data first due to foreign key constraints
      const { data: messages } = await supabase
        .from("messages")
        .select("id")
        .eq("chat_id", deletedChatId);

      if (messages) {
        for (const msg of messages) {
          await supabase
            .from("message_reactions")
            .delete()
            .eq("message_id", msg.id);
          
          await supabase
            .from("message_read_receipts")
            .delete()
            .eq("message_id", msg.id);
          
          await supabase
            .from("message_translations")
            .delete()
            .eq("message_id", msg.id);
        }
      }

      // Delete messages
      await supabase
        .from("messages")
        .delete()
        .eq("chat_id", deletedChatId);

      // Delete chat participants
      await supabase
        .from("chat_participants")
        .delete()
        .eq("chat_id", deletedChatId);

      // Delete muted chats
      await supabase
        .from("muted_chats")
        .delete()
        .eq("chat_id", deletedChatId);

      // Delete the chat itself
      const { error } = await supabase
        .from("chats")
        .delete()
        .eq("id", deletedChatId);

      if (error) throw error;

      toast({
        title: "Chat deleted",
        description: "The conversation has been removed.",
      });
    } catch (error: any) {
      console.error("Delete error:", error);
      toast({
        title: "Error deleting chat",
        description: error.message,
        variant: "destructive",
      });
      // Reload chats on error to restore the UI
      await loadChats();
    }
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
            <Button variant="ghost" size="icon" onClick={() => navigate("/settings")}>
              <Settings className="w-5 h-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut}>
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="max-w-4xl mx-auto px-4 py-3 bg-background">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary/50 border-0 rounded-xl"
            />
          </div>
          <Button size="icon" onClick={() => navigate("/compose")} className="rounded-full">
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Chat List */}
      <main className="max-w-4xl mx-auto px-4 pb-4">
        {chats.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="w-16 h-16 bg-secondary rounded-full flex items-center justify-center mx-auto">
              <MessageCircle className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-semibold">No conversations yet</h2>
          </div>
        ) : (
          <div className="space-y-2">
            {chats
              .filter((chat) => {
                const chatName = getChatName(chat).toLowerCase();
                const lastMessage = chat.last_message?.text.toLowerCase() || "";
                const query = searchQuery.toLowerCase();
                return chatName.includes(query) || lastMessage.includes(query);
              })
              .map((chat) => (
                <SwipeableChatItem
                  key={chat.id}
                  chatId={chat.id}
                  chatName={getChatName(chat)}
                  chatAvatar={getChatAvatar(chat)}
                  lastMessage={chat.last_message?.text || "No messages yet"}
                  lastMessageTime={
                    chat.last_message
                      ? new Date(chat.last_message.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : undefined
                  }
                  unreadCount={chat.unread_count}
                  onChatClick={() => navigate(`/chat/${chat.id}`)}
                  onDelete={(id) => setChatToDelete(id)}
                />
              ))}
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!chatToDelete} onOpenChange={() => setChatToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteChat}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChatList;