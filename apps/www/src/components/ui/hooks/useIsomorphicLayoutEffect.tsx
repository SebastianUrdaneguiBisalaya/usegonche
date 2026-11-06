import { useEffect, useLayoutEffect } from "react";

/**
 * `useLayoutEffect` in the browser (runs before paint, so a measured or scroll-derived state never shows a wrong first frame) and
 * `useEffect` on the server, where layout effects don't run and React would warn.
 */
export const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;
