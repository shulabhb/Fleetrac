const STORAGE_KEY = "fleetrac:notifications:ui";

type NotificationUIState = {
  readIds: string[];
  deletedIds: string[];
};

function loadState(): NotificationUIState {
  if (typeof window === "undefined") {
    return { readIds: [], deletedIds: [] };
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { readIds: [], deletedIds: [] };
    const parsed = JSON.parse(raw) as Partial<NotificationUIState>;
    return {
      readIds: Array.isArray(parsed.readIds) ? parsed.readIds : [],
      deletedIds: Array.isArray(parsed.deletedIds) ? parsed.deletedIds : []
    };
  } catch {
    return { readIds: [], deletedIds: [] };
  }
}

function saveState(state: NotificationUIState) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  window.dispatchEvent(new CustomEvent("fleetrac-notifications-updated"));
}

export function readNotificationState(): NotificationUIState {
  return loadState();
}

export function markNotificationRead(id: string) {
  const state = loadState();
  if (state.readIds.includes(id)) return;
  saveState({ ...state, readIds: [...state.readIds, id] });
}

export function markAllNotificationsRead(ids: string[]) {
  const state = loadState();
  const readIds = Array.from(new Set([...state.readIds, ...ids]));
  saveState({ ...state, readIds });
}

export function deleteNotification(id: string) {
  const state = loadState();
  if (state.deletedIds.includes(id)) return;
  saveState({
    readIds: state.readIds.filter((x) => x !== id),
    deletedIds: [...state.deletedIds, id]
  });
}

export function resetNotificationState() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("fleetrac-notifications-updated"));
}
