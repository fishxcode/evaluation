import { useCallback, useEffect, useState } from "react";

export interface UrlStateCodec<T> {
  read(search: URLSearchParams): T;
  write(value: T): URLSearchParams;
}

export function useUrlState<T>(codec: UrlStateCodec<T>) {
  const [value, setValue] = useState<T>(() =>
    codec.read(new URLSearchParams(window.location.search)),
  );

  useEffect(() => {
    const onPopState = () =>
      setValue(codec.read(new URLSearchParams(window.location.search)));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [codec]);

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved =
          typeof next === "function"
            ? (next as (current: T) => T)(current)
            : next;
        const search = codec.write(resolved).toString();
        const nextUrl = `${window.location.pathname}${search ? `?${search}` : ""}${window.location.hash}`;
        window.history.replaceState(null, "", nextUrl);
        return resolved;
      });
    },
    [codec],
  );

  return [value, update] as const;
}
