export type ThemeMode = "system" | "light" | "dark";

const storageKey = "models-dev-theme";

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function resolveTheme(mode: ThemeMode) {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

export function readTheme(): ThemeMode {
  const stored = localStorage.getItem(storageKey);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

export function writeTheme(mode: ThemeMode) {
  localStorage.setItem(storageKey, mode);
  document.documentElement.classList.toggle(
    "dark",
    resolveTheme(mode) === "dark",
  );
}
