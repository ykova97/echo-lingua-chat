import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MessageBubble from "@/components/chat/MessageBubble";

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
  reply_to_id?: string;
  reply_to_text?: string;
  reply_to_sender?: string;
  edited_at?: string;
  is_deleted?: boolean;
  reactions?: Array<{ reaction: string; user_id: string; user_name?: string; count: number }>;
  read_by?: number;
  total_participants?: number;
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

      // Get messages with reply info
      const { data: msgs, error } = await supabase
        .from("messages")
        .select(`
          *,
          profiles:sender_id (
            name,
            profile_image
          ),
          reply_to:reply_to_id (
            original_text,
            sender_id,
            profiles:sender_id (
              name
            )
          )
        `)
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Get translations and reactions for each message
      const messagesWithData = await Promise.all(
        (msgs || []).map(async (msg: any) => {
          // Get translation
          const { data: translation } = await supabase
            .from("message_translations")
            .select("translated_text, target_language")
            .eq("message_id", msg.id)
            .eq("user_id", user.id)
            .single();

          // Get reactions
          const { data: reactions } = await supabase
            .from("message_reactions")
            .select(`
              reaction,
              user_id,
              profiles:user_id (
                name
              )
            `)
            .eq("message_id", msg.id);

          // Format reactions
          const formattedReactions = reactions?.map(r => ({
            reaction: r.reaction,
            user_id: r.user_id,
            user_name: (r.profiles as any)?.name,
            count: 1
          })) || [];

          return {
            ...msg,
            sender_name: msg.profiles?.name,
            sender_image: msg.profiles?.profile_image,
            translated_text: translation?.translated_text,
            target_language: translation?.target_language,
            reply_to_text: msg.reply_to?.original_text,
            reply_to_sender: msg.reply_to?.profiles?.name,
            reactions: formattedReactions,
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

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from("messages")
        .update({ is_deleted: true })
        .eq("id", messageId);

      if (error) throw error;
      
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
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/chats")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar className="w-10 h-10">
          <AvatarImage src={chatInfo?.chat_participants?.[0]?.profiles?.profile_image} />
          <AvatarFallback className="bg-primary/10 text-primary">
            {getChatName()[0]}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h2 className="font-semibold">{getChatName()}</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Globe className="w-3 h-3" />
            Auto-translating
          </p>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
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
            onReply={() => setReplyingTo(message)}
            onReaction={(reaction) => handleReaction(message.id, reaction)}
            onDelete={() => handleDeleteMessage(message.id)}
          />
        ))}
        <div ref={messagesEndRef} />
      </main>

      {/* Input - iMessage Style */}
      <footer className="bg-card border-t border-border p-3 safe-area-bottom">
        {replyingTo && (
          <div className="max-w-4xl mx-auto mb-2 flex items-center gap-2 px-4 py-2 bg-secondary/50 rounded-xl border border-border/50">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Replying to {replyingTo.sender_name}</p>
              <p className="text-sm line-clamp-1">{replyingTo.original_text}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReplyingTo(null)}
              className="h-6 w-6 p-0"
            >
              ✕
            </Button>
          </div>
        )}
        <form onSubmit={sendMessage} className="flex items-end gap-2 max-w-4xl mx-auto">
          <div className="flex-1 relative flex items-center bg-secondary/50 rounded-[24px] border border-border/50 px-4 py-2 min-h-[40px]">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="iMessage"
              disabled={loading}
              className="flex-1 bg-transparent border-none outline-none text-[15px] placeholder:text-muted-foreground/60"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !newMessage.trim()}
            className={`w-[36px] h-[36px] rounded-full flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
              newMessage.trim() && !loading
                ? 'bg-primary hover:bg-primary/90 text-primary-foreground'
                : 'bg-secondary/50 text-muted-foreground cursor-not-allowed'
            }`}
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </form>
      </footer>
    </div>
  );
};

export default Chat;