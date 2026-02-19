/** Unified event bus for Tauri and browser environments. */
export interface EventBus {
  listen<T>(event: string, handler: (payload: T) => void): Promise<() => void>;
  emit<T>(event: string, payload: T): void;
}

const isTauri = typeof window !== "undefined" && "__TAURI__" in window;

/** Tauri environment: wraps @tauri-apps/api/event. */
function createTauriEventBus(): EventBus {
  return {
    async listen<T>(event: string, handler: (payload: T) => void): Promise<() => void> {
      const { listen } = await import("@tauri-apps/api/event");
      return listen<T>(event, (e) => handler(e.payload));
    },
    emit(): void {
      // In Tauri, events are emitted from the Rust backend; frontend emit is a no-op.
    },
  };
}

/** Browser environment: EventTarget-based implementation (allows emit from tests). */
function createBrowserEventBus(): EventBus {
  const target = new EventTarget();

  return {
    async listen<T>(event: string, handler: (payload: T) => void): Promise<() => void> {
      const listener = (e: Event) => handler((e as CustomEvent<T>).detail);
      target.addEventListener(event, listener);
      return () => target.removeEventListener(event, listener);
    },
    emit<T>(event: string, payload: T): void {
      target.dispatchEvent(new CustomEvent<T>(event, { detail: payload }));
    },
  };
}

/** Global singleton event bus. */
export const eventBus: EventBus = isTauri ? createTauriEventBus() : createBrowserEventBus();
