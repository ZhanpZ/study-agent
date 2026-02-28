export function loadSessionState(key, fallback) {
  try {
    const stored = sessionStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

export function persistSessionState(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}
