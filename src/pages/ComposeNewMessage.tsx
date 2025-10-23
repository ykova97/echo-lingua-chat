import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RecipientInput } from "@/components/compose/RecipientInput";
import { ContactSuggestions } from "@/components/compose/ContactSuggestions";
import { MessageComposer } from "@/components/compose/MessageComposer";
import { Recipient } from "@/types/recipient";
import { useToast } from "@/hooks/use-toast";

const ComposeNewMessage = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [toFieldText, setToFieldText] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (toFieldText.trim()) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      searchTimeoutRef.current = setTimeout(() => {
        searchContacts(toFieldText);
      }, 150);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [toFieldText]);

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

    setCurrentUser(profile);
  };

  const searchContacts = async (query: string) => {
    if (!query.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("*")
      .or(`name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(10);

    setSuggestions(profiles || []);
    setShowSuggestions(true);
  };

  const addRecipient = async (contact: any) => {
    const recipient: Recipient = {
      id: contact.id,
      contact_id: contact.id,
      display_name: contact.name,
      address_type: "phone",
      address_value: contact.phone || "",
      is_valid: true,
      is_link_user: true,
      avatar_url: contact.profile_image,
    };

    // Check for duplicates
    if (!recipients.find(r => r.contact_id === recipient.contact_id)) {
      setRecipients([...recipients, recipient]);
      setToFieldText("");
      setSuggestions([]);
      setShowSuggestions(false);
      
      // Light haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(10);
      }
    }
  };

  const removeRecipient = (recipientId: string) => {
    setRecipients(recipients.filter(r => r.id !== recipientId));
    
    // Light haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const handleCancel = () => {
    navigate("/chats");
  };

  const handleCreateChat = async (message: string) => {
    if (recipients.length === 0) return;

    try {
      console.log("Starting chat creation with recipients:", recipients);
      
      // Create or find existing chat
      const participantIds = [currentUser.id, ...recipients.map(r => r.contact_id)];
      console.log("Participant IDs:", participantIds);
      
      // Check for existing chat with same participants
      const { data: existingChats, error: fetchError } = await supabase
        .from("chats")
        .select(`
          *,
          chat_participants!inner(user_id)
        `);

      if (fetchError) {
        console.error("Error fetching chats:", fetchError);
        throw fetchError;
      }

      let chatId = null;

      // Find chat with exact same participants
      const matchingChat = existingChats?.find(chat => {
        const chatParticipants = chat.chat_participants.map((p: any) => p.user_id).sort();
        return chatParticipants.length === participantIds.length &&
          chatParticipants.every((id: string, i: number) => id === participantIds.sort()[i]);
      });

      if (matchingChat) {
        console.log("Found existing chat:", matchingChat.id);
        chatId = matchingChat.id;
      } else {
        console.log("Creating new chat...");
        // Create new chat
        const { data: newChat, error: chatError } = await supabase
          .from("chats")
          .insert({
            type: participantIds.length > 2 ? "group" : "direct",
            name: participantIds.length > 2 ? recipients.map(r => r.display_name).join(", ") : null,
            created_by: currentUser.id,
          })
          .select()
          .single();

        if (chatError) {
          console.error("Error creating chat:", chatError);
          throw chatError;
        }
        
        console.log("Chat created:", newChat);
        chatId = newChat.id;

        // Add participants
        console.log("Adding participants...");
        const participantInserts = participantIds.map(userId => ({
          chat_id: chatId,
          user_id: userId,
        }));

        const { error: participantError } = await supabase
          .from("chat_participants")
          .insert(participantInserts);

        if (participantError) {
          console.error("Error adding participants:", participantError);
          throw participantError;
        }
        console.log("Participants added successfully");
      }

      // Send initial message if provided
      if (message.trim() && chatId) {
        console.log("Sending initial message...");
        const { error: messageError } = await supabase
          .from("messages")
          .insert({
            chat_id: chatId,
            sender_id: currentUser.id,
            original_text: message,
            source_language: currentUser.preferred_language || "en",
          });

        if (messageError) {
          console.error("Error sending message:", messageError);
          throw messageError;
        }
        console.log("Message sent successfully");
      }

      // Navigate to chat
      console.log("Navigating to chat:", chatId);
      navigate(`/chat/${chatId}`);
    } catch (error: any) {
      console.error("Error creating chat:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create chat. Please try again.",
        variant: "destructive",
      });
    }
  };

  const hasValidRecipients = recipients.length > 0 && recipients.every(r => r.is_valid);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Navigation Bar */}
      <div className="flex items-center justify-between h-[44px] px-4 border-b border-border/40 safe-area-inset-top">
        <Button
          variant="ghost"
          onClick={handleCancel}
          className="text-primary hover:bg-transparent p-0 h-auto font-normal"
        >
          Cancel
        </Button>
        <h1 className="text-[17px] font-medium">New Message</h1>
        <div className="w-[60px]" /> {/* Spacer for centering */}
      </div>

      {/* Recipient Input Row */}
      <div className="border-b border-border/40">
        <RecipientInput
          recipients={recipients}
          toFieldText={toFieldText}
          onToFieldTextChange={setToFieldText}
          onRemoveRecipient={removeRecipient}
          onFocus={() => setShowSuggestions(toFieldText.length > 0)}
        />
      </div>

      {/* Search Results */}
      {showSuggestions && suggestions.length > 0 && (
        <ContactSuggestions
          suggestions={suggestions}
          onSelectContact={addRecipient}
        />
      )}

      {/* Empty State */}
      {!showSuggestions && recipients.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-[15px] px-6 text-center">
          Enter a name or email to start a conversation
        </div>
      )}

      {/* Message Composer - Only shown when recipients exist */}
      {hasValidRecipients && (
        <MessageComposer onSend={handleCreateChat} />
      )}
    </div>
  );
};

export default ComposeNewMessage;
