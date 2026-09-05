import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Listens for the app-level "appBack" custom event (dispatched by the Android
 * back button in App.jsx) and pops the topmost open overlay/modal.
 *
 * Pass an array of handlers in priority order — highest first. Each handler is
 * { when: () => bool, do: () => void }. The first handler whose `when` returns
 * truthy gets to consume the back press: it calls `do`, the event is
 * preventDefault'd, and the app-level fallback (router back / exitApp) is
 * skipped.
 *
 * The handlers array can be re-created on every render — we read it through a
 * ref so the listener always sees fresh state without re-registering.
 */
export function useBackHandler(handlers) {
  const ref = useRef(handlers);
  useLayoutEffect(() => { ref.current = handlers; });

  useEffect(() => {
    const onBack = (e) => {
      const list = ref.current || [];
      for (const h of list) {
        if (h && h.when()) {
          e.preventDefault();
          h.do();
          return;
        }
      }
    };
    window.addEventListener("appBack", onBack);
    return () => window.removeEventListener("appBack", onBack);
  }, []);
}
