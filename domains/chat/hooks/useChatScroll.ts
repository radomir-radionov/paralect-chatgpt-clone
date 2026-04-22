"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Options = {
  /**
   * If the user is within this many pixels of bottom, we consider them "at bottom"
   * and will auto-scroll on new messages.
   */
  bottomThresholdPx?: number;
};

export function useChatScroll(
  messageCount: number,
  {
    bottomThresholdPx = 80,
  }: Options = {},
) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isAtBottomRef = useRef(true);
  const prevMessageCountRef = useRef(0);

  const prevScrollHeightRef = useRef(0);
  const wasFetchingOlderRef = useRef(false);

  const [showScrollButton, setShowScrollButton] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const distFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;
    const atBottom = distFromBottom < bottomThresholdPx;

    isAtBottomRef.current = atBottom;
    setShowScrollButton(!atBottom);
  }, [bottomThresholdPx]);

  // Initial scroll to bottom once messages appear.
  useEffect(() => {
    if (prevMessageCountRef.current === 0 && messageCount > 0) {
      scrollToBottom("instant");
      prevMessageCountRef.current = messageCount;
    }
  }, [messageCount, scrollToBottom]);

  // Auto-scroll when new messages arrive (only if user is at bottom).
  useEffect(() => {
    if (messageCount > prevMessageCountRef.current && prevMessageCountRef.current > 0) {
      if (isAtBottomRef.current) {
        scrollToBottom("smooth");
      }
    }
    prevMessageCountRef.current = messageCount;
  }, [messageCount, scrollToBottom]);

  const startPreserveScrollOnOlderLoad = useCallback(() => {
    const container = scrollContainerRef.current;
    prevScrollHeightRef.current = container?.scrollHeight ?? 0;
    wasFetchingOlderRef.current = true;
  }, []);

  const finishPreserveScrollOnOlderLoad = useCallback(() => {
    if (!wasFetchingOlderRef.current) return;
    wasFetchingOlderRef.current = false;

    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollDiff = container.scrollHeight - prevScrollHeightRef.current;
    container.scrollTop = scrollDiff;
  }, []);

  return {
    scrollContainerRef,
    messagesEndRef,
    showScrollButton,
    handleScroll,
    scrollToBottom,
    startPreserveScrollOnOlderLoad,
    finishPreserveScrollOnOlderLoad,
  };
}

