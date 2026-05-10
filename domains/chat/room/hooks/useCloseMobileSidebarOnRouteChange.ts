"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function useCloseMobileSidebarOnRouteChange(
  closeMobileSidebar: (() => void) | undefined,
) {
  const pathname = usePathname();

  useEffect(() => {
    closeMobileSidebar?.();
  }, [pathname, closeMobileSidebar]);
}
