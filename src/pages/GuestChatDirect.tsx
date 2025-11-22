import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { createGuestSession } from "@/lib/createGuestSession";

export default function GuestChatDirect() {
  const { token } = useParams<{ token: string }>();
  const [conversationId, setConversationId] = useState<string>("");
  const [guestId, setGuestId] = useState<string>("");
  const [guestJwt, setGuestJwt] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("No token provided");
      setLoading(false);
      return;
    }

    const init = async () => {
      try {
        const result = await createGuestSession({ token });
        
        if ('error' in result) {
          setError(result.error === 'invalid_or_expired' 
            ? "This link has expired. Ask them to show a new QR." 
            : String(result.error));
          setLoading(false);
          return;
        }

        setConversationId(result.conversation_id);
        setGuestId(result.guest_id);
        setGuestJwt(result.guest_jwt);
        setLoading(false);
      } catch (err: any) {
        setError(err?.message || "Failed to join chat");
        setLoading(false);
      }
    };

    init();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p className="text-muted-foreground">Connecting...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center max-w-md p-6">
          <p className="text-lg text-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Connected!</h1>
        <div className="w-64 p-4 bg-primary/10 rounded-lg">
          <p className="text-sm text-muted-foreground">Step 2: Session initialized</p>
          <p className="text-xs text-muted-foreground mt-2">Chat ID: {conversationId.slice(0, 8)}...</p>
        </div>
      </div>
    </div>
  );
}
