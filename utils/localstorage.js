export const setLocalStorage = (key, value) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, value);
  } catch {}
};

export const getLocalStorage = (key) => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
