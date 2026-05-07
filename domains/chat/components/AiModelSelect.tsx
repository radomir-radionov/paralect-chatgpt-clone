"use client";

import type { AiModelSlug } from "@shared/lib/ai/model-registry";
import { AI_MODELS } from "@shared/lib/ai/model-registry";
import { cn } from "@shared/lib/utils";

type Props = {
  value: AiModelSlug;
  onChange: (next: AiModelSlug) => void;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
};

export function AiModelSelect({
  value,
  onChange,
  disabled = false,
  ariaLabel = "AI model",
  className,
}: Props) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as AiModelSlug)}
      disabled={disabled}
      className={cn(
        "border-input dark:bg-input/30 focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border bg-transparent px-2.5 text-sm shadow-xs outline-none transition-[color,box-shadow]",
        "focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      aria-label={ariaLabel}
    >
      {AI_MODELS.map((model) => (
        <option key={model.slug} value={model.slug}>
          {model.label}
        </option>
      ))}
    </select>
  );
}

