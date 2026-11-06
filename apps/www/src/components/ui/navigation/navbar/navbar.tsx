"use client";

import { ChevronDown, Menu, X } from "lucide-react";
import * as React from "react";
import { Icon } from "../../foundations/icon/icon";
import { useClickOutside } from "../../hooks/useClickOutside";
import { Layout } from "../../layout/layout/layout";
import { useEscapeKey } from "../../overlays-feedback/modal/modal";
import { cn } from "../../utils/tailwind/cn";

interface NavbarContextValue {
  readonly lang: NavbarLang;
  readonly floating: boolean;
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly panelId: string;
}

/** Texts rendered by `Navbar`'s controls. Pass `lang` to `Navbar.Root` to override any of them. */
export interface NavbarLang {
  /** Accessible name of the mobile menu toggle while closed. */
  openMenu: string;
  /** Accessible name of the mobile menu toggle while open. */
  closeMenu: string;
  /** Accessible name of the desktop navigation landmark. */
  primary: string;
  /** Accessible name of the mobile navigation panel. */
  mobile: string;
}

/** English defaults for `NavbarLang`. */
export const defaultNavbarLang: NavbarLang = {
  closeMenu: "Close menu",
  mobile: "Mobile",
  openMenu: "Open menu",
  primary: "Primary",
};

const NavbarContext = React.createContext<NavbarContextValue | null>(null);

function useNavbarContext() {
  const context = React.useContext(NavbarContext);
  if (!context) {
    throw new Error("Navbar subcomponents must be used within <Navbar.Root>.");
  }
  return context;
}

export interface NavbarRootProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "lang"> {
  /**
   * Texts rendered by the controls. Merges over English defaults.
   * @default defaultNavbarLang
   */
  lang?: Partial<NavbarLang>;
  /**
   * Pins the navbar to the top of the viewport while the page scrolls.
   * @default true
   */
  sticky?: boolean;
  /**
   * `"bar"` is the full-width strip with a hairline bottom border. `"floating"` is a rounded pill inset from the viewport edges (it doesn't span the whole width), with a shadow, that can shrink as the page scrolls.
   * @default "bar"
   */
  variant?: "bar" | "floating";
  /**
   * Color treatment of a `"floating"` navbar. `"inverted"` is a dark pill on a light page (light pill on a dark one) and re-points the theme tokens inside it, so its links and buttons recolor automatically — a `primary` button becomes the light one. `"default"` uses the regular canvas surface.
   * @default "inverted"
   */
  tone?: "default" | "inverted";
  /**
   * Narrows a `"floating"` navbar once the page has scrolled past `scrollThreshold`, and eases it back to full width on returning to the top.
   * @default true
   */
  shrinkOnScroll?: boolean;
  /**
   * Scroll distance (px) past which a `"floating"` navbar counts as scrolled.
   * @default 24
   */
  scrollThreshold?: number;
}

/** Re-points the surface tokens to their `--inverse-*` counterparts for everything inside the element. */
const invertedTokens = [
  "[--background:var(--inverse-background)]",
  "[--foreground:var(--inverse-foreground)]",
  "[--foreground-secondary:var(--inverse-foreground-secondary)]",
  "[--muted-foreground:var(--inverse-foreground-secondary)]",
  "[--border:var(--inverse-border)]",
  "[--border-strong:var(--inverse-border)]",
  "[--hover:var(--inverse-hover)]",
  "[--muted:var(--inverse-hover)]",
  "[--ring:var(--inverse-foreground)]",
].join(" ");

/**
 * Compound navbar. A single `md`-breakpoint switch drives both layouts from
 * the same markup: `Navbar.Nav`/`Navbar.Actions` show at `md` and up,
 * `Navbar.Trigger` shows below it and toggles `Navbar.MobilePanel` — no
 * separate desktop/mobile component trees, no portal, no backdrop. Visually
 * restrained per this library's Scandinavian direction: a hairline bottom
 * border instead of a shadow/blur (or, with `variant="floating"`, an inset
 * rounded pill that narrows on scroll), plain-text links (no pill backgrounds)
 * with an underline for the active page, and at most one filled (`primary`)
 * action — everything else in `Navbar.Actions` should be `variant="ghost"`
 * or `"secondary"`.
 * @example
 * ```tsx
 * <Navbar.Root>
 *   <Navbar.Bar>
 *     <Navbar.Brand href="/">Acme</Navbar.Brand>
 *     <Navbar.Nav>
 *       <Navbar.Link active href="/product">Product</Navbar.Link>
 *       <Navbar.Item>
 *         <Navbar.ItemTrigger>Resources</Navbar.ItemTrigger>
 *         <Navbar.ItemContent>
 *           <Navbar.Link href="/docs">Docs</Navbar.Link>
 *           <Navbar.Link href="/blog">Blog</Navbar.Link>
 *         </Navbar.ItemContent>
 *       </Navbar.Item>
 *       <Navbar.Link href="/pricing">Pricing</Navbar.Link>
 *     </Navbar.Nav>
 *     <Navbar.Actions>
 *       <Button variant="ghost"><Button.Text>Log in</Button.Text></Button>
 *       <Button><Button.Text>Sign up</Button.Text></Button>
 *     </Navbar.Actions>
 *     <Navbar.Trigger />
 *   </Navbar.Bar>
 *   <Navbar.MobilePanel>
 *     <Navbar.Link active href="/product">Product</Navbar.Link>
 *     <Navbar.Link href="/pricing">Pricing</Navbar.Link>
 *     <Navbar.Link href="/docs">Docs</Navbar.Link>
 *     <Button className="mt-2"><Button.Text>Sign up</Button.Text></Button>
 *   </Navbar.MobilePanel>
 * </Navbar.Root>
 * ```
 */
