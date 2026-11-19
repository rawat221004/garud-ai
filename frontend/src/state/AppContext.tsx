/** Global app state: persisted preferences and toast notifications. */

import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from "react";

export interface Toast {
  id: number;
  kind: "info" | "success" | "error";
  text: string;
}

type Theme = "light" | "dark";

interface AppState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  cityId: string;
  setCityId: (id: string) => void;
  toasts: Toast[];
  toast: (kind: Toast["kind"], text: string) => void;
  dismiss: (id: number) => void;
}

const Ctx = createContext<AppState | null>(null);

let toastSeq = 1;

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [cityId, setCityIdState] = useState<string>(() => {
    try {
      return localStorage.getItem("garud.city") || "hyderabad";
    } catch {
      return "hyderabad";
    }
  });
  const [theme, setTheme] = useState<Theme>(() =>
    document.documentElement.dataset.theme === "light" ? "light" : "dark"
  );

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("garud.theme", theme);
    } catch {
      /* Storage may be unavailable in private mode. */
    }
  }, [theme]);

  const [toasts, setToasts] = useState<Toast[]>([]);

  const setCityId = useCallback((id: string) => {
    setCityIdState(id);
    try {
      localStorage.setItem("garud.city", id);
    } catch {
      /* private mode */
    }
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (kind: Toast["kind"], text: string) => {
      const id = toastSeq++;
      setToasts((t) => [...t.slice(-3), { id, kind, text }]);
      window.setTimeout(() => {
        setToasts((t) => t.filter((x) => x.id !== id));
      }, 5000);
    },
    []
  );

  const value = useMemo(
    () => ({ cityId, setCityId, theme, setTheme, toasts, toast, dismiss }),
    [cityId, setCityId, theme, toasts, toast, dismiss]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}
