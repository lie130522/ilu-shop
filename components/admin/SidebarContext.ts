// ─── ILU SHOP — Contexte état sidebar mobile ─────────────────────────────────
// Partagé entre AdminShell (state), AdminTopBar (bouton hamburger)
// et AdminSidebar (slide-in / slide-out).

import { createContext, useContext } from 'react';

interface SidebarContextValue {
  open: boolean;
  setOpen: (v: boolean) => void;
}

export const SidebarContext = createContext<SidebarContextValue>({
  open: false,
  setOpen: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}