function NavbarRoot({
  lang,
  sticky = true,
  variant = "bar",
  tone = "inverted",
  shrinkOnScroll = true,
  scrollThreshold = 24,
  className,
  children,
  ...props
}: NavbarRootProps) {
  const [open, setOpen] = React.useState(false);
  const [scrolled, setScrolled] = React.useState(false);
  const panelId = React.useId();
  const floating = variant === "floating";
  const resolvedLang = {
    ...defaultNavbarLang,
    ...lang,
  };

  const value = React.useMemo<NavbarContextValue>(
    () => ({
      lang: resolvedLang,
      floating,
      open,
      panelId,
      setOpen,
    }),
    [
      resolvedLang,
      floating,
      open,
      panelId,
    ],
  );

  // Only the floating pill reacts to scroll. The listener is passive and only
  // sets state when the boolean flips, so scrolling doesn't re-render.
  React.useEffect(() => {
    if (!floating || !shrinkOnScroll) {
      setScrolled(false);
      return;
    }
    const update = () => setScrolled(window.scrollY > scrollThreshold);
    update();
    window.addEventListener("scroll", update, {
      passive: true,
    });
    return () => window.removeEventListener("scroll", update);
  }, [
    floating,
    shrinkOnScroll,
    scrollThreshold,
  ]);

  // A resize past the mobile breakpoint hides Navbar.Trigger via CSS, but
  // without this the panel's state (and its `inert`/height) stays "open" —
  // reopening it on the next resize back down with no click to trigger it.
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const handleChange = (event: MediaQueryListEvent) => {
      if (event.matches) setOpen(false);
    };
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return (
    <NavbarContext.Provider value={value}>
      <header
        className={cn(
          "relative z-40",
          floating
            ? [
                "mx-auto w-[calc(100%-2rem)] rounded-2xl border border-border bg-background text-foreground",
                "transition-[max-width,box-shadow] duration-300 ease-in-out motion-reduce:transition-none",
                scrolled ? "max-w-3xl shadow-xl" : "max-w-6xl shadow-lg",
                tone === "inverted" && invertedTokens,
                sticky && "sticky top-4",
              ]
            : [
                "w-full border-b border-border bg-background",
                sticky && "sticky top-0",
              ],
          className,
        )}
        data-scrolled={floating ? scrolled : undefined}
        {...props}
      >
        {children}
      </header>
    </NavbarContext.Provider>
  );
}

export interface NavbarBarProps extends React.HTMLAttributes<HTMLDivElement> {}

