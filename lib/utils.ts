import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind CSS classes with clsx for conditional class composition.
 * Used throughout all components for className prop merging.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extracts plain text from a TinaCMS rich-text AST.
 *
 * TinaCMS stores rich-text fields as a JSON AST (not raw Markdown).
 * This utility recursively walks the tree to extract text nodes,
 * which is needed for SEO meta descriptions and search indexing.
 *
 * @param content - The TinaCMS rich-text AST node (or root object)
 * @returns Concatenated plain text from all text nodes
 */
export function richTextToPlainText(content: unknown): string {
  if (!content) return "";
  if (typeof content === "string") return content;

  if (typeof content !== "object") return "";
  const node = content as Record<string, unknown>;

  if (node.text && typeof node.text === "string") return node.text;

  if (Array.isArray(node)) {
    return node.map(richTextToPlainText).join("");
  }

  if (Array.isArray(node.children)) {
    return node.children.map(richTextToPlainText).join("");
  }

  return "";
}
