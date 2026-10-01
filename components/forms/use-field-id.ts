"use client";

import { useId } from "react";

/**
 * Unique field ids per form instance. With Cache Components, Next.js keeps recently
 * visited pages mounted but hidden (React Activity), so fixed ids like "name" would
 * appear several times in the document and labels could point at hidden inputs.
 */
export function useFieldId() {
  const prefix = useId();
  return (name: string) => `${prefix}${name}`;
}
