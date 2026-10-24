// Empty by default on purpose: the built bundle is served by the Vanadristi backend
// itself, so `/api/...` is same-origin. Set VITE_API_BASE_URL only when the app is
// hosted somewhere other than the backend.
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

// A bundle opened from the filesystem has no origin to call, so only http(s) pages
// or an explicit base URL can reach a backend.
export const isApiConfigured = Boolean(API_BASE_URL)
  || (typeof window !== 'undefined' && /^https?:$/.test(window.location.protocol));

export const API_ENDPOINTS = {
  health: '/api/health',
  regions: '/api/regions',
  run: '/api/run',
  inspect: '/api/inspect',
  model: '/api/model',
};

// A real run asks Earth Engine for eight seasonal composites over the whole study
// region, so it takes minutes. The demo paths never wait on this.
export const RUN_TIMEOUT_MS = 45 * 60 * 1000;
export const DEFAULT_TIMEOUT_MS = 20000;

export async function apiRequest(path, {
  baseUrl = API_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  ...options
} = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      signal: controller.signal,
      ...options,
    });
    const text = await response.text();
    let payload = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      // The backend answers every failure with {"error": "..."} that says which
      // gate stopped the request, so the reason reaches the screen instead of a
      // bare status code.
      const reason = payload && payload.error ? payload.error : text.slice(0, 300);
      const error = new Error(reason || `Request failed with status ${response.status}.`);
      error.status = response.status;
      throw error;
    }
    return payload;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`The backend did not answer within ${Math.round(timeoutMs / 1000)} s.`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function checkApiHealth(baseUrl = API_BASE_URL) {
  try {
    const payload = await apiRequest(API_ENDPOINTS.health, { baseUrl });
    const ready = Boolean(payload && payload.earth_engine_ready);
    return {
      ok: true,
      ready,
      message: ready
        ? 'Backend is configured and Earth Engine is initialised.'
        : 'Backend answered, but Earth Engine is not configured, so real runs are refused.',
    };
  } catch (error) {
    return {
      ok: false,
      ready: false,
      message: `Connection check failed: ${error.message}`,
    };
  }
}
