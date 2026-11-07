/** CSS selector of a sidebar link the product tour points at (the sidebar marks each link with `data-tour="nav-<id>"`). */
export const tourTarget = (navId: string): string => `[data-tour="nav-${navId}"]`;
