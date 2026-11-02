import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, useRef } from "react";

let scrollTriggerRegistered = false;

/** Registers the `ScrollTrigger` plugin once, lazily, the first time any component actually needs it. */
function ensureScrollTrigger() {
  if (scrollTriggerRegistered) return;
  gsap.registerPlugin(ScrollTrigger);
  scrollTriggerRegistered = true;
}

export interface UseGsapContextOptions {
  /**
   * Skips setting up the animation entirely — pass `usePrefersReducedMotion()` here so a component doesn't have
   * to special-case reduced motion itself; it can render a static/native fallback instead when this is `true`.
   * @default false
   */
  disabled?: boolean;
}

/**
 * Shared setup/teardown for every GSAP-driven component in this library. Runs `setup(root)` inside a
 * `gsap.context()` scoped to the returned ref's element, so every tween and `ScrollTrigger` it creates — even
 * ones GSAP creates internally — is torn down automatically on unmount or when `deps` change, instead of each
 * component hand-rolling its own cleanup. `setup` may return its own cleanup function (e.g. to remove a
 * `loadedmetadata` listener) for anything GSAP itself doesn't track; it runs before the context reverts.
 *
 * Registers `ScrollTrigger` once, lazily, the first time any component calls this — importing this hook has no
 * cost until a component actually mounts and uses it.
 *
 * @example
 * ```tsx
 * const reducedMotion = usePrefersReducedMotion();
 * const scope = useGsapContext<HTMLDivElement>(
 *   (root) => {
 *     const tween = gsap.to(root.querySelector(".panel"), { x: 200, scrollTrigger: { trigger: root, scrub: true } });
 *     return () => tween.kill();
 *   },
 *   [someDep],
 *   { disabled: reducedMotion },
 * );
 * return <div ref={scope}>...</div>;
 * ```
 */
export function useGsapContext<T extends Element = HTMLDivElement>(
  setup: (root: T) => void | (() => void),
  deps: React.DependencyList,
  options: UseGsapContextOptions = {},
): React.RefObject<T | null> {
  const scope = useRef<T>(null);
  const { disabled = false } = options;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `setup` is intentionally excluded — callers close over fresh values via their own `deps` array instead of a stable identity, same contract as `useEffect`'s escape hatch.
  useLayoutEffect(() => {
    const root = scope.current;
    if (disabled || !root) return;

    ensureScrollTrigger();

    let ownCleanup: (() => void) | void;
    const context = gsap.context(() => {
      ownCleanup = setup(root);
    }, root);

    return () => {
      ownCleanup?.();
      context.revert();
    };
  }, [
    disabled,
    ...deps,
  ]);

  return scope;
}
