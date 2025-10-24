import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";

const LANGS = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "uk", label: "Ukrainian" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "ru", label: "Russian" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
  { code: "ja", label: "Japanese" },
];

export default function GuestJoin() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [lang, setLang] = useState("en");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleStart = async () => {
    setErrorMsg("");
    if (!name.trim()) {
      setErrorMsg("Please enter your name.");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("accept-qr-invite", {
      body: { token, name: name.trim(), preferredLanguage: lang },
    });
    setLoading(false);

    if (error) {
      setErrorMsg(error.message || "Could not start a guest chat.");
      return;
    }

    const guestJwt = data.guestJwt as string;
    const chatId = data.chatId as string;
    sessionStorage.setItem("guestJwt", guestJwt);
    sessionStorage.setItem("guestChatId", chatId);

    navigate(`/guest-chat/${chatId}`);
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
            No app required. Tell us your name and preferred language.
            This temporary chat will be auto-deleted after you're done.
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Your name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Alex"
              autoComplete="name"
              inputMode="text"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Preferred language</label>
            <Select value={lang} onValueChange={setLang}>
              <SelectTrigger>
                <SelectValue placeholder="Select a language" />
              </SelectTrigger>
              <SelectContent>
                {LANGS.map((l) => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {errorMsg && (
            <div className="text-sm text-destructive">{errorMsg}</div>
          )}

          <Button className="w-full" disabled={loading || !name.trim()} onClick={handleStart}>
            {loading ? "Starting…" : "Start chat"}
          </Button>

          <p className="text-[12px] text-muted-foreground text-center">
            We'll match your language automatically in the conversation.
          </p>
        </div>
      </main>
    </div>
  );
}
