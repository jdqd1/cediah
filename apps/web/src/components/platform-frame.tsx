"use client";

import { createContext, useContext, useLayoutEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { usePathname } from "next/navigation";
import type { PlatformRole } from "@cediah/contracts";
import { isPlatformPath } from "@/lib/platform-routes";
import { AccessProvider } from "./access-context";
import { PersistentAppShell } from "./app-shell";

type ShellSession = { roles: PlatformRole[]; viewer: { email: string } };
const SessionBridge = createContext<Dispatch<SetStateAction<ShellSession | null>> | null>(null);

function AuthenticatedFrame({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ShellSession | null>(null);
  return (
    <SessionBridge.Provider value={setSession}>
      <AccessProvider roles={session?.roles ?? []}>
        <PersistentAppShell viewer={session?.viewer} profilePending={!session}>{children}</PersistentAppShell>
      </AccessProvider>
    </SessionBridge.Provider>
  );
}

/** The root layout survives transitions between all protected route segments.
 * Authorization stays in each server layout; this frame contains chrome only. */
export function PlatformFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return isPlatformPath(pathname) ? <AuthenticatedFrame>{children}</AuthenticatedFrame> : children;
}

/** Verified server session data, never user-supplied roles or an authorization gate. */
export function AuthenticatedShellSession({ roles, viewer }: ShellSession) {
  const setSession = useContext(SessionBridge);
  useLayoutEffect(() => {
    setSession?.((previous) => previous?.viewer.email === viewer.email && previous.roles.join() === roles.join()
      ? previous : { roles, viewer });
  }, [roles, setSession, viewer]);
  return null;
}
