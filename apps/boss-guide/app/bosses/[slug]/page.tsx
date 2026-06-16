/**
 * Boss detail page — the core page of the app.
 *
 * Shows the boss hero section (thumbnail, metadata, description) followed
 * by the complete moveset list with autoplay WebM clips.
 *
 * Uses generateStaticParams() for SSG at build time and generateMetadata()
 * for SEO. Falls back to notFound() for invalid slugs.
 *
 * See docs/SPEC.md Section 5.3 for routing and Section 8.1 for user flows.
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import client from "@/tina/__generated__/client";
import { BossHero } from "@/components/boss/boss-hero";
import { MoveList } from "@/components/boss/move-list";
import { richTextToPlainText } from "@/lib/utils";

interface BossPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Pre-generate pages for all bosses at build time.
 * TinaCMS provides the list of filenames via bossConnection.
 */
export async function generateStaticParams() {
  try {
    const { data } = await client.queries.bossConnection();
    return (
      data.bossConnection.edges
        ?.filter((edge) => edge?.node)
        .map((edge) => ({
          slug: edge!.node!._sys.filename,
        })) ?? []
    );
  } catch {
    return [];
  }
}

/**
 * Dynamic SEO metadata per boss.
 * Uses richTextToPlainText to extract a plain-text summary from the
 * TinaCMS rich-text AST for the meta description.
 */
export async function generateMetadata({
  params,
}: BossPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const { data } = await client.queries.boss({
      relativePath: `${slug}.mdx`,
    });
    const boss = data.boss;

    const descriptionText = richTextToPlainText(boss.description);
    const truncated =
      descriptionText.length > 155
        ? descriptionText.slice(0, 155) + "…"
        : descriptionText;

    return {
      title: `${boss.name} Moveset Guide`,
      description:
        truncated ||
        `Complete moveset guide for ${boss.name} in Where Winds Meet.`,
    };
  } catch {
    return { title: "Boss Not Found" };
  }
}

export default async function BossPage({ params }: BossPageProps) {
  const { slug } = await params;

  let boss;
  try {
    const { data } = await client.queries.boss({
      relativePath: `${slug}.mdx`,
    });
    boss = data.boss;
  } catch {
    notFound();
  }

  if (!boss) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 py-8">
      <BossHero
        name={boss.name}
        thumbnail={boss.thumbnail}
        region={boss.region}
        difficulty={boss.difficulty}
        description={boss.description}
      />

      {/* Moveset section */}
      <section className="mt-8">
        <h2 className="text-xl font-bold text-foreground mb-6">Moveset</h2>
        <MoveList moves={boss.moves} />
      </section>
    </div>
  );
}
