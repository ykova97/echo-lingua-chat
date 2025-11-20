import { useEffect, useRef, useState } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  threshold?: number;
  disabled?: boolean;
}

export const usePullToRefresh = ({
  onRefresh,
  threshold = 80,
  disabled = false,
}: UsePullToRefreshOptions) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) return;

    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    let rafId: number | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      if (scrollContainer.scrollTop === 0 && !isRefreshing) {
        startY.current = e.touches[0].clientY;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isRefreshing || scrollContainer.scrollTop > 0) return;

      currentY.current = e.touches[0].clientY;
      const deltaY = currentY.current - startY.current;

      if (deltaY > 0) {
        // Prevent default scrolling behavior when pulling down
        e.preventDefault();
        
        // Apply rubber band effect - the further you pull, the less it moves
        const distance = Math.min(deltaY * 0.5, threshold * 1.5);
        
        if (rafId) {
          cancelAnimationFrame(rafId);
        }
        
        rafId = requestAnimationFrame(() => {
          setPullDistance(distance);
        });
      }
    };

    const handleTouchEnd = async () => {
      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true);
        setPullDistance(threshold);
        
        try {
          await onRefresh();
        } finally {
          setIsRefreshing(false);
          setPullDistance(0);
        }
      } else {
        setPullDistance(0);
      }
      
      startY.current = 0;
      currentY.current = 0;
    };

    scrollContainer.addEventListener("touchstart", handleTouchStart, { passive: true });
    scrollContainer.addEventListener("touchmove", handleTouchMove, { passive: false });
    scrollContainer.addEventListener("touchend", handleTouchEnd);

    return () => {
      scrollContainer.removeEventListener("touchstart", handleTouchStart);
      scrollContainer.removeEventListener("touchmove", handleTouchMove);
      scrollContainer.removeEventListener("touchend", handleTouchEnd);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [disabled, isRefreshing, onRefresh, pullDistance, threshold]);

  const progress = Math.min(pullDistance / threshold, 1);

  return {
    scrollContainerRef,
    pullDistance,
    isRefreshing,
    progress,
  };
};
