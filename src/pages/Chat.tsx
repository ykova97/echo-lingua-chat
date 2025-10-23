import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MessageBubble from "@/components/chat/MessageBubble";
import { ReplyPreview } from "@/components/chat/ReplyPreview";

interface Message {
  id: string;
  sender_id: string;
  original_text: string;
  source_language: string;
  created_at: string;
  sender_name?: string;
  sender_image?: string;
  translated_text?: string;
  target_language?: string;
  reactions?: Array<{ reaction: string; user_id: string; user_name?: string; count: number }>;
  reply_to?: {
    sender_name?: string;
    original_text: string;
  };
  is_read?: boolean;
}

const Chat = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatInfo, setChatInfo] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [showOriginal, setShowOriginal] = useState<Record<string, boolean>>({});
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuth();
    loadChat();
    loadMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        async (payload) => {
          const newMsg = payload.new as any;
          
          // Get sender info
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("name, profile_image")
            .eq("id", newMsg.sender_id)
            .single();

          // Get translation for current user
          const { data: translation } = await supabase
            .from("message_translations")
            .select("translated_text, target_language")
            .eq("message_id", newMsg.id)
            .eq("user_id", currentUser.id)
            .single();

          setMessages((prev) => [
            ...prev,
            {
              ...newMsg,
              sender_name: senderProfile?.name,
              sender_image: senderProfile?.profile_image,
              translated_text: translation?.translated_text,
              target_language: translation?.target_language,
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

  const loadChat = async () => {
    try {
      const { data: chat, error } = await supabase
        .from("chats")
        .select(`
          *,
          chat_participants (
            user_id,
            profiles (
              name,
              profile_image,
              preferred_language
            )
          )
        `)
        .eq("id", chatId)
        .single();

      if (error) throw error;
      setChatInfo(chat);
    } catch (error: any) {
      toast({
        title: "Error loading chat",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const loadMessages = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get messages first
      const { data: msgs, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Get translations, reactions, and read receipts for each message
      const messagesWithData = await Promise.all(
        (msgs || []).map(async (msg: any) => {
          // Get sender profile
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("name, profile_image")
            .eq("id", msg.sender_id)
            .maybeSingle();

          // Get reply message if exists
          let replyData = undefined;
          if (msg.reply_to_id) {
            const { data: replyMsg } = await supabase
              .from("messages")
              .select("original_text, sender_id")
              .eq("id", msg.reply_to_id)
              .maybeSingle();
            
            if (replyMsg) {
              const { data: replySender } = await supabase
                .from("profiles")
                .select("name")
                .eq("id", replyMsg.sender_id)
                .maybeSingle();
              
              replyData = {
                sender_name: replySender?.name,
                original_text: replyMsg.original_text
              };
            }
          }

          // Get translation
          const { data: translation } = await supabase
            .from("message_translations")
            .select("translated_text, target_language")
            .eq("message_id", msg.id)
            .eq("user_id", user.id)
            .maybeSingle();

          // Get reactions
          const { data: reactions } = await supabase
            .from("message_reactions")
            .select("reaction, user_id")
            .eq("message_id", msg.id);

          // Get user names for reactions
          const reactionsWithNames = await Promise.all(
            (reactions || []).map(async (r) => {
              const { data: profile } = await supabase
                .from("profiles")
                .select("name")
                .eq("id", r.user_id)
                .maybeSingle();
              
              return {
                reaction: r.reaction,
                user_id: r.user_id,
                user_name: profile?.name,
                count: 1
              };
            })
          );

          // Check if message is read (for sent messages)
          let isRead = false;
          if (msg.sender_id === user.id) {
            const { data: readReceipts } = await supabase
              .from("message_read_receipts")
              .select("id")
              .eq("message_id", msg.id)
              .neq("user_id", user.id);
            isRead = (readReceipts?.length || 0) > 0;
          } else {
            // Mark as read if not own message
            await supabase
              .from("message_read_receipts")
              .upsert({
                message_id: msg.id,
                user_id: user.id,
              }, {
                onConflict: "message_id,user_id",
              });
          }

          return {
            ...msg,
            sender_name: senderProfile?.name,
            sender_image: senderProfile?.profile_image,
            translated_text: translation?.translated_text,
            target_language: translation?.target_language,
            reactions: reactionsWithNames,
            reply_to: replyData,
            is_read: isRead,
          };
        })
      );

      setMessages(messagesWithData);
    } catch (error: any) {
      toast({
        title: "Error loading messages",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !currentUser) return;

    setLoading(true);
    try {
      // Call edge function to send message with translation
      const { data, error } = await supabase.functions.invoke("translate-message", {
        body: {
          chatId,
          message: newMessage,
          sourceLanguage: currentUser.preferred_language,
          replyToId: replyingTo?.id,
        },
      });

      if (error) throw error;

      setNewMessage("");
      setReplyingTo(null);
    } catch (error: any) {
      toast({
        title: "Error sending message",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReaction = async (messageId: string, reaction: string) => {
    if (!currentUser) return;
    
    try {
      // Check if user already reacted with this emoji
      const { data: existing } = await supabase
        .from("message_reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("user_id", currentUser.id)
        .eq("reaction", reaction)
        .single();

      if (existing) {
        // Remove reaction
        await supabase
          .from("message_reactions")
          .delete()
          .eq("id", existing.id);
      } else {
        // Add reaction
        await supabase
          .from("message_reactions")
          .insert({
            message_id: messageId,
            user_id: currentUser.id,
            reaction,
          });
      }
      
      // Reload messages to show updated reactions
      await loadMessages();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const getChatName = () => {
    if (!chatInfo) return "";
    if (chatInfo.name) return chatInfo.name;

    const otherParticipants = chatInfo.chat_participants?.filter(
      (p: any) => p.user_id !== currentUser?.id
    );

    if (otherParticipants?.length === 1) {
      return otherParticipants[0].profiles?.name || "User";
    }
    return `${otherParticipants?.[0]?.profiles?.name || "User"} and ${otherParticipants.length - 1} others`;
  };

  return (
    <div className="h-dvh flex flex-col bg-background overflow-hidden">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border px-3 py-2 flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/chats")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <Avatar className="w-8 h-8">
          <AvatarImage src={chatInfo?.chat_participants?.[0]?.profiles?.profile_image} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">
            {getChatName()[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">{getChatName()}</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Globe className="w-3 h-3" />
            Auto-translating
          </p>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-3 space-y-3 overscroll-contain">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.sender_id === currentUser?.id}
            currentUserId={currentUser?.id}
            showOriginal={showOriginal[message.id] || false}
            onToggleOriginal={() =>
              setShowOriginal((prev) => ({
                ...prev,
                [message.id]: !prev[message.id],
              }))
            }
            onReaction={(reaction) => handleReaction(message.id, reaction)}
            onReply={() => setReplyingTo(message)}
          />
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Input - iMessage Style */}
      <footer className="sticky bottom-0 z-10 bg-card border-t border-border shrink-0 pb-safe">
        <ReplyPreview 
          replyingTo={replyingTo} 
          onCancel={() => setReplyingTo(null)} 
        />
        <div className="p-2">
          <form onSubmit={sendMessage} className="flex items-end gap-2">
            <div className="flex-1 relative flex items-center bg-secondary/50 rounded-[20px] border border-border/50 px-3 py-2 min-h-[36px]">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="iMessage"
                disabled={loading}
                className="flex-1 bg-transparent border-none outline-none text-[15px] placeholder:text-muted-foreground/60 py-1"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !newMessage.trim()}
              className={`w-[32px] h-[32px] rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                newMessage.trim() && !loading
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                  : 'bg-secondary/50 text-muted-foreground cursor-not-allowed'
              }`}
            >
              <Send className="w-[16px] h-[16px]" />
            </button>
          </form>
        </div>
      </footer>
    </div>
  );
};

export default Chat;