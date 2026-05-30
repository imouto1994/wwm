/**
 * Custom 404 page — themed to match the dark wuxia design.
 *
 * Shown when a user visits a non-existent route (e.g. /bosses/fake-boss).
 * See docs/SPEC.md Section 4.3 "Empty & Error States".
 */
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-6xl font-bold text-accent mb-4">404</h1>
      <p className="text-lg text-muted-foreground mb-6">
        This path leads nowhere. The boss you seek does not exist.
      </p>
      <Link
        href="/bosses"
        className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent/80 transition-colors"
      >
        Browse all bosses
      </Link>
    </div>
  );
}
