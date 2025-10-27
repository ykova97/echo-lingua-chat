import { useEffect } from "react";

/**
 * Sets the CSS var --kb-offset to the difference between
 * layout viewport and visual viewport when the iOS keyboard is open.
 * Apply the .kb-safe class to your footer to lift it above the keyboard.
 */
export function useKeyboardInset() {
  useEffect(() => {
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;

    const setOffset = () => {
      // When the keyboard shows, visualViewport.height shrinks and
      // visualViewport.offsetTop/Left may change.
      const bottomInset =
        Math.max(0, (window.innerHeight - (vv.height + vv.offsetTop))) || 0;
      document.documentElement.style.setProperty("--kb-offset", `${bottomInset}px`);
    };

    setOffset();
    vv.addEventListener("resize", setOffset);
    vv.addEventListener("scroll", setOffset);
    window.addEventListener("orientationchange", setOffset);

    return () => {
      vv.removeEventListener("resize", setOffset);
      vv.removeEventListener("scroll", setOffset);
      window.removeEventListener("orientationchange", setOffset);
      document.documentElement.style.removeProperty("--kb-offset");
    };
  }, []);
}
