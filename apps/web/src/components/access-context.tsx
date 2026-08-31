"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { PlatformRole } from "@cediah/contracts";

const AccessContext = createContext<PlatformRole[]>([]);

export function AccessProvider({
  children,
  roles,
}: {
  children: ReactNode;
  roles: PlatformRole[];
}) {
  return <AccessContext.Provider value={roles}>{children}</AccessContext.Provider>;
}

export function useAccessRoles() {
  return useContext(AccessContext);
}
