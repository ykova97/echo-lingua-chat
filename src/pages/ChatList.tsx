import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Plus, LogOut, Settings, Search, QrCode, Globe, RefreshCw } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChatListSkeleton } from "@/components/chat/ChatListSkeleton";
import { Skeleton } from "@/components/ui/skeleton";
import ProfileQRCode from "@/components/settings/ProfileQRCode";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

interface Chat {
  id: string;
  type: string;
  name: string | null;
  created_at: string;
  participants: any[];
  guest_session_id?: string | null;
  guest_session?: {
    display_name: string;
    preferred_language: string;
  } | null;
  last_message?: {
    text: string;
    created_at: string;
  };
  unread_count?: number;
}

const ChatList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [greeting, setGreeting] = useState("");

  // Pull to refresh
  const { scrollContainerRef, pullDistance, isRefreshing, progress } = usePullToRefresh({
    onRefresh: async () => {
      await loadChats();
    },
    threshold: 80,
    disabled: loading,
  });

  // Update greeting based on time of day
  useEffect(() => {
    const updateGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) {
        setGreeting("Good morning");
      } else if (hour < 18) {
        setGreeting("Good afternoon");
      } else {
        setGreeting("Good evening");
      }
    };

    updateGreeting();
    // Update every minute to catch time changes
    const interval = setInterval(updateGreeting, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      loadChats();
    }
  }, [currentUser]);

  // Reload chats when navigating to this page
  useEffect(() => {
    if (currentUser) {
      loadChats();
    }
  }, [location.pathname, currentUser]);

  useEffect(() => {
    if (currentUser) {
      
      // Subscribe to new messages, read receipts, and chat participants for real-time updates
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
            
            // Check if this message is in one of the user's chats (either as participant or creator)
            const { data: isParticipant } = await supabase
              .from('chat_participants')
              .select('chat_id')
              .eq('chat_id', newMsg.chat_id)
              .eq('user_id', currentUser.id)
              .maybeSingle();
            
            const { data: isCreator } = await supabase
              .from('chats')
              .select('id')
              .eq('id', newMsg.chat_id)
              .eq('created_by', currentUser.id)
              .maybeSingle();
            
            if (!isParticipant && !isCreator) return;
            
            // Try to get translation for user's preferred language
            let messageText = newMsg.original_text;
            if (currentUser?.preferred_language) {
              // Wait a bit for translation to be created
              setTimeout(async () => {
                const { data: translation } = await supabase
                  .from("message_translations")
                  .select("translated_text")
                  .eq("message_id", newMsg.id)
                  .eq("user_id", currentUser.id)
                  .eq("target_language", currentUser.preferred_language)
                  .maybeSingle();
                
                if (translation) {
                  // Update the chat with translated text
                  setChats(prev => {
                    const chatIndex = prev.findIndex(c => c.id === newMsg.chat_id);
                    if (chatIndex === -1) return prev;
                    
                    const updatedChats = [...prev];
                    const chat = updatedChats[chatIndex];
                    
                    updatedChats[chatIndex] = {
                      ...chat,
                      last_message: {
                        text: translation.translated_text,
                        created_at: newMsg.created_at,
                      },
                    };
                    
                    return updatedChats;
                  });
                }
              }, 1000);
            }
            
            // Update the chat list immediately with original text
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
                  text: messageText,
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
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_participants',
            filter: `user_id=eq.${currentUser.id}`,
          },
          async () => {
            // New chat participant added for current user - reload chat list
            console.log('New chat participant detected, reloading chats');
            await loadChats();
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${currentUser.id}`,
          },
          async () => {
            // Profile updated - refresh user data
            await checkAuth();
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

      // Get user's chats where they are a participant
      const { data: chatParticipants, error } = await supabase
        .from("chat_participants")
        .select(`
          chat_id,
          chats (
            id,
            type,
            name,
            created_at,
            guest_session_id
          )
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      // Get guest chats where user is the owner
      const { data: guestChats } = await supabase
        .from("chats")
        .select("id, type, name, created_at, guest_session_id")
        .eq("created_by", user.id)
        .not("guest_session_id", "is", null);

      // Combine both sets of chats, avoiding duplicates
      const allChats = [...(chatParticipants || []).map((cp: any) => cp.chats)];
      const existingChatIds = new Set(allChats.map(c => c.id));
      
      if (guestChats) {
        guestChats.forEach(gc => {
          if (!existingChatIds.has(gc.id)) {
            allChats.push(gc);
          }
        });
      }

      if (allChats.length === 0) {
        setChats([]);
        setLoading(false);
        return;
      }

      const chatIds = allChats.map((c: any) => c.id);

      // Batch fetch: Get ALL participants for ALL chats in one query
      const { data: allParticipants } = await supabase
        .from("chat_participants")
        .select("chat_id, user_id")
        .in("chat_id", chatIds);

      // Get unique user IDs
      const uniqueUserIds = [...new Set((allParticipants || []).map((p: any) => p.user_id))];

      // Batch fetch: Get ALL profiles in one query
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("id, name, profile_image, preferred_language")
        .in("id", uniqueUserIds);

      // Batch fetch: Get ALL guest sessions in one query (both as participants and linked to chats)
      const guestSessionIds = allChats
        .filter((c: any) => c.guest_session_id)
        .map((c: any) => c.guest_session_id);
      
      const allGuestIds = [...new Set([...uniqueUserIds, ...guestSessionIds])];
      
      const { data: allGuests } = await supabase
        .from("guest_sessions")
        .select("id, display_name, preferred_language")
        .in("id", allGuestIds);

      // Create lookup maps for fast access
      const profileMap = new Map((allProfiles || []).map((p: any) => [p.id, p]));
      const guestMap = new Map((allGuests || []).map((g: any) => [g.id, g]));
      const participantsByChatId = new Map<string, any[]>();
      
      (allParticipants || []).forEach((p: any) => {
        if (!participantsByChatId.has(p.chat_id)) {
          participantsByChatId.set(p.chat_id, []);
        }
        const profile = profileMap.get(p.user_id);
        const guest = guestMap.get(p.user_id);
        
        participantsByChatId.get(p.chat_id)!.push({
          user_id: p.user_id,
          profiles: profile || (guest ? {
            name: guest.display_name,
            profile_image: null,
            preferred_language: guest.preferred_language
          } : {
            name: "Unknown User",
            profile_image: null,
            preferred_language: "en"
          })
        });
      });

      // Batch fetch: Get last message for each chat
      const { data: allLastMessages } = await supabase
        .from("messages")
        .select("id, chat_id, original_text, created_at, sender_id")
        .in("chat_id", chatIds)
        .order("created_at", { ascending: false });

      // Group messages by chat and get the last one
      const lastMessageByChat = new Map<string, any>();
      (allLastMessages || []).forEach((msg: any) => {
        if (!lastMessageByChat.has(msg.chat_id)) {
          lastMessageByChat.set(msg.chat_id, msg);
        }
      });

      // Get message IDs for translation lookup
      const messageIds = Array.from(lastMessageByChat.values()).map(m => m.id);

      // Batch fetch: Get ALL translations in one query
      const { data: allTranslations } = await supabase
        .from("message_translations")
        .select("message_id, translated_text, target_language")
        .in("message_id", messageIds)
        .eq("user_id", user.id)
        .eq("target_language", currentUser?.preferred_language || "en");

      const translationMap = new Map((allTranslations || []).map((t: any) => [t.message_id, t.translated_text]));

      // Batch fetch: Get ALL messages from others for unread count
      const { data: allMessagesFromOthers } = await supabase
        .from("messages")
        .select("id, chat_id, sender_id")
        .in("chat_id", chatIds)
        .neq("sender_id", user.id);

      // Get all message IDs to check read receipts
      const otherMessageIds = (allMessagesFromOthers || []).map((m: any) => m.id);

      // Batch fetch: Get ALL read receipts in one query
      const { data: allReadReceipts } = await supabase
        .from("message_read_receipts")
        .select("message_id, user_id")
        .in("message_id", otherMessageIds)
        .eq("user_id", user.id);

      const readReceiptSet = new Set((allReadReceipts || []).map((r: any) => r.message_id));

      // Calculate unread counts per chat
      const unreadCountByChat = new Map<string, number>();
      (allMessagesFromOthers || []).forEach((msg: any) => {
        if (!readReceiptSet.has(msg.id)) {
          unreadCountByChat.set(msg.chat_id, (unreadCountByChat.get(msg.chat_id) || 0) + 1);
        }
      });

      // Assemble final chat data
      const chatsWithDetails = allChats.map((chat: any) => {
        const lastMessage = lastMessageByChat.get(chat.id);
        const translatedText = lastMessage 
          ? (translationMap.get(lastMessage.id) || lastMessage.original_text)
          : undefined;

        return {
          ...chat,
          participants: participantsByChatId.get(chat.id) || [],
          last_message: lastMessage ? {
            text: translatedText,
            created_at: lastMessage.created_at,
          } : undefined,
          unread_count: unreadCountByChat.get(chat.id) || 0,
          guest_session: chat.guest_session_id ? guestMap.get(chat.guest_session_id) : null,
        };
      });

      // Sort chats by most recent activity (newest first)
      chatsWithDetails.sort((a, b) => {
        const aTime = a.last_message?.created_at || a.created_at;
        const bTime = b.last_message?.created_at || b.created_at;
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });

      setChats(chatsWithDetails);
    } catch (error: any) {
      console.error("Error loading chats:", error);
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
    
    // Check if it's a guest chat
    if (chat.guest_session_id && chat.guest_session) {
      return chat.guest_session.display_name || "Guest chat";
    }
    
    const otherParticipants = chat.participants.filter(
      (p: any) => p.user_id !== currentUser?.id
    );
    
    if (otherParticipants.length === 0) return "Guest chat";
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
      <div className="flex flex-col h-screen bg-background px-6 pt-6">
        {/* Header Card Skeleton */}
        <header className="card-float gradient-header p-4 mb-6">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
              <div className="flex flex-col gap-2 min-w-0 flex-1">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-6 flex-shrink-0">
              <Skeleton className="h-6 w-12 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>
          </div>
        </header>

        {/* Search Bar Skeleton */}
        <div className="px-4 mb-6">
          <div className="rounded-full bg-white shadow-inner-soft p-1 flex items-center gap-3" style={{ border: '1px solid transparent', backgroundImage: 'linear-gradient(white, white), var(--gradient-border)', backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' }}>
            <div className="flex-1 pl-4">
              <Skeleton className="h-10 w-full max-w-xs" />
            </div>
            <Skeleton className="rounded-full h-10 w-10" />
          </div>
        </div>

        {/* Chat List Skeleton */}
        <main className="flex-1 overflow-y-auto px-6 pb-32">
          <ChatListSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header Card */}
      <header className="card-float gradient-header p-4 mb-6 mx-6 mt-6 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-coral to-primary flex items-center justify-center shadow-soft flex-shrink-0">
              <Avatar className="h-full w-full">
                <AvatarImage src={currentUser?.user_metadata?.profile_image} />
                <AvatarFallback className="bg-transparent text-white text-xl">
                  {currentUser?.user_metadata?.name?.charAt(0) || currentUser?.email?.charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <h1 className="text-xl font-bold text-foreground truncate">
                {greeting}, {currentUser?.user_metadata?.name?.split(' ')[0] || 'User'}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {chats.filter(c => c.unread_count).length} new and {chats.length} active
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-6 flex-shrink-0">
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary/50 text-xs font-medium">
              <Globe className="h-3 w-3" />
              <span className="uppercase">{currentUser?.preferred_language || 'en'}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/settings")}
              className="rounded-full hover:bg-black/5 h-8 w-8"
            >
              <Settings className="h-4 w-4 text-foreground/60" />
            </Button>
          </div>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-10 mb-6 flex-shrink-0">
        <div className="relative">
          <div className="rounded-full bg-white shadow-inner-soft p-1 flex items-center gap-3" style={{ border: '1px solid transparent', backgroundImage: 'linear-gradient(white, white), var(--gradient-border)', backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box' }}>
            <div className="flex-1 pl-4">
              <Input
                placeholder="ask Link"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 bg-transparent focus-visible:ring-0 placeholder:text-muted-foreground/60 h-10 px-0"
              />
            </div>
            <Button
              size="icon"
              onClick={() => setQrDialogOpen(true)}
              className="rounded-full h-10 w-10 gradient-coral shadow-soft hover:scale-105 transition-transform"
            >
              <QrCode className="h-5 w-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* Scrollable Content with Pull to Refresh */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-6 pb-32"
        style={{ overscrollBehavior: 'contain' }}
      >
        {/* Pull to Refresh Indicator */}
        <div 
          className="flex justify-center transition-all duration-200"
          style={{ 
            height: `${pullDistance}px`,
            opacity: progress,
          }}
        >
          <div className="flex items-center gap-2 text-primary">
            <RefreshCw 
              className={`h-5 w-5 transition-transform ${isRefreshing || progress >= 1 ? 'animate-spin' : ''}`}
              style={{ transform: `rotate(${progress * 360}deg)` }}
            />
            <span className="text-sm font-medium">
              {isRefreshing ? 'Refreshing...' : progress >= 1 ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </div>

        {/* Chat List */}
        <main className="space-y-4">
        {chats.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No active chats</p>
            <Button
              onClick={() => navigate("/compose")}
              className="rounded-full gradient-coral shadow-soft hover:scale-105 transition-transform"
            >
              <Plus className="h-4 w-4 mr-2" />
              Start New Chat
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {chats
              .filter((chat) => {
                const chatName = getChatName(chat).toLowerCase();
                const lastMessage = chat.last_message?.text.toLowerCase() || "";
                const query = searchQuery.toLowerCase();
                return chatName.includes(query) || lastMessage.includes(query);
              })
              .map((chat) => (
                <div
                  key={chat.id}
                  className="card-soft hover:shadow-float transition-all duration-300"
                >
                  <SwipeableChatItem
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
                    onChatClick={() => {
                      setChats(prev => 
                        prev.map(c => c.id === chat.id ? { ...c, unread_count: 0 } : c)
                      );
                      navigate(`/chat/${chat.id}`);
                    }}
                    onDelete={() => setChatToDelete(chat.id)}
                  />
                </div>
              ))}
          </div>
        )}
      </main>
      </div>
      
      {/* Floating Bottom Nav */}
      <div className="fixed bottom-6 left-6 right-6 z-50">
        <div className="card-float flex items-center justify-center gap-20 py-3 px-6 max-w-4xl mx-auto">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/chats")}
            className="rounded-full hover:bg-accent/50 h-12 w-12"
          >
            <MessageCircle className="h-5 w-5 text-foreground/70" />
          </Button>
          <Button
            onClick={() => navigate("/compose")}
            className="rounded-full h-16 w-16 gradient-coral shadow-float hover:scale-110 transition-transform -mt-8"
          >
            <Plus className="h-7 w-7 text-white" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-accent/50 h-12 w-12"
          >
            <span className="text-xl">👥</span>
          </Button>
        </div>
      </div>

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

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Guest Invite QR Code</DialogTitle>
          </DialogHeader>
          <ProfileQRCode />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChatList;