import { AlertCircle, Loader2, SearchX } from "lucide-react";

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <Loader2 className="mr-2 h-5 w-5 animate-spin text-sky-600" />
      <span className="text-sm text-slate-600 dark:text-slate-300">
        {label}
      </span>
    </div>
  );
}

export function ErrorState({
  label,
  message,
}: {
  label: string;
  message?: string;
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
      <AlertCircle className="mb-3 h-6 w-6 text-red-600" />
      <p className="text-sm font-semibold text-red-800 dark:text-red-200">
        {label}
      </p>
      {message ? (
        <p className="mt-1 max-w-xl text-xs text-red-700 dark:text-red-300">
          {message}
        </p>
      ) : null}
    </div>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center dark:border-slate-700 dark:bg-slate-900">
      <SearchX className="mb-3 h-6 w-6 text-slate-500" />
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
        {label}
      </p>
    </div>
  );
}
