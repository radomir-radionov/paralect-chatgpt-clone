"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type RoomsNavContextValue = {
  mobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
};

const RoomsNavContext = createContext<RoomsNavContextValue | null>(null);

export function RoomsNavProvider({ children }: { children: ReactNode }) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const openMobileSidebar = useCallback(() => setMobileSidebarOpen(true), []);
  const closeMobileSidebar = useCallback(() => setMobileSidebarOpen(false), []);

  const value = useMemo(
    () => ({
      mobileSidebarOpen,
      setMobileSidebarOpen,
      openMobileSidebar,
      closeMobileSidebar,
    }),
    [mobileSidebarOpen, openMobileSidebar, closeMobileSidebar],
  );

  return (
    <RoomsNavContext.Provider value={value}>{children}</RoomsNavContext.Provider>
  );
}

export function useRoomsNav() {
  const ctx = useContext(RoomsNavContext);
  if (ctx == null) {
    throw new Error("useRoomsNav must be used within RoomsNavProvider");
  }
  return ctx;
}

export function useRoomsNavOptional() {
  return useContext(RoomsNavContext);
}
