import React, { useRef, useState } from "react";
import { Paperclip, Mic, Send, Plus } from "lucide-react";

type Props = {
  onSend: (text: string) => void;
  onAttach?: (file: File) => void;
  onMicPress?: () => void;      // optional: voice input handler
  className?: string;           // optional extra classes
};

export default function IOSComposer({
  onSend,
  onAttach,
  onMicPress,
  className = "",
}: Props) {
  const [draft, setDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const send = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  const pickFile = () => fileRef.current?.click();

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    onAttach?.(f);
    e.target.value = ""; // allow same file again
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div
      className={[
        // sticky bottom bar + safe-area padding
        "sticky bottom-0 z-40 border-t bg-[#f2f2f7]",
        "px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-1",
        "kb-safe", // your keyboard hook lifts this
        "ios-composer-shadow",
        className,
      ].join(" ")}
    >
      <div className="mx-2 flex items-end gap-2">
        {/* Left circular "+" button */}
        <button
          onClick={pickFile}
          aria-label="Add"
          className="size-9 shrink-0 rounded-full bg-white text-gray-600 flex items-center justify-center active:bg-gray-200 border border-gray-200"
        >
          <Plus className="h-5 w-5" />
        </button>

        {/* Pill input container */}
        <div
          className={[
            "flex min-h-9 flex-1 items-center gap-2",
            "rounded-full border border-[#d1d1d6] bg-white",
            "px-4 py-2",
          ].join(" ")}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="iMessage"
            rows={1}
            className={[
              "max-h-28 w-full resize-none bg-transparent",
              "text-[16px] leading-6 outline-none",
              "placeholder:text-[#a0a0a5]",
            ].join(" ")}
            autoCorrect="on"
            autoComplete="off"
            inputMode="text"
          />
          {/* Right icon: mic when empty, send when text exists */}
          {draft.trim().length === 0 ? (
            <button
              onClick={onMicPress}
              aria-label="Dictate"
              className="ml-1 flex size-7 items-center justify-center text-gray-500"
            >
              <Mic className="h-5 w-5" />
            </button>
          ) : (
            <button
              onClick={send}
              aria-label="Send"
              className="ml-1 flex size-7 items-center justify-center text-white rounded-full bg-blue-500 active:bg-blue-600"
            >
              <Send className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
}
