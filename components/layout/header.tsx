/**
 * Header — Top navigation bar for the site.
 *
 * Displays the site name (from global settings) with hard-coded nav links
 * for MVP: Bosses and About. CMS-editable nav can be added in Phase 2.
 *
 * Mobile menu uses a simple useState toggle with CSS transitions —
 * only 2 links, so a full dialog/popover library is overkill.
 *
 * See docs/SPEC.md Section 5.2 for the project structure.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Hard-coded nav links for MVP. CMS-editable nav can be added in Phase 2. */
const NAV_LINKS = [
  { href: "/bosses", label: "Bosses" },
  { href: "/about", label: "About" },
] as const;

interface HeaderProps {
  siteName?: string | null;
}

export function Header({ siteName }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <nav className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Site name / logo — links to home */}
        <Link href="/" className="text-sm font-bold text-accent hover:text-accent/80 transition-colors">
          {siteName || "WWM Boss Guide"}
        </Link>

        {/* Desktop nav links */}
        <div className="hidden sm:flex items-center gap-4">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Mobile hamburger toggle */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="sm:hidden p-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Toggle navigation menu"
          aria-expanded={isMobileMenuOpen}
        >
          <svg
            className="size-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            {isMobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu — slides down with transition */}
      <div
        className={cn(
          "sm:hidden overflow-hidden border-t border-border transition-all duration-200",
          isMobileMenuOpen ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="px-4 py-3 space-y-2">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
