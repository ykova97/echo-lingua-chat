import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const BASE = `${SUPABASE_URL}/functions/v1`;
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

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

    if (!recipients.find((r) => r.contact_id === recipient.contact_id)) {
      setRecipients([...recipients, recipient]);
      setToFieldText("");
      setSuggestions([]);
      setShowSuggestions(false);
      if (navigator.vibrate) navigator.vibrate(10);
    }
  };

  const removeRecipient = (recipientId: string) => {
    setRecipients(recipients.filter((r) => r.id !== recipientId));
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const handleCancel = () => {
    navigate("/chats");
  };

  // === NEW OPTIMIZED CHAT CREATION ===
  const handleCreateChat = async (message: string) => {
    if (recipients.length === 0) return;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        toast({
          title: "Authentication Error",
          description: "Please sign in again.",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }

      if (!currentUser) {
        toast({
          title: "Error",
          description: "User profile not loaded. Please refresh the page.",
          variant: "destructive",
        });
        return;
      }

      // Build participant set (must include current user)
      const participantIds = Array.from(new Set([user.id, ...recipients.map((r) => r.contact_id)]));

      // Use RPC to find or create chat
      const { data: chatId, error: rpcError } = await supabase.rpc("find_or_create_chat", {
        participant_ids: participantIds,
      });

      if (rpcError || !chatId) {
        console.error("find_or_create_chat error:", rpcError);
        toast({
          title: "Error",
          description: "Could not create or find the chat.",
          variant: "destructive",
        });
        return;
      }

      // Optional: client-side auto name for groups
      if (participantIds.length > 2) {
        const { data: profs, error: profErr } = await supabase
          .from("profiles")
          .select("id, name")
          .in("id", participantIds);

        if (!profErr) {
          const groupName = (profs || [])
            .map((p) => p?.name?.trim())
            .filter(Boolean)
            .slice(0, 5)
            .join(", ");
          if (groupName) {
            await supabase.from("chats").update({ name: groupName }).eq("id", chatId).is("name", null);
          }
        }
      }

      // Send initial message via Edge Function
      if (message.trim()) {
        const res = await fetch(`${BASE}/translate-message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatId,
            message,
            sourceLanguage: currentUser.preferred_language || "auto",
            replyToId: null,
            attachmentUrl: null,
            attachmentType: null,
          })
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("Message send error:", errorText);
          toast({
            title: "Message not sent",
            description: "Chat created but sending failed. Try again.",
            variant: "destructive",
          });
        }
      }

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

  const hasValidRecipients = recipients.length > 0 && recipients.every((r) => r.is_valid);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top Navigation */}
      <div className="flex items-center justify-between h-[44px] px-4 border-b border-border/40 safe-area-inset-top">
        <Button
          variant="ghost"
          onClick={handleCancel}
          className="text-primary hover:bg-transparent p-0 h-auto font-normal"
        >
          Cancel
        </Button>
        <h1 className="text-[17px] font-medium">New Message</h1>
        <div className="w-[60px]" />
      </div>

      {/* Recipient input */}
      <div className="border-b border-border/40">
        <RecipientInput
          recipients={recipients}
          toFieldText={toFieldText}
          onToFieldTextChange={setToFieldText}
          onRemoveRecipient={removeRecipient}
          onFocus={() => setShowSuggestions(toFieldText.length > 0)}
        />
      </div>

      {/* Search results */}
      {showSuggestions && suggestions.length > 0 && (
        <ContactSuggestions suggestions={suggestions} onSelectContact={addRecipient} />
      )}

      {/* Empty state */}
      {!showSuggestions && recipients.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-[15px] px-6 text-center">
          Enter a name, phone, or email to start a conversation
        </div>
      )}

      {/* Message composer */}
      {hasValidRecipients && <MessageComposer onSend={handleCreateChat} />}
    </div>
  );
};

export default ComposeNewMessage;
