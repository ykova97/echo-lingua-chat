import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Reaction {
  reaction: string;
  user_id: string;
  user_name?: string;
  count: number;
}

interface MessageReactionsProps {
  reactions: Reaction[];
  currentUserId: string;
  onReactionClick: (reaction: string) => void;
}

export const MessageReactions = ({ reactions, currentUserId, onReactionClick }: MessageReactionsProps) => {
  if (!reactions || reactions.length === 0) return null;

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, r) => {
    const existing = acc.find(item => item.reaction === r.reaction);
    if (existing) {
      existing.count += 1;
      existing.users.push({ id: r.user_id, name: r.user_name });
    } else {
      acc.push({
        reaction: r.reaction,
        count: 1,
        users: [{ id: r.user_id, name: r.user_name }],
        hasCurrentUser: r.user_id === currentUserId
      });
    }
    return acc;
  }, [] as Array<{ reaction: string; count: number; users: Array<{ id: string; name?: string }>; hasCurrentUser: boolean }>);

  return (
    <TooltipProvider>
      <div className="flex flex-wrap gap-1 mt-1">
        {groupedReactions.map(({ reaction, count, users, hasCurrentUser }) => (
          <Tooltip key={reaction}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onReactionClick(reaction)}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all hover:scale-110 ${
                  hasCurrentUser
                    ? 'bg-primary/20 border border-primary/40'
                    : 'bg-secondary/50 border border-border/50'
                }`}
              >
                <span>{reaction}</span>
                {count > 1 && <span className="text-muted-foreground">{count}</span>}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                {users.map((u) => (
                  <div key={u.id}>{u.name || 'User'}</div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
};