"use client";

import { type LucideIcon, PanelLeft, Search, X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import { Avatar } from "../../data-display/avatar/avatar";
import { Icon } from "../../foundations/icon/icon";
import { Kbd } from "../../foundations/kbd/kbd";
import { useEscapeKey } from "../../overlays-feedback/modal/modal";
import { cn } from "../../utils/tailwind/cn";

interface SidebarContextValue {
  readonly lang: SidebarLang;
  readonly collapsed: boolean;
  readonly setCollapsed: (collapsed: boolean) => void;
  readonly mobileOpen: boolean;
  readonly setMobileOpen: (open: boolean) => void;
}

/** Texts rendered by `Sidebar`'s controls. Pass `lang` to `Sidebar.Root` to override any of them. */
export interface SidebarLang {
  /** Accessible name of the button that expands a collapsed sidebar. */
  expandSidebar: string;
  /** Accessible name of the button that collapses the sidebar. */
  collapseSidebar: string;
  /** Accessible name of the mobile close button. */
  closeMenu: string;
  /** Accessible name of the navigation landmark. */
  primary: string;
}

/** English defaults for `SidebarLang`. */
export const defaultSidebarLang: SidebarLang = {
  closeMenu: "Close menu",
  collapseSidebar: "Collapse sidebar",
  expandSidebar: "Expand sidebar",
  primary: "Primary",
};

const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebarContext() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error(
      "Sidebar subcomponents must be used within <Sidebar.Root>.",
    );
  }
  return context;
}

export interface SidebarRootProps
  extends Omit<React.HTMLAttributes<HTMLElement>, "children" | "lang"> {
  /**
   * Texts rendered by the controls. Merges over English defaults.
   * @default defaultSidebarLang
   */
  lang?: Partial<SidebarLang>;
  /** Desktop icon-rail collapse state, for controlled usage — drive this from your own store/router if you have one. */
  collapsed?: boolean;
  /** Initial collapsed state, for uncontrolled usage. @default false */
  defaultCollapsed?: boolean;
  /** Called whenever the collapsed state changes, controlled or not. */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Mobile off-canvas open state, for controlled usage. */
  mobileOpen?: boolean;
  /** Initial mobile-open state, for uncontrolled usage. @default false */
  defaultMobileOpen?: boolean;
  /** Called whenever the mobile-open state changes, controlled or not. */
  onMobileOpenChange?: (open: boolean) => void;
  children?: React.ReactNode;
}

/**
 * Compound app sidebar — a persistent, collapsible-to-icon-rail nav on
 * desktop that becomes an off-canvas drawer below `md` (768px, the same
 * breakpoint `Navbar` switches at). Every piece of state a real app would
 * otherwise reach into a store or the router for — `collapsed`, `mobileOpen`,
 * which `Sidebar.NavItem` is `active` — is a plain prop instead, so this
 * component has no framework/store coupling: run it fully self-contained
 * (uncontrolled) for a quick setup, or control every piece of state from
 * your own router/store when you need them to agree with the rest of the
 * app. Collapsed styling only ever applies at `md` and up — the mobile
 * drawer always shows full labels, since an icon-only rail makes no sense
 * as a slide-in overlay.
 * @example
 * ```tsx
 * // Self-contained:
 * <Sidebar.Root>
 *   <Sidebar.Header>
 *     <Sidebar.Brand href="/">Acme</Sidebar.Brand>
 *     <Sidebar.CollapseTrigger />
 *     <Sidebar.MobileCloseTrigger />
 *   </Sidebar.Header>
 *   <Sidebar.SearchTrigger onClick={openCommandPalette} shortcut={["⌘", "K"]} />
 *   <Sidebar.Nav>
 *     <Sidebar.NavItem active href="/" icon={Home}>Home</Sidebar.NavItem>
 *     <Sidebar.NavGroup label="Settings">
 *       <Sidebar.NavItem badge={3} href="/notifications" icon={Bell}>Notifications</Sidebar.NavItem>
 *     </Sidebar.NavGroup>
 *   </Sidebar.Nav>
 *   <Sidebar.Footer>
 *     <Sidebar.Profile email="jane@acme.com" href="/profile" name="Jane Doe" />
 *   </Sidebar.Footer>
 * </Sidebar.Root>
 *
 * // Driven by your own router/store:
 * <Sidebar.Root
 *   collapsed={isCollapsed}
 *   mobileOpen={isMobileOpen}
 *   onCollapsedChange={setIsCollapsed}
 *   onMobileOpenChange={setIsMobileOpen}
 * >
 *   <Sidebar.Nav>
 *     <Sidebar.NavItem active={pathname === "/"} href="/" icon={Home}>Home</Sidebar.NavItem>
 *   </Sidebar.Nav>
 * </Sidebar.Root>
 * ```
 */
