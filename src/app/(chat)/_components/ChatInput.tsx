"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";

type ChatInputProps = {
  readonly onSend: (content: string) => void;
};

const MAX_TEXTAREA_HEIGHT = 200;

export function ChatInput({ onSend }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }
    onSend(trimmed);
    setValue("");
  }, [value, onSend]);

  const handleSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      submit();
    },
    [submit],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        submit();
      }
    },
    [submit],
  );

  useLayoutEffect(() => {
    const node = textareaRef.current;
    if (!node) {
      return;
    }
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [value]);

  const isEmpty = value.trim().length === 0;

  return (
    <div className="border-t border-white/10 bg-[#0b0f19]/90 px-4 py-4 backdrop-blur md:px-6">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex w-full max-w-3xl items-end gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-2 shadow-[0_10px_40px_rgba(2,6,23,0.45)] focus-within:border-emerald-400/50 focus-within:ring-2 focus-within:ring-emerald-400/20"
      >
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Send a message..."
          className="flex-1 resize-none bg-transparent px-2 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
          aria-label="Message"
        />
        <button
          type="submit"
          disabled={isEmpty}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/30 disabled:text-white/60"
          aria-label="Send message"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden="true"
          >
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </button>
      </form>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-slate-500">
        Enter to send • Shift + Enter for a new line
      </p>
    </div>
  );
}
