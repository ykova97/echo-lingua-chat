import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const LANGS = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "uk", label: "Ukrainian" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PUBLIC_APP_URL = window.location.origin;

export default function GuestJoin() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [lang, setLang] = useState("en");
  const [loading, setLoading] = useState(false);

  const start = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Please enter your name.", variant: "destructive" });
      return;
    }
    if (!token) {
      toast({ title: "Invalid invite", description: "Missing invite token.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      console.log("Calling accept-qr-invite with:", { token, name: name.trim(), preferredLanguage: lang, baseUrl: SUPABASE_URL });
      
      const res = await fetch(`${SUPABASE_URL}/functions/v1/accept-qr-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          preferredLanguage: lang,
          baseUrl: PUBLIC_APP_URL,
        }),
      });

      console.log("Response status:", res.status);
      
      if (!res.ok) {
        const t = await res.text();
        console.error("accept-qr-invite failed:", { status: res.status, body: t });
        throw new Error(`accept-qr-invite failed (${res.status}): ${t}`);
      }

      const data = await res.json();
      console.log("Response data:", data);
      
      if (!data?.guestJwt || !data?.chatId) {
        throw new Error("Missing guestJwt or chatId");
      }

      sessionStorage.setItem("guestJwt", data.guestJwt);
      sessionStorage.setItem("guestChatId", data.chatId);
      sessionStorage.setItem("guestName", name.trim());

      navigate(`/guest-chat/${data.chatId}`);
    } catch (err: any) {
      console.error("Full error:", err);
      toast({
        title: "Couldn't start guest chat",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold">Start a quick chat</h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm space-y-4">
          <div className="text-sm text-muted-foreground">
            No app required. Tell us your name and preferred language. This chat auto-deletes later.
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Your name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Alex" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Preferred language</label>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger>
                <SelectValue placeholder="Select a language" />
              </SelectTrigger>
              <SelectContent>
                {LANGS.map((l) => (
                  <SelectItem key={l.code} value={l.code}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full" disabled={loading || !name.trim()} onClick={start}>
            {loading ? "Starting…" : "Start chat"}
          </Button>
          <p className="text-[12px] text-muted-foreground text-center">
            Your chat will be temporary and may be deleted automatically.
          </p>
        </div>
      </main>
    </div>
  );
}