function SidebarRoot({
  lang,
  collapsed: controlledCollapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  mobileOpen: controlledMobileOpen,
  defaultMobileOpen = false,
  onMobileOpenChange,
  className,
  children,
  ...props
}: SidebarRootProps) {
  const resolvedLang = {
    ...defaultSidebarLang,
    ...lang,
  };
  const [uncontrolledCollapsed, setUncontrolledCollapsed] =
    React.useState(defaultCollapsed);
  const isCollapsedControlled = controlledCollapsed !== undefined;
  const collapsed = isCollapsedControlled
    ? controlledCollapsed
    : uncontrolledCollapsed;

  const [uncontrolledMobileOpen, setUncontrolledMobileOpen] =
    React.useState(defaultMobileOpen);
  const isMobileOpenControlled = controlledMobileOpen !== undefined;
  const mobileOpen = isMobileOpenControlled
    ? controlledMobileOpen
    : uncontrolledMobileOpen;

  const setCollapsed = React.useCallback(
    (value: boolean) => {
      if (!isCollapsedControlled) setUncontrolledCollapsed(value);
      onCollapsedChange?.(value);
    },
    [
      isCollapsedControlled,
      onCollapsedChange,
    ],
  );

  const setMobileOpen = React.useCallback(
    (value: boolean) => {
      if (!isMobileOpenControlled) setUncontrolledMobileOpen(value);
      onMobileOpenChange?.(value);
    },
    [
      isMobileOpenControlled,
      onMobileOpenChange,
    ],
  );

  useEscapeKey(mobileOpen, () => setMobileOpen(false));

  React.useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [
    mobileOpen,
  ]);

  const value = React.useMemo<SidebarContextValue>(
    () => ({
      lang: resolvedLang,
      collapsed,
      mobileOpen,
      setCollapsed,
      setMobileOpen,
    }),
    [
      resolvedLang,
      collapsed,
      mobileOpen,
      setCollapsed,
      setMobileOpen,
    ],
  );

  return (
    <SidebarContext.Provider value={value}>
      {mobileOpen && (
        // biome-ignore lint/a11y/useSemanticElements: dimming backdrop, needs to be an absolutely-positioned div, not a <button>
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-overlay transition-opacity duration-300 ease-in-out md:hidden motion-reduce:transition-none"
          onClick={() => setMobileOpen(false)}
          role="button"
          tabIndex={-1}
        />
      )}
      <aside
        className={cn(
          "flex h-screen w-72 max-w-[85vw] shrink-0 flex-col gap-4 border-r border-border bg-background px-4 py-4",
          "fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out motion-reduce:transition-none",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          "md:sticky md:inset-auto md:top-0 md:z-auto md:max-w-none md:translate-x-0 md:transition-[width] md:duration-300 md:ease-in-out",
          collapsed ? "md:w-16 md:px-3" : "md:w-64",
          className,
        )}
        {...props}
      >
        {children}
      </aside>
    </SidebarContext.Provider>
  );
}

