import { useState, KeyboardEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface MessageComposerProps {
  onSend: (message: string, attachmentUrl?: string, attachmentType?: string) => void;
  disabled?: boolean;
}

export const MessageComposer = ({ onSend, disabled }: MessageComposerProps) => {
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 10MB",
        variant: "destructive",
      });
      return;
    }

    setAttachment(file);
  };

  const handleSend = async () => {
    if ((!message.trim() && !attachment) || uploading) return;

    let attachmentUrl: string | undefined;
    let attachmentType: string | undefined;

    if (attachment) {
      setUploading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) {
          toast({
            title: "Error",
            description: "You must be logged in to upload files",
            variant: "destructive",
          });
          return;
        }

        const fileExt = attachment.name.split('.').pop();
        const fileName = `${session.user.id}/${Date.now()}.${fileExt}`;

        const { data, error } = await supabase.storage
          .from('chat-attachments')
          .upload(fileName, attachment);

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(data.path);

        attachmentUrl = publicUrl;
        attachmentType = attachment.type;
      } catch (error: any) {
        toast({
          title: "Upload failed",
          description: error.message,
          variant: "destructive",
        });
        setUploading(false);
        return;
      } finally {
        setUploading(false);
      }
    }

    onSend(message, attachmentUrl, attachmentType);
    setMessage("");
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-3">
      {attachment && (
        <div className="mb-2 flex items-center gap-2 p-2 bg-secondary/50 rounded-lg">
          <Paperclip className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm flex-1 truncate">{attachment.name}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => {
              setAttachment(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      
      <div className="flex items-end gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || uploading}
          className="h-9 w-9 rounded-full shrink-0"
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        
        <Textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message"
          disabled={disabled || uploading}
          className="flex-1 min-h-[36px] max-h-[120px] resize-none text-[15px] rounded-[20px] border-border/40"
          rows={1}
        />
        
        <Button
          onClick={handleSend}
          disabled={disabled || uploading || (!message.trim() && !attachment)}
          size="icon"
          className="h-9 w-9 rounded-full shrink-0"
        >
          {uploading ? (
            <div className="h-4 w-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
};
