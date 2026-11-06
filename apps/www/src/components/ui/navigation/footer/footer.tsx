"use client";

import type * as React from "react";
import bgGranito from "../../assets/bg-granito.jpg";
import { Layout } from "../../layout/layout/layout";
import { cn } from "../../utils/tailwind/cn";

/**
 * Bundlers disagree on what an image import is: Vite gives the URL string,
 * Next.js gives a `StaticImageData` object (`{ src, width, height }`).
 * Interpolating the object would produce `url([object Object])`.
 */
const bgGranitoUrl: string =
  typeof bgGranito === "string"
    ? bgGranito
    : (bgGranito as { src: string }).src;

export interface FooterLink {
  /** Destination URL. Opens in a new tab (`target="_blank"`) whenever it's an absolute `http(s)` URL. */
  href: string;
  /** Visible link text. */
  label: string;
}

export interface FooterGroup {
  /** Column heading, e.g. `"Product"`. */
  heading: string;
  /** Links listed under this heading. */
  links: FooterLink[];
}

/** Any SVG icon component that accepts `className` — a Lucide icon or a custom inline brand mark both satisfy this. */
export type FooterSocialIcon = React.ComponentType<{
  className?: string;
}>;

export interface FooterSocialLink {
  /** Destination URL, e.g. the org's GitHub profile. */
  href: string;
  /** Accessible name for the icon-only link, e.g. `"Acme on GitHub"`. */
  label: string;
  /** Icon rendered inside the circular button. */
  icon: FooterSocialIcon;
}

export interface SiteFooterProps {
  /** Footer navigation, grouped into columns (e.g. Product, Resources, Company). Renders no link grid at all when empty. */
  groups: FooterGroup[];
  /** Social/profile links shown as icon buttons in the bottom row — pass as many or as few networks as apply. Renders no icon row when omitted. */
  socialLinks?: FooterSocialLink[];
  /** Copyright / legal line shown in the bottom row, e.g. `"© 2026 Acme — All rights reserved."` Renders nothing when omitted. */
  copyright?: string;
  /** Large watermark wordmark rendered at the bottom of the footer. Renders no watermark when omitted. */
  brandName?: string;
}

/**
 * Marketing-page footer: a responsive grid of link columns, a copyright/social
 * row, and an optional watermark wordmark — all driven entirely by props, no
 * content is baked into the component. The textured overlay, its mask, the
 * wordmark's gradient fill, and its translate-based centering are unchanged
 * from the source design — only color, type, and spacing were brought onto
 * this library's tokens and shadcn-equivalent scale.
 */
export function SiteFooter({
  groups,
  socialLinks,
  copyright,
  brandName,
}: SiteFooterProps) {
  const hasBottomRow = Boolean(copyright) || Boolean(socialLinks?.length);

  return (
    <footer
      className="relative overflow-hidden bg-background"
      id="footer"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-cover bg-center opacity-[0.07] mix-blend-multiply grayscale mask-[linear-gradient(to_bottom,transparent,black_180px)] dark:opacity-[0.10] dark:mix-blend-screen"
        style={{
          backgroundImage: `url(${bgGranitoUrl})`,
        }}
      />

      <Layout.Container
        className="relative pt-12 sm:pt-14 @container"
        size="lg"
      >
        {groups.length > 0 && (
          <div className="grid grid-cols-2 gap-8 border-b border-border pb-10 sm:grid-cols-3">
            {groups.map((group) => (
              <div
                className="flex flex-col gap-4"
                key={group.heading}
              >
                <span className="font-primary text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  {group.heading}
                </span>
                <ul className="flex flex-col gap-3">
                  {group.links.map((link) => (
                    // Keyed by label: two links can share an href (e.g. placeholders pointing to the same anchor).
                    <li key={link.label}>
                      <a
                        className="font-primary text-sm text-muted-foreground transition-colors duration-150 ease-in-out hover:text-foreground"
                        href={link.href}
                        rel={
                          link.href.startsWith("http")
                            ? "noreferrer noopener"
                            : undefined
                        }
                        target={
                          link.href.startsWith("http") ? "_blank" : undefined
                        }
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {hasBottomRow && (
          <div
            className={cn(
              "flex flex-col gap-5 pt-10 pb-10 sm:flex-row sm:items-center sm:justify-between",
              "animate-fade-in",
            )}
          >
            {copyright && (
              <span className="font-primary text-xs leading-relaxed text-muted-foreground">
                {copyright}
              </span>
            )}

            {socialLinks && socialLinks.length > 0 && (
              <div className="flex items-center gap-2">
                {socialLinks.map((social) => (
                  <a
                    aria-label={social.label}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors duration-150 ease-in-out hover:border-border-strong hover:text-foreground focus-visible:outline-2! focus-visible:outline-offset-2! focus-visible:outline-ring!"
                    href={social.href}
                    key={social.href}
                    rel="noreferrer noopener"
                    target="_blank"
                  >
                    <social.icon className="size-4" />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {brandName && (
          <div
            aria-hidden="true"
            className={cn(
              "relative h-[20cqw] w-full overflow-hidden select-none",
              "animate-fade-in",
            )}
          >
            <span className="absolute bottom-[-6.5cqw] left-1/2 -translate-x-1/2 bg-[linear-gradient(to_bottom,color-mix(in_oklch,var(--color-foreground)_50%,transparent)_0%,color-mix(in_oklch,var(--color-foreground)_10%,transparent)_55%,color-mix(in_oklch,var(--color-foreground)_2%,transparent)_100%)] bg-clip-text font-primary text-[28cqw] leading-[0.86] font-bold tracking-[-0.02em] whitespace-nowrap text-transparent">
              {brandName}
            </span>
          </div>
        )}
      </Layout.Container>
    </footer>
  );
}
