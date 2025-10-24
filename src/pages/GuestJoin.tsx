import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MessageSquare } from "lucide-react";

export default function GuestJoin() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [lang, setLang] = useState("en");
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    if (!name.trim()) {
      toast.error("Please enter your name");
      return;
    }

    if (!token) {
      toast.error("Invalid invite link");
      return;
    }

    setLoading(true);
    
    try {
      console.log("Accepting guest invite with token:", token);

      const { data, error } = await supabase.functions.invoke("accept-qr-invite", {
        body: { token, name: name.trim(), preferredLanguage: lang },
      });

      if (error) {
        console.error("Error accepting invite:", error);
        toast.error(error.message || "Failed to join chat");
        setLoading(false);
        return;
      }

      if (!data?.guestJwt || !data?.chatId) {
        console.error("Invalid response from accept-qr-invite");
        toast.error("Failed to join chat");
        setLoading(false);
        return;
      }

      console.log("Guest invite accepted, chat ID:", data.chatId);

      // Store guest session data
      sessionStorage.setItem("guestJwt", data.guestJwt);
      sessionStorage.setItem("guestChatId", data.chatId);
      sessionStorage.setItem("guestName", name.trim());
      sessionStorage.setItem("guestLang", lang);

      toast.success("Joining chat...");

      // Navigate to guest chat
      navigate(`/guest-chat/${data.chatId}`);
    } catch (err) {
      console.error("Unexpected error joining chat:", err);
      toast.error("An error occurred while joining");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-background to-muted/20">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-6 h-6 text-primary" />
          </div>
          <CardTitle>Join Guest Chat</CardTitle>
          <CardDescription>
            Enter your details to start a temporary chat session
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="guest-name">Your Name</Label>
            <Input
              id="guest-name"
              placeholder="Enter your name"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={loading}
              maxLength={50}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim() && !loading) {
                  handleStart();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="guest-lang">Preferred Language</Label>
            <Select value={lang} onValueChange={setLang} disabled={loading}>
              <SelectTrigger id="guest-lang">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
                <SelectItem value="it">Italiano</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
                <SelectItem value="uk">Українська</SelectItem>
                <SelectItem value="ru">Русский</SelectItem>
                <SelectItem value="zh">中文</SelectItem>
                <SelectItem value="ja">日本語</SelectItem>
                <SelectItem value="ko">한국어</SelectItem>
                <SelectItem value="ar">العربية</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            className="w-full" 
            disabled={!name.trim() || loading} 
            onClick={handleStart}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Starting...
              </>
            ) : (
              "Start Chat"
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center pt-2">
            This chat is temporary and will be automatically deleted after the session ends.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
