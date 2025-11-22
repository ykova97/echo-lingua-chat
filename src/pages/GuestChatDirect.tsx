import { useParams } from "react-router-dom";

export default function GuestChatDirect() {
  const { token } = useParams<{ token: string }>();
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Guest Chat</h1>
        <p className="text-muted-foreground">Token: {token}</p>
        <div className="w-64 h-64 bg-primary/10 rounded-lg flex items-center justify-center">
          <p className="text-primary">Step 1: Basic render works!</p>
        </div>
      </div>
    </div>
  );
}
