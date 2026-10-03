"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";

/**
 * Password field with a show/hide toggle. The toggle is a plain button (never submits),
 * keeps the value and focus position, and announces its current action.
 */
export function PasswordInput({ className, ...props }: Omit<React.ComponentProps<typeof Input>, "type">) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={visible ? "text" : "password"} className={cn("pr-12", className)} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t.common.hidePassword : t.common.showPassword}
        aria-controls={props.id}
        aria-pressed={visible}
        className="absolute right-1 top-1/2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-sm text-k-grey hover:text-k-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="size-5" aria-hidden="true" /> : <Eye className="size-5" aria-hidden="true" />}
      </button>
    </div>
  );
}

/** Input styling shared by every auth form. */
export const AUTH_INPUT = "h-12 hover:border-k-ink";
