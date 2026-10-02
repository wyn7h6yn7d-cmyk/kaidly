"use client";

import { useCallback, useEffect, useState } from "react";

const SKIP = new Set(["orgSlug", "installationId", "correctionOfId", "deficiencyId", "withAttachments"]);

function read(form: HTMLFormElement): Record<string, string> {
  const values: Record<string, string> = {};
  new FormData(form).forEach((value, name) => {
    if (typeof value === "string" && !SKIP.has(name) && !name.startsWith("$")) values[name] = value;
  });
  return values;
}

/**
 * Keeps what was typed into a form in sessionStorage (this tab only) until it is saved,
 * so a reload or a lost connection doesn't cost the text. Not an offline mode: nothing is
 * sent later, and closing the tab discards the draft (shared devices). `key` null = off.
 */
export function useSessionDraft(key: string | null) {
  // Callback ref (state), so the form element can be used in effects without ref reads during render.
  const [form, attachForm] = useState<HTMLFormElement | null>(null);
  const [restored, setRestored] = useState(false);

  const saveNow = useCallback(() => {
    if (!key || !form) return;
    try {
      sessionStorage.setItem(key, JSON.stringify(read(form)));
    } catch {
      // Storage unavailable (private mode, quota): drafts are a convenience only.
    }
  }, [key, form]);

  const clear = useCallback(() => {
    if (!key) return;
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
    setRestored(false);
  }, [key]);

  useEffect(() => {
    if (!key || !form) return;
    let saved: Record<string, string> | null = null;
    try {
      saved = JSON.parse(sessionStorage.getItem(key) ?? "null");
    } catch {
      saved = null;
    }
    if (saved && Object.values(saved).some((v) => v.trim())) {
      for (const [name, value] of Object.entries(saved)) {
        const field = form.elements.namedItem(name);
        if (field instanceof RadioNodeList) field.value = value;
        else if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
          field.value = value;
        }
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reflects an external store read once on mount
      setRestored(true);
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = () => {
      clearTimeout(timer);
      timer = setTimeout(saveNow, 300);
    };
    form.addEventListener("input", onChange);
    form.addEventListener("change", onChange);
    return () => {
      clearTimeout(timer);
      form.removeEventListener("input", onChange);
      form.removeEventListener("change", onChange);
    };
  }, [key, form, saveNow]);

  const discard = useCallback(() => {
    clear();
    form?.reset();
  }, [clear, form]);

  return { attachForm, restored, saveNow, clear, discard };
}
