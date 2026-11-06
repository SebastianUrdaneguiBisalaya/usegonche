/** Attribute set on `<html>` while the page is scrolled past the threshold. `Navbar.Root` (floating) styles itself from it. */
export const NAVBAR_SCROLLED_ATTRIBUTE = "data-navbar-scrolled";

export interface NavbarScrollScriptProps {
  /**
   * Scroll distance (px) past which the page counts as scrolled. Keep it equal to `Navbar.Root`'s `scrollThreshold`.
   * @default 24
   */
  scrollThreshold?: number;
}

/**
 * Inline script for the root layout's `<head>`. It keeps `data-navbar-scrolled` on `<html>` in sync with the scroll from the very
 * first paint, before React hydrates, so a reload mid-page (scroll restored by the browser) shows the narrow floating navbar right
 * away instead of the full-width one shrinking afterwards. Render it from a Server Component (the root layout): React never
 * runs scripts rendered on the client.
 */
export function NavbarScrollScript({ scrollThreshold = 24 }: NavbarScrollScriptProps) {
  const code = `(function(){var d=document.documentElement;function u(){d.setAttribute("${NAVBAR_SCROLLED_ATTRIBUTE}",String(window.scrollY>${scrollThreshold}))}u();window.addEventListener("scroll",u,{passive:true})})();`;
  // biome-ignore lint/security/noDangerouslySetInnerHtml: static inline script, no user input.
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
