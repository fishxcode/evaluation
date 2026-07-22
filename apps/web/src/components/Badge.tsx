import clsx from "clsx";
import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "blue" | "amber";
}) {
  return (
    <span
      className={clsx(
        "inline-flex h-6 items-center rounded-md px-2 text-xs font-medium",
        tone === "neutral" &&
          "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
        tone === "green" &&
          "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
        tone === "blue" &&
          "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
        tone === "amber" &&
          "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
      )}
    >
      {children}
    </span>
  );
}
