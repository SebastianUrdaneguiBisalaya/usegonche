import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Tracks the `(prefers-reduced-motion: reduce)` media query live, so a GSAP-driven component (see
 * `useGsapContext`) can skip scroll-jacking/parallax motion for users who asked the OS for less of it (WCAG
 * 2.3.3), falling back to a static or natively-controlled version instead. Returns `false` during SSR and on
 * first client render, before the media query can be read.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(QUERY);
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
