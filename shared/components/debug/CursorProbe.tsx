"use client";

import { useEffect } from "react";

type HoverSample = {
  tag: string;
  id: string | null;
  role: string | null;
  href: string | null;
  disabled: boolean;
  cursor: string;
  pointerEvents: string;
  path: Array<{
    tag: string;
    cursor: string;
    pointerEvents: string;
    className: string | null;
  }>;
};

function isInteractive(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (tag === "a" || tag === "button" || tag === "select") return true;
  if (tag === "input") {
    const type = (el as HTMLInputElement).type;
    return type === "button" || type === "submit" || type === "reset";
  }
  const role = el.getAttribute("role");
  return role === "button" || role === "link";
}

export function CursorProbe() {
  useEffect(() => {
    let lastSentAt = 0;
    let lastKey = "";

    function onOver(e: MouseEvent) {
      const target = e.target;
      if (!(target instanceof Element)) return;

      const el = target.closest("a,button,select,input,[role='button'],[role='link']");
      if (!el) return;
      if (!isInteractive(el)) return;

      const now = Date.now();
      if (now - lastSentAt < 250) return;

      const cs = window.getComputedStyle(el);
      const key = [
        el.tagName,
        el.getAttribute("role") ?? "",
        (el as HTMLElement).id ?? "",
        cs.cursor,
        cs.pointerEvents,
      ].join("|");
      if (key === lastKey) return;
      lastKey = key;
      lastSentAt = now;

      const path: HoverSample["path"] = [];
      let cur: Element | null = el;
      for (let i = 0; i < 5 && cur; i += 1) {
        const pcs = window.getComputedStyle(cur);
        path.push({
          tag: cur.tagName.toLowerCase(),
          cursor: pcs.cursor,
          pointerEvents: pcs.pointerEvents,
          className:
            cur instanceof HTMLElement && typeof cur.className === "string"
              ? cur.className
              : null,
        });
        cur = cur.parentElement;
      }

      const payload: HoverSample = {
        tag: el.tagName.toLowerCase(),
        id: el instanceof HTMLElement ? el.id || null : null,
        role: el.getAttribute("role"),
        href: el instanceof HTMLAnchorElement ? el.getAttribute("href") : null,
        disabled:
          el instanceof HTMLButtonElement ||
          el instanceof HTMLInputElement ||
          el instanceof HTMLSelectElement
            ? el.disabled
            : false,
        cursor: cs.cursor,
        pointerEvents: cs.pointerEvents,
        path,
      };

      // #region agent log
      fetch("http://127.0.0.1:7817/ingest/10b84bcc-81f6-45e3-989c-fef791f2814e", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "47a973",
        },
        body: JSON.stringify({
          sessionId: "47a973",
          runId: "pre-fix",
          hypothesisId: "H_CURSOR_INHERIT_OR_OVERLAY",
          location: "shared/components/debug/CursorProbe.tsx",
          message: "hover computed cursor sample",
          data: payload,
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log
    }

    window.addEventListener("mouseover", onOver, { passive: true });
    return () => window.removeEventListener("mouseover", onOver);
  }, []);

  return null;
}

