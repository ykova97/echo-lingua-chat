import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createGuestSession } from "@/lib/createGuestSession";
import { useNavigate } from "react-router-dom";

/**
 * Example page demonstrating how to use the create-guest-session-from-token endpoint
 * This page can be accessed by anyone (no authentication required)
 */
export default function GuestSessionTest() {
  const [token, setToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ conversation_id: string; guest_id: string } | null>(null);
  const navigate = useNavigate();

  const handleCreateSession = async () => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const result = await createGuestSession({
        token: token.trim(),
        display_name: displayName.trim() || undefined,
      });

      setSuccess(result);
      
      // Optionally navigate to the guest chat
      // navigate(`/guest-chat/${result.conversation_id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create guest session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join as Guest</CardTitle>
          <CardDescription>
            Enter your share token to join the conversation
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="token">Share Token</Label>
            <Input
              id="token"
              placeholder="Enter your share token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Display Name (optional)</Label>
            <Input
              id="displayName"
              placeholder="What should we call you?"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loading}
              maxLength={100}
            />
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <AlertDescription className="space-y-2">
                <p className="font-medium">Guest session created successfully!</p>
                <p className="text-sm">Conversation ID: {success.conversation_id}</p>
                <p className="text-sm">Guest ID: {success.guest_id}</p>
              </AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full"
            onClick={handleCreateSession}
            disabled={loading || !token.trim()}
          >
            {loading ? "Creating session..." : "Join Conversation"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By joining, you agree to our terms. Sessions expire after 24 hours.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
