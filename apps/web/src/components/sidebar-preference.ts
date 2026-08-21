"use client";

import { useSyncExternalStore } from "react";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "cediah:sidebar-collapsed";
const SIDEBAR_PREFERENCE_EVENT = "cediah:sidebar-preference-change";

let inMemoryPreference = false;

function getSidebarPreferenceSnapshot() {
  try {
    inMemoryPreference = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "true";
  } catch {
    // Fall back to the current-session preference when storage is unavailable.
  }

  return inMemoryPreference;
}

function subscribeToSidebarPreference(onStoreChange: () => void) {
  const synchronizeStorage = (event: StorageEvent) => {
    if (event.key === SIDEBAR_COLLAPSED_STORAGE_KEY) onStoreChange();
  };

  window.addEventListener("storage", synchronizeStorage);
  window.addEventListener(SIDEBAR_PREFERENCE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", synchronizeStorage);
    window.removeEventListener(SIDEBAR_PREFERENCE_EVENT, onStoreChange);
  };
}

export function useSidebarCollapsedPreference() {
  return useSyncExternalStore(
    subscribeToSidebarPreference,
    getSidebarPreferenceSnapshot,
    () => false,
  );
}

export function setSidebarCollapsedPreference(collapsed: boolean) {
  inMemoryPreference = collapsed;

  try {
    if (collapsed) {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, "true");
    } else {
      localStorage.removeItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    }
  } catch {
    // The custom event still updates this tab through the in-memory fallback.
  }

  window.dispatchEvent(new Event(SIDEBAR_PREFERENCE_EVENT));
}
