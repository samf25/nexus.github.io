function normalizeRoute(route) {
  let value = String(route || "/").trim();

  if (!value.startsWith("/")) {
    value = `/${value}`;
  }

  if (value.length > 1) {
    value = value.replace(/\/+$/, "");
  }

  return value;
}

export function getCurrentRoute() {
  const hash = window.location.hash || "#/";
  const candidate = hash.startsWith("#") ? hash.slice(1) : hash;
  return normalizeRoute(candidate || "/");
}

export function navigate(route) {
  const normalized = normalizeRoute(route);
  window.location.hash = normalized;
}

export function subscribeToRouteChanges(onChange) {
  const handler = () => onChange(getCurrentRoute());
  window.addEventListener("hashchange", handler);
  return () => window.removeEventListener("hashchange", handler);
}
