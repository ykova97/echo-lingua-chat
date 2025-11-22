import { useParams } from "react-router-dom";

console.log("🟢 Module loaded");

export default function GuestChatDirect() {
  const { token } = useParams<{ token: string }>();
  
  console.log("🔵 Component rendering, token:", token);
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">Guest Chat Direct</h1>
        <p className="text-muted-foreground">Token: {token || "No token"}</p>
        <div className="w-64 h-64 bg-primary/10 rounded-lg flex items-center justify-center">
          <p className="text-primary">This is rendering!</p>
        </div>
      </div>
    </div>
  );
}
