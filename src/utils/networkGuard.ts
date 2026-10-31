/**
 * A tiny runtime tripwire that counts every outbound (cross-origin) network
 * request the app attempts. RedactZero should always read 0 — the counter
 * exists so users can verify that claim themselves instead of trusting copy.
 */
type Listener = (count: number) => void;

const listeners = new Set<Listener>();
let outbound = 0;
let installed = false;

function note(url: string): void {
  try {
    const parsed = new URL(url, window.location.href);
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:';
    if (isHttp && parsed.origin !== window.location.origin) {
      outbound += 1;
      for (const listener of listeners) listener(outbound);
    }
  } catch {
    /* Relative or opaque URLs are local by definition. */
  }
}

export function installNetworkGuard(): void {
  if (installed) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    note(url);
    return originalFetch(input, init);
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function open(
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    ...rest: unknown[]
  ) {
    note(String(url));
    return (originalOpen as unknown as (...args: unknown[]) => void).call(
      this,
      method,
      url,
      ...rest,
    );
  } as typeof XMLHttpRequest.prototype.open;

  const originalBeacon = navigator.sendBeacon?.bind(navigator);
  if (originalBeacon) {
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      note(String(url));
      return originalBeacon(url, data);
    };
  }
}

export const networkGuard = {
  get count(): number {
    return outbound;
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