/** The navbar's single row — `Navbar.Brand` on the left, `Navbar.Nav`/`Navbar.Actions`/`Navbar.Trigger` on the right, at a fixed `h-16` (the `lg` control height on this library's sizing scale). */
function NavbarBar({ className, children, ...props }: NavbarBarProps) {
  const { floating } = useNavbarContext();

  // The floating pill sets its own width, so the bar drops the page container
  // and just pads itself inside the pill.
  if (floating) {
    return (
      <div
        className={cn(
          "flex h-14 items-center justify-between gap-4 px-3",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <Layout.Container
      className={cn("flex h-16 items-center justify-between gap-4", className)}
      {...props}
    >
      {children}
    </Layout.Container>
  );
}

export interface NavbarBrandProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {}

/** Wordmark/logo slot, left-most in `Navbar.Bar`. Renders an `<a>` — pass `href="/"` (or a framework `Link`'s props via `asChild`-style spreading) to make it the home link. */
function NavbarBrand({ className, children, ...props }: NavbarBrandProps) {
  return (
    <a
      className={cn(
        "flex shrink-0 items-center gap-2 font-primary text-base font-semibold text-foreground",
        "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}

export interface NavbarNavProps extends React.HTMLAttributes<HTMLElement> {}

/** Desktop primary navigation — a row of `Navbar.Link`s, hidden below `md` in favor of `Navbar.MobilePanel`. */
function NavbarNav({ className, children, ...props }: NavbarNavProps) {
  const lang = useNavbarContext().lang;
  return (
    <nav
      aria-label={lang.primary}
      className={cn("hidden items-center gap-6 md:flex", className)}
      {...props}
    >
      {children}
    </nav>
  );
}

export interface NavbarLinkProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /**
   * Marks this as the current page's link — underlines it, sets
   * `aria-current="page"`, and drops it to full-ink instead of muted.
   * @default false
   */
  active?: boolean;
}

/** One navigation link — plain text with an underline for the active page, never a pill/button background. Works inside `Navbar.Nav` (desktop) or `Navbar.MobilePanel` (mobile), and closes the mobile panel on click. */
function NavbarLink({
  active = false,
  className,
  onClick,
  ...props
}: NavbarLinkProps) {
  const { setOpen } = useNavbarContext();

  return (
    <a
      aria-current={active ? "page" : undefined}
      className={cn(
        "font-primary text-sm font-medium text-muted-foreground underline-offset-4 transition-colors duration-150 ease-in-out hover:text-foreground",
        "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
        active && "text-foreground underline",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        setOpen(false);
      }}
      {...props}
    />
  );
}

export interface NavbarActionsProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Right-most action row (typically `Button`s), hidden below `md` in favor of `Navbar.MobilePanel`. */
function NavbarActions({ className, children, ...props }: NavbarActionsProps) {
  return (
    <div
      className={cn("hidden items-center gap-3 md:flex", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface NavbarItemContextValue {
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly openOn: "hover" | "click";
  readonly contentId: string;
  readonly triggerRef: React.RefObject<HTMLButtonElement | null>;
  readonly contentRef: React.RefObject<HTMLDivElement | null>;
}

const NavbarItemContext = React.createContext<NavbarItemContextValue | null>(
  null,
);

function useNavbarItemContext() {
  const context = React.useContext(NavbarItemContext);
  if (!context) {
    throw new Error(
      "Navbar.Item subcomponents must be used within <Navbar.Item>.",
    );
  }
  return context;
}

const HOVER_CLOSE_DELAY = 150;

export interface NavbarItemProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * How `Navbar.ItemContent` opens: on pointer hover (closing after a short
   * delay so moving the pointer from the trigger into the popup doesn't
   * dismiss it) or only on click. Either way the trigger is a real `<button>`,
   * so Enter/Space always opens and closes it too — keyboard users aren't
   * limited by this prop.
   * @default "hover"
   */
  openOn?: "hover" | "click";
}

/**
 * Wraps a `Navbar.ItemTrigger` + `Navbar.ItemContent` pair into one
 * expandable nav item — the "item de despliegue" pattern for a top-level nav
 * entry that reveals more links. Use inside `Navbar.Nav` (desktop, where the
 * popup floats below the trigger) or `Navbar.MobilePanel` (where it expands
 * inline, accordion-style).
 * @example
 * ```tsx
 * <Navbar.Item openOn="click">
 *   <Navbar.ItemTrigger>Product</Navbar.ItemTrigger>
 *   <Navbar.ItemContent>
 *     <Navbar.Link href="/product/features">Features</Navbar.Link>
 *     <Navbar.Link href="/product/pricing">Pricing</Navbar.Link>
 *     <Navbar.Link href="/product/changelog">Changelog</Navbar.Link>
 *   </Navbar.ItemContent>
 * </Navbar.Item>
 * ```
 */
function NavbarItem({
  openOn = "hover",
  className,
  children,
  onMouseEnter,
  onMouseLeave,
  ...props
}: NavbarItemProps) {
  const [open, setOpen] = React.useState(false);
  const contentId = React.useId();
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const closeTimeoutRef = React.useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);

  const clearCloseTimeout = React.useCallback(() => {
    if (closeTimeoutRef.current === undefined) return;
    clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = undefined;
  }, []);

  React.useEffect(
    () => clearCloseTimeout,
    [
      clearCloseTimeout,
    ],
  );

  useClickOutside(triggerRef, () => setOpen(false), contentRef, open);
  useEscapeKey(open, () => {
    setOpen(false);
    triggerRef.current?.focus();
  });

  const value = React.useMemo<NavbarItemContextValue>(
    () => ({
      contentId,
      contentRef,
      open,
      openOn,
      setOpen,
      triggerRef,
    }),
    [
      contentId,
      open,
      openOn,
    ],
  );

  return (
    <NavbarItemContext.Provider value={value}>
      <div
        className={cn("relative", className)}
        onMouseEnter={(event) => {
          onMouseEnter?.(event);
          if (openOn === "hover") {
            clearCloseTimeout();
            setOpen(true);
          }
        }}
        onMouseLeave={(event) => {
          onMouseLeave?.(event);
          if (openOn === "hover") {
            clearCloseTimeout();
            closeTimeoutRef.current = setTimeout(
              () => setOpen(false),
              HOVER_CLOSE_DELAY,
            );
          }
        }}
        {...props}
      >
        {children}
      </div>
    </NavbarItemContext.Provider>
  );
}

export interface NavbarItemTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {}

/** Button that opens/closes the parent `Navbar.Item`'s `Navbar.ItemContent` — a chevron rotates to signal state, matching `Navbar.Link`'s plain-text visual weight rather than a filled button. */
function NavbarItemTrigger({
  className,
  children,
  ...props
}: NavbarItemTriggerProps) {
  const { open, setOpen, contentId, triggerRef } = useNavbarItemContext();

  return (
    <button
      aria-controls={contentId}
      aria-expanded={open}
      aria-haspopup="true"
      className={cn(
        "flex items-center gap-1 font-primary text-sm font-medium text-muted-foreground transition-colors duration-150 ease-in-out hover:text-foreground",
        "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
        open && "text-foreground",
        className,
      )}
      onClick={() => setOpen(!open)}
      ref={triggerRef}
      type="button"
      {...props}
    >
      {children}
      <Icon
        aria-hidden="true"
        className={cn(
          "transition-transform duration-150 ease-in-out",
          open && "rotate-180",
        )}
        icon={ChevronDown}
        size="sm"
      />
    </button>
  );
}

export interface NavbarItemContentProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Popup panel revealed by `Navbar.ItemTrigger` — floats below the trigger at `md` and up (`Navbar.Nav`), or expands inline in place at narrower widths (`Navbar.MobilePanel`). Closes on Escape, on an outside click, and whenever a link inside it is clicked. */
function NavbarItemContent({
  className,
  children,
  onClickCapture,
  ...props
}: NavbarItemContentProps) {
  const { open, contentId, contentRef, setOpen } = useNavbarItemContext();

  if (!open) return null;

  return (
    <div
      className={cn(
        "z-40 flex flex-col gap-1 pt-2 pb-1",
        "md:absolute md:top-full md:left-0 md:mt-2 md:min-w-56 md:animate-fade-scale-in md:rounded-md md:border md:border-border md:bg-background md:p-2 md:shadow-md",
        className,
      )}
      id={contentId}
      onClickCapture={(event) => {
        onClickCapture?.(event);
        if ((event.target as HTMLElement).closest("a")) setOpen(false);
      }}
      ref={contentRef}
      role="group"
      {...props}
    >
      {children}
    </div>
  );
}

export interface NavbarTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {}

/** Hamburger/close toggle for `Navbar.MobilePanel`, shown only below `md`. */
function NavbarTrigger({ className, onClick, ...props }: NavbarTriggerProps) {
  const { open, panelId, setOpen, lang } = useNavbarContext();

  return (
    <button
      aria-controls={panelId}
      aria-expanded={open}
      aria-label={open ? lang.closeMenu : lang.openMenu}
      className={cn(
        "flex size-9 shrink-0 items-center justify-center rounded-md text-foreground transition-colors duration-150 ease-in-out hover:bg-muted md:hidden",
        "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        setOpen(!open);
      }}
      type="button"
      {...props}
    >
      <Icon
        aria-hidden="true"
        icon={open ? X : Menu}
        size="md"
      />
    </button>
  );
}

export interface NavbarMobilePanelProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Collapsible mobile menu — stack `Navbar.Link`s (and any mobile-only actions) as children. Animates open/closed height via a `grid-template-rows` transition (no JS measurement), and is `inert` while closed so it can't take focus or be read by assistive tech. */
function NavbarMobilePanel({
  className,
  children,
  ...props
}: NavbarMobilePanelProps) {
  const lang = useNavbarContext().lang;
  const { open, panelId } = useNavbarContext();

  return (
    <div
      className="grid md:hidden"
      style={{
        gridTemplateRows: open ? "1fr" : "0fr",
        transition: "grid-template-rows 200ms ease-in-out",
      }}
    >
      <div className="overflow-hidden">
        <nav
          aria-hidden={!open}
          aria-label={lang.mobile}
          className={cn(
            "flex flex-col gap-1 border-t border-border px-4 py-4",
            className,
          )}
          id={panelId}
          inert={!open}
          {...props}
        >
          {children}
        </nav>
      </div>
    </div>
  );
}

export const Navbar = {
  Actions: NavbarActions,
  Bar: NavbarBar,
  Brand: NavbarBrand,
  Item: NavbarItem,
  ItemContent: NavbarItemContent,
  ItemTrigger: NavbarItemTrigger,
  Link: NavbarLink,
  MobilePanel: NavbarMobilePanel,
  Nav: NavbarNav,
  Root: NavbarRoot,
  Trigger: NavbarTrigger,
};
