import { useParams } from "react-router-dom";

export default function GuestChatDirect() {
  const { token } = useParams<{ token: string }>();
  
  console.log("🔴🔴🔴 GUEST CHAT MOUNTED - TOKEN:", token);
  
  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">Guest Chat Test</h1>
        <p className="text-muted-foreground">Token: {token || "No token"}</p>
        <p className="text-sm text-green-600 mt-2">Component is loading!</p>
      </div>
    </div>
  );
}