export interface SidebarHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Top row of the sidebar — typically `Sidebar.Brand` plus `Sidebar.CollapseTrigger`/`Sidebar.MobileCloseTrigger`. Re-centers its (now lone) trigger once collapsed hides `Sidebar.Brand`, instead of leaving it pinned to the end from `justify-between`. */
function SidebarHeader({ className, children, ...props }: SidebarHeaderProps) {
  const { collapsed } = useSidebarContext();

  return (
    <div
      className={cn(
        "flex h-8 shrink-0 items-center justify-between gap-2",
        collapsed && "md:justify-center md:gap-0",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface SidebarBrandProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {}

/** Wordmark/logo slot in `Sidebar.Header`. Hides (rather than shrinking) once collapsed on desktop, since a logo mark rarely reads as an icon-rail glyph. */
function SidebarBrand({ className, children, ...props }: SidebarBrandProps) {
  const { collapsed } = useSidebarContext();

  return (
    <a
      className={cn(
        "flex min-w-0 shrink-0 items-center gap-2 overflow-hidden font-primary text-sm font-semibold text-foreground",
        "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
        collapsed && "md:w-0 md:opacity-0",
        className,
      )}
      {...props}
    >
      {children}
    </a>
  );
}

const sidebarIconButtonClassName =
  "flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 ease-in-out hover:bg-muted hover:text-foreground focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!";

export interface SidebarCollapseTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {}

/** Desktop-only button toggling `collapsed`. Hidden below `md`, where `Sidebar.MobileCloseTrigger` takes over. */
function SidebarCollapseTrigger({
  className,
  onClick,
  ...props
}: SidebarCollapseTriggerProps) {
  const lang = useSidebarContext().lang;
  const { collapsed, setCollapsed } = useSidebarContext();

  return (
    <button
      aria-expanded={!collapsed}
      aria-label={collapsed ? lang.expandSidebar : lang.collapseSidebar}
      className={cn(sidebarIconButtonClassName, "hidden md:flex", className)}
      onClick={(event) => {
        onClick?.(event);
        setCollapsed(!collapsed);
      }}
      type="button"
      {...props}
    >
      <Icon
        aria-hidden="true"
        icon={PanelLeft}
        size="md"
      />
    </button>
  );
}

export interface SidebarMobileCloseTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {}

/** Mobile-only button closing the off-canvas drawer. Hidden at `md` and up, where `Sidebar.CollapseTrigger` takes over. */
function SidebarMobileCloseTrigger({
  className,
  onClick,
  ...props
}: SidebarMobileCloseTriggerProps) {
  const lang = useSidebarContext().lang;
  const { setMobileOpen } = useSidebarContext();

  return (
    <button
      aria-label={lang.closeMenu}
      className={cn(sidebarIconButtonClassName, "md:hidden", className)}
      onClick={(event) => {
        onClick?.(event);
        setMobileOpen(false);
      }}
      type="button"
      {...props}
    >
      <Icon
        aria-hidden="true"
        icon={X}
        size="md"
      />
    </button>
  );
}

export interface SidebarSearchTriggerProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Shortcut keys shown at the trigger's end (e.g. `["⌘", "K"]`) — pass the platform-appropriate modifier from your own app; omit for no hint. */
  shortcut?: readonly string[];
}

/** "Search"/command-palette trigger — wire `onClick` to whatever opens your search UI. Stays full-width even once collapsed (same pattern as `Sidebar.NavItem`/`Sidebar.Profile`) — only its label/shortcut hide and its icon re-centers, so it never shrinks narrower than the rail around it. */
function SidebarSearchTrigger({
  shortcut,
  className,
  ...props
}: SidebarSearchTriggerProps) {
  const { collapsed } = useSidebarContext();

  return (
    <SidebarHint label="Search">
      <button
        className={cn(
          "flex h-9 w-full shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 font-primary text-sm text-muted-foreground transition-colors duration-150 ease-in-out hover:bg-muted hover:text-foreground",
          "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
          collapsed && "md:justify-center md:px-0",
          className,
        )}
        type="button"
        {...props}
      >
        <Icon
          aria-hidden="true"
          icon={Search}
          size="md"
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-left",
            collapsed && "md:hidden",
          )}
        >
          Search
        </span>
        {shortcut && shortcut.length > 0 && (
          <Kbd.Group className={cn(collapsed && "md:hidden")}>
            {shortcut.map((key) => (
              <Kbd key={key}>{key}</Kbd>
            ))}
          </Kbd.Group>
        )}
      </button>
    </SidebarHint>
  );
}

export interface SidebarNavProps extends React.HTMLAttributes<HTMLElement> {}

/** Scrollable nav landmark — holds `Sidebar.NavItem`/`Sidebar.NavGroup` in a `<ul>`. */
function SidebarNav({ className, children, ...props }: SidebarNavProps) {
  const lang = useSidebarContext().lang;
  return (
    <nav
      aria-label={lang.primary}
      className={cn("flex-1 overflow-x-hidden overflow-y-auto", className)}
      {...props}
    >
      <ul className="flex flex-col gap-1">{children}</ul>
    </nav>
  );
}

export interface SidebarNavGroupProps
  extends React.HTMLAttributes<HTMLLIElement> {
  /** Group heading shown above its items — hidden while collapsed, since there's no room for it in the icon rail. */
  label: string;
}

/** Labeled cluster of `Sidebar.NavItem`s inside `Sidebar.Nav`. */
function SidebarNavGroup({
  label,
  className,
  children,
  ...props
}: SidebarNavGroupProps) {
  const { collapsed } = useSidebarContext();

  return (
    <li
      className={cn("flex flex-col", className)}
      {...props}
    >
      <span
        className={cn(
          "px-2.5 pt-4 pb-1.5 font-primary text-xs font-medium text-muted-foreground",
          collapsed && "md:hidden",
        )}
      >
        {label}
      </span>
      <ul className="flex flex-col gap-1">{children}</ul>
    </li>
  );
}

/** Small counter badge over a `Sidebar.NavItem`'s icon, e.g. an unread count. */
function SidebarNavBadge({ count }: { count?: number }) {
  if (!count || count <= 0) return null;

  return (
    <span
      aria-hidden="true"
      className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 font-secondary text-[0.625rem] leading-none font-semibold text-destructive-foreground ring-2 ring-background"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export interface SidebarNavItemProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Marks this as the current page — full-ink label, a subtle fill, and a left accent bar. */
  active?: boolean;
  /** Icon shown before the label. */
  icon?: LucideIcon;
  /** Small counter shown over the icon (e.g. unread count); also appended to the link's accessible name. Values over 9 show as "9+". */
  badge?: number;
}

/** One nav link. Renders a plain `<a>` — wrap it with your framework's own `Link` (e.g. pass its props through) if you need client-side routing/prefetch. Closes `Sidebar.Root`'s mobile drawer on click. */
function SidebarNavItem({
  active = false,
  icon,
  badge,
  className,
  children,
  onClick,
  ...props
}: SidebarNavItemProps) {
  const { collapsed, setMobileOpen } = useSidebarContext();
  const label = typeof children === "string" ? children : undefined;

  return (
    <li className="relative">
      <SidebarHint label={label}>
        <a
          aria-current={active ? "page" : undefined}
          className={cn(
            "group flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 font-primary text-sm transition-colors duration-150 ease-in-out",
            "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
            collapsed && "md:justify-center md:px-0",
            active
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
            className,
          )}
          onClick={(event) => {
            onClick?.(event);
            setMobileOpen(false);
          }}
          title={collapsed ? undefined : label}
          {...props}
        >
          {icon && (
            <span className="relative shrink-0">
              <Icon
                aria-hidden="true"
                icon={icon}
                size="md"
              />
              <SidebarNavBadge count={badge} />
            </span>
          )}
          <span
            className={cn("min-w-0 flex-1 truncate", collapsed && "md:hidden")}
          >
            {children}
            {!!badge && badge > 0 && (
              <span className="sr-only">
                {" "}
                ({badge > 9 ? "9+" : badge} unread)
              </span>
            )}
          </span>
        </a>
      </SidebarHint>
    </li>
  );
}

export interface SidebarFooterProps
  extends React.HTMLAttributes<HTMLDivElement> {}

/** Bottom-anchored area below `Sidebar.Nav` — typically `Sidebar.Profile`. */
function SidebarFooter({ className, children, ...props }: SidebarFooterProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-2 border-t border-border pt-3",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface SidebarProfileProps
  extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Full name, shown as the primary line and used to derive the avatar fallback initials. */
  name: string;
  /** Secondary line under the name, e.g. an email. */
  email?: string;
  /** Avatar image; falls back to initials derived from `name` when omitted or on load failure. */
  avatarUrl?: string;
}

/** Account footer — avatar (or initials fallback), name, and email, linking to a profile/account page. Collapses to just the avatar on desktop. */
function SidebarProfile({
  name,
  email,
  avatarUrl,
  className,
  ...props
}: SidebarProfileProps) {
  const { collapsed } = useSidebarContext();
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <SidebarHint label={name}>
      <a
        className={cn(
          "flex items-center gap-2.5 rounded-md p-1.5 transition-colors duration-150 ease-in-out hover:bg-muted",
          "focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!",
          collapsed && "md:justify-center md:px-0",
          className,
        )}
        {...props}
      >
        <Avatar
          className="shrink-0"
          size="sm"
        >
          {avatarUrl && (
            <Avatar.Img
              alt={name}
              src={avatarUrl}
            />
          )}
          <Avatar.Skeleton />
          <Avatar.Fallback className="bg-muted text-xs font-semibold text-muted-foreground">
            {initials}
          </Avatar.Fallback>
        </Avatar>
        <span
          className={cn(
            "flex min-w-0 flex-1 flex-col text-left",
            collapsed && "md:hidden",
          )}
        >
          <span className="truncate font-primary text-sm font-medium text-foreground">
            {name}
          </span>
          {email && (
            <span className="truncate font-primary text-xs text-muted-foreground">
              {email}
            </span>
          )}
        </span>
      </a>
    </SidebarHint>
  );
}

export interface SidebarHintProps
  extends Omit<React.HTMLAttributes<HTMLSpanElement>, "children"> {
  /** The element that shows only an icon in the collapsed rail. */
  readonly children: React.ReactNode;
  /** Text shown beside the wrapped element while the rail is collapsed and hovered or focused. Nothing is shown when omitted. */
  readonly label?: string;
}

/** Hover/focus label for an element that shows only an icon in the collapsed desktop rail. Does nothing while expanded or in the mobile drawer, where labels are already visible. */
function SidebarHint({
  label,
  className,
  children,
  ...props
}: SidebarHintProps) {
  const { collapsed } = useSidebarContext();
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  const show = () => {
    if (
      !label ||
      !collapsed ||
      !anchorRef.current ||
      !window.matchMedia("(min-width: 768px)").matches
    )
      return;
    setRect(anchorRef.current.getBoundingClientRect());
  };
  const hide = () => setRect(null);

  React.useEffect(() => {
    if (!collapsed) setRect(null);
  }, [
    collapsed,
  ]);

  return (
    <span
      className={cn("block", className)}
      onBlur={hide}
      onClick={hide}
      onFocus={show}
      onMouseEnter={show}
      onMouseLeave={hide}
      ref={anchorRef}
      {...props}
    >
      {children}
      {rect &&
        collapsed &&
        createPortal(
          <div
            className="pointer-events-none fixed z-50 max-w-60 -translate-y-1/2 truncate rounded-md border border-border bg-background px-2.5 py-1.5 font-primary text-sm text-foreground shadow-sm"
            role="tooltip"
            style={{
              top: rect.top + rect.height / 2,
              left: rect.right + 12,
            }}
          >
            {label}
          </div>,
          document.body,
        )}
    </span>
  );
}

export const Sidebar = Object.assign(SidebarRoot, {
  Brand: SidebarBrand,
  CollapseTrigger: SidebarCollapseTrigger,
  Footer: SidebarFooter,
  Header: SidebarHeader,
  Hint: SidebarHint,
  MobileCloseTrigger: SidebarMobileCloseTrigger,
  Nav: SidebarNav,
  NavGroup: SidebarNavGroup,
  NavItem: SidebarNavItem,
  Profile: SidebarProfile,
  SearchTrigger: SidebarSearchTrigger,
});
