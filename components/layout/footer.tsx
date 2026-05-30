/**
 * Footer — Site footer with fan project disclaimer and social links.
 *
 * Displays the legal disclaimer required by docs/SPEC.md Section 13,
 * optional social links from global settings, and TinaCMS attribution.
 * The footer content (rich-text) from global settings is rendered via
 * TinaMarkdown if provided.
 */
import { TinaMarkdown } from "tinacms/dist/rich-text";
import Link from "next/link";

interface SocialLink {
  platform: string;
  url: string;
}

interface FooterProps {
  socialLinks?: (SocialLink | null)[] | null;
  footerContent?: Parameters<typeof TinaMarkdown>[0]["content"];
}

export function Footer({ socialLinks, footerContent }: FooterProps) {
  const validLinks = socialLinks?.filter(
    (link): link is SocialLink => link !== null && !!link.url
  );

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8 space-y-4">
        {/* CMS-managed footer content (rich text) */}
        {footerContent && (
          <div className="prose prose-invert prose-sm max-w-none text-muted-foreground">
            <TinaMarkdown content={footerContent} />
          </div>
        )}

        {/* Social links */}
        {validLinks && validLinks.length > 0 && (
          <div className="flex flex-wrap gap-4">
            {validLinks.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-accent transition-colors"
              >
                {link.platform}
              </a>
            ))}
          </div>
        )}

        {/* Fan project disclaimer (always visible — required by SPEC Section 13) */}
        <p className="text-xs text-muted-foreground/60">
          This is an unofficial fan project. <em>Where Winds Meet</em> is developed
          by Everstone Studios. Not affiliated with or endorsed by Everstone Studios.
        </p>

        {/* Attribution */}
        <div className="flex items-center justify-between text-xs text-muted-foreground/40">
          <span>
            Powered by{" "}
            <a
              href="https://tina.io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
            >
              TinaCMS
            </a>
          </span>
          <Link href="/admin" className="hover:text-accent transition-colors">
            Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
