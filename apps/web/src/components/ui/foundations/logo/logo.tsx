"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "../../utils/tailwind/cn";

const logoVariants = {
  mark: cva("shrink-0 text-foreground", {
    defaultVariants: {
      size: "md",
    },
    variants: {
      size: {
        lg: "size-8",
        md: "size-6",
        sm: "size-5",
      },
    },
  }),
  root: cva(
    "inline-flex w-fit flex-row items-center rounded-sm font-primary text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
    {
      defaultVariants: {
        size: "md",
      },
      variants: {
        size: {
          lg: "gap-3",
          md: "gap-2",
          sm: "gap-2",
        },
      },
    },
  ),
  text: cva("font-semibold leading-none tracking-tight", {
    defaultVariants: {
      size: "md",
    },
    variants: {
      size: {
        lg: "text-xl",
        md: "text-base",
        sm: "text-sm",
      },
    },
  }),
};

export type LogoSize = NonNullable<
  VariantProps<typeof logoVariants.root>["size"]
>;

interface LogoContextValue {
  size: LogoSize;
}

const LogoContext = React.createContext<LogoContextValue | null>(null);

function useLogoContext() {
  const context = React.useContext(LogoContext);
  if (!context) {
    throw new Error("Logo compound components must be used inside <Logo>.");
  }
  return context;
}

export interface LogoProps extends React.HTMLAttributes<HTMLElement> {
  /**
   * Size of the mark and the wordmark, which scale together.
   * @default "md"
   */
  size?: LogoSize;
  /** Turns the logo into a link (usually the home page). Without it the logo renders as a plain, non-interactive `span`. */
  href?: string;
}

/**
 * Root of the compound logo. Groups `Logo.Mark` with `Logo.Text` and keeps
 * them aligned and scaled together. Renders an `<a>` when `href` is set
 * (not `next/link`, so it works outside Next.js — wrap it for client-side
 * navigation) and a `<span>` otherwise. When the logo has no `Logo.Text`,
 * pass `aria-label` so it still has an accessible name.
 * @example
 * ```tsx
 * <Logo href="/">
 *   <Logo.Mark />
 *   <Logo.Text>Acme</Logo.Text>
 * </Logo>
 * ```
 */
function LogoRoot({
  children,
  className,
  href,
  size = "md",
  ...props
}: LogoProps) {
  const classes = cn(
    logoVariants.root({
      size,
    }),
    className,
  );

  return (
    <LogoContext.Provider
      value={{
        size,
      }}
    >
      {href ? (
        <a
          className={classes}
          href={href}
          {...props}
        >
          {children}
        </a>
      ) : (
        <span
          className={classes}
          {...props}
        >
          {children}
        </span>
      )}
    </LogoContext.Provider>
  );
}

export interface LogoMarkProps extends React.SVGAttributes<SVGSVGElement> {
  /** Replaces the default placeholder glyph with your own mark (`<path>`s, `<g>`…), drawn in a 24×24 viewBox and inheriting `currentColor`. For a raster/remote mark, skip `Logo.Mark` and render an `<img>` directly inside `Logo`. */
  children?: React.ReactNode;
}

/**
 * The brand glyph. Ships a neutral placeholder (a filled rounded square with
 * a knocked-out circle) drawn in `currentColor`, so it follows the theme;
 * pass `children` to draw your own. Decorative by default (`aria-hidden`),
 * since the wordmark or the root's `aria-label` names the logo.
 */
function LogoMark({ children, className, ...props }: LogoMarkProps) {
  const { size } = useLogoContext();

  return (
    <svg
      aria-hidden="true"
      className={cn(
        logoVariants.mark({
          size,
        }),
        className,
      )}
      fill="currentColor"
      focusable="false"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {children ?? (
        <>
          <rect
            height="24"
            rx="6"
            width="24"
          />
          <circle
            className="fill-background"
            cx="12"
            cy="12"
            r="5"
          />
        </>
      )}
    </svg>
  );
}

export interface LogoTextProps extends React.HTMLAttributes<HTMLSpanElement> {}

/** The wordmark — the product name set in the interface typeface next to the mark. */
function LogoText({ children, className, ...props }: LogoTextProps) {
  const { size } = useLogoContext();

  return (
    <span
      className={cn(
        logoVariants.text({
          size,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

/**
 * Compound logo lockup.
 * @example
 * ```tsx
 * <Logo href="/" size="lg">
 *   <Logo.Mark />
 *   <Logo.Text>Acme</Logo.Text>
 * </Logo>
 * ```
 */
export const Logo = Object.assign(LogoRoot, {
  Mark: LogoMark,
  Text: LogoText,
});
