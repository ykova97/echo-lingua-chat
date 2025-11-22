import { Skeleton } from "@/components/ui/skeleton";

export const ChatListSkeleton = () => {
  return (
    <div className="space-y-3 px-4">
      {[...Array(20)].map((_, i) => (
        <div 
          key={i} 
          className="card-soft p-4 flex items-center gap-4 animate-fade-in"
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          {/* Avatar skeleton */}
          <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
          
          <div className="flex-1 min-w-0 space-y-2">
            {/* Name skeleton */}
            <Skeleton className="h-5 w-32" />
            
            {/* Message preview skeleton */}
            <Skeleton className="h-4 w-full max-w-xs" />
          </div>
          
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            {/* Time skeleton */}
            <Skeleton className="h-3 w-12" />
            
            {/* Unread badge skeleton - show on some items */}
            {i % 3 === 0 && (
              <Skeleton className="h-5 w-5 rounded-full" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
