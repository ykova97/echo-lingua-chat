import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MessageBubble from "@/components/chat/MessageBubble";
import { ScrollArea } from "@/components/ui/scroll-area";

const PAGE_SIZE = 30;

interface Message {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_image?: string;
  original_text: string;
  translated_text?: string;
  source_language: string;
  created_at: string;
  reply_to_id?: string;
}

const Chat = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showOriginalMap, setShowOriginalMap] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    fetchUser();
  }, []);

  async function loadMessagesPage(before?: string) {
    if (!chatId) return { messages: [], nextCursor: null };
    
    let query = supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(PAGE_SIZE);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data: msgs, error } = await query;
    if (error) throw error;
    if (!msgs || msgs.length === 0) return { messages: [], nextCursor: null };

    const senderIds = Array
