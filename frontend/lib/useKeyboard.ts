"use client";

import { useEffect } from "react";

type KeyHandler = Record<string, () => void>;

/**
 * Simple keyboard shortcut hook.
 * Only fires when not typing in an input/textarea/contenteditable.
 */
export function useKeyboard(handlers: KeyHandler) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Don't fire shortcuts when typing in form fields
      const tag = (e.target as HTMLElement)?.tagName;
      const editable = (e.target as HTMLElement)?.isContentEditable;
      if (tag === "INPUT" || tag === "TEXTAREA" || editable) return;

      const key = e.key;
      if (handlers[key]) {
        e.preventDefault();
        handlers[key]();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}
