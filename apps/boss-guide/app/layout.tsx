/**
 * Root layout — server component that wraps all pages.
 *
 * Fetches global settings from TinaCMS (site name, social links, footer
 * content) and renders the header and footer around page content. Since
 * this is the Next.js root layout, pages automatically inherit the
 * shell without manually wrapping in a <Layout> component.
 *
 * Theme: always dark via className="dark" on <html>. The wuxia palette
 * is defined in styles.css under the .dark selector.
 *
 * See docs/SPEC.md Section 5.2 and 5.3 for project structure and routing.
 */
import React from "react";
import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "@/styles.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import client from "@/tina/__generated__/client";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "WWM Boss Guide — Where Winds Meet Moveset Encyclopedia",
    template: "%s — WWM Boss Guide",
  },
  description:
    "The definitive moveset encyclopedia for Where Winds Meet. Learn to parry and dodge every boss attack with video guides.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Fetch global settings (site name, social links, footer) from TinaCMS.
  // With output: 'export', this runs at build time only — no ISR/revalidation.
  // To update the site, push to main and the GitHub Actions workflow rebuilds.
  const { data: globalData } = await client.queries.global({
    relativePath: "index.json",
  });

  const global = globalData.global;

  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Header siteName={global.siteName} />
        <main className="min-h-[calc(100vh-6rem)]">{children}</main>
        <Footer
          socialLinks={global.socialLinks}
          footerContent={global.footer}
        />
      </body>
    </html>
  );
}
