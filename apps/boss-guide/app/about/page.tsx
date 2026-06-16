/**
 * About page — project description, disclaimer, and contribution guide.
 *
 * Static page with the fan project disclaimer required by docs/SPEC.md
 * Section 13 and a link to the CMS admin for contributors.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description:
    "About the WWM Boss Guide — an unofficial fan project for Where Winds Meet.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold text-accent mb-6">About</h1>

      <div className="prose prose-invert prose-sm max-w-none space-y-6">
        {/* Project description */}
        <section>
          <h2>What is this?</h2>
          <p>
            The <strong>WWM Boss Guide</strong> is a community-driven moveset
            encyclopedia for <em>Where Winds Meet</em>. For each boss, we
            provide short looping video clips demonstrating how to parry or
            dodge every attack, along with descriptions of timing, inputs,
            and strategy.
          </p>
        </section>

        {/* How to contribute */}
        <section>
          <h2>Contributing</h2>
          <p>
            This site is powered by{" "}
            <a
              href="https://tina.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              TinaCMS
            </a>
            , a Git-based headless CMS. Content editors can add and update
            bosses through the visual editor:
          </p>
          <p>
            <Link href="/admin" className="text-accent hover:underline">
              Open the CMS Editor →
            </Link>
          </p>
          <p>
            To contribute video clips, record your gameplay showing the boss
            attack and your counter (parry, dodge, jump, etc.), then compress
            it to WebM format (720p, VP9 codec, under 1 MB). Upload it through
            the CMS media manager.
          </p>
        </section>

        {/* Legal disclaimer */}
        <section>
          <h2>Disclaimer</h2>
          <p>
            <em>Where Winds Meet</em> is developed by Everstone Studios. This
            web app is an <strong>unofficial fan project</strong> and is not
            affiliated with or endorsed by Everstone Studios.
          </p>
          <ul>
            <li>
              Boss names and in-game terminology are used for informational and
              educational purposes.
            </li>
            <li>
              Video clips are original gameplay recordings, not ripped game
              assets.
            </li>
            <li>
              No game source code, data-mined assets, or proprietary files are
              included.
            </li>
            <li>
              If the developer or publisher requests takedown, we will comply
              promptly.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
