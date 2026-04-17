/**
 * Role store — 'client' | 'agency'.
 *
 * Drives:
 *  - html[data-role="..."] attribute (CSS gates elements with .agency-only)
 *  - UI segmented control in Topbar
 *  - Client-side feature gates in tabs (InsightBanner, Anomalies, AI narrative)
 *
 * Actual access control lives server-side in middleware.ts — this store
 * only mirrors the role from the JWT cookie after login, and lets an agency
 * user preview "what the client sees" via the segmented control.
 *
 * Persistence: `r99-role-preview` localStorage key (preview-only toggle).
 * The authoritative role is the JWT cookie set at login.
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role = 'client' | 'agency';

type RoleState = {
  /** Authenticated role from JWT — never overridden by the preview toggle. */
  authRole: Role;
  /** Effective role shown in the UI. If agency is previewing client view, this = 'client'. */
  role: Role;
  /** True when agency user is previewing the client view. */
  isPreviewingClient: boolean;
  setAuthRole: (r: Role) => void;
  setPreviewClient: (preview: boolean) => void;
};

export const useRole = create<RoleState>()(
  persist(
    (set, get) => ({
      authRole: 'agency',
      role: 'agency',
      isPreviewingClient: false,
      setAuthRole: (r) =>
        set((s) => ({
          authRole: r,
          // If authenticated as client, preview toggle has no effect.
          role: r === 'client' ? 'client' : s.isPreviewingClient ? 'client' : 'agency',
        })),
      setPreviewClient: (preview) => {
        const s = get();
        if (s.authRole !== 'agency') return; // client users can't preview anything
        set({ isPreviewingClient: preview, role: preview ? 'client' : 'agency' });
      },
    }),
    { name: 'r99-role-preview', partialize: (s) => ({ isPreviewingClient: s.isPreviewingClient }) },
  ),
);
