import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import rehypeShiki from "@shikijs/rehype";
import { visit, SKIP } from "unist-util-visit";

/**
 * Resolves a wiki link title and label to a final link target.
 */
export type ResolveWikiLink = (
  title: string,
  label: string,
) => {
  href: string | null;
  label: string;
};

/**
 * Matches wiki link syntax like [[Title]] or [[Title|Label]].
 */
const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Text node in a markdown AST.
 */
type TextNode = {
  type: "text";
  value: string;
};

/**
 * Link node in a markdown AST.
 */
type LinkNode = {
  type: "link";
  url: string;
  title?: string | null;
  children: TextNode[];
  data?: {
    hProperties?: {
      className?: string;
    };
  };
};

/**
 * Root node for a markdown AST fragment.
 */
type RootNode = {
  type: "root";
  children: Array<TextNode | LinkNode>;
};

/**
 * Builds a link node for a resolved wiki link.
 */
const buildWikiLinkNode = (title: string, label: string, href: string | null): LinkNode => {
  const className = href
    ? "text-blue-600 underline decoration-blue-300 underline-offset-4"
    : "text-slate-400 underline decoration-dotted underline-offset-4";
  return {
    type: "link",
    url: href ?? "#",
    title,
    children: [{ type: "text", value: label }],
    data: {
      hProperties: {
        className,
      },
    },
  };
};

/**
 * Splits text into plain text and wiki link nodes.
 */
const splitTextWithWikiLinks = (
  value: string,
  resolveWikiLink: ResolveWikiLink,
): Array<TextNode | LinkNode> => {
  const nodes: Array<TextNode | LinkNode> = [];
  let lastIndex = 0;

  WIKI_LINK_PATTERN.lastIndex = 0;

  for (const match of value.matchAll(WIKI_LINK_PATTERN)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > lastIndex) {
      nodes.push({ type: "text", value: value.slice(lastIndex, matchIndex) });
    }

    const title = match[1]?.trim();
    if (!title) {
      lastIndex = matchIndex + match[0].length;
      continue;
    }

    const label = match[2]?.trim() || title;
    const resolved = resolveWikiLink(title, label);
    nodes.push(buildWikiLinkNode(title, resolved.label, resolved.href));

    lastIndex = matchIndex + match[0].length;
  }

  if (lastIndex < value.length) {
    nodes.push({ type: "text", value: value.slice(lastIndex) });
  }

  return nodes;
};

/**
 * Narrow unknown values to plain objects.
 */
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Checks if a node is a text node.
 */
const isTextNode = (node: unknown): node is TextNode => {
  if (!isRecord(node)) {
    return false;
  }
  return node["type"] === "text" && typeof node["value"] === "string";
};

/**
 * Checks if a node has children.
 */
const hasChildren = (node: unknown): node is RootNode => {
  if (!isRecord(node)) {
    return false;
  }
  return Array.isArray(node["children"]);
};

/**
 * Remark plugin that replaces wiki link text with link nodes.
 */
const remarkWikiLink = (options: { resolveWikiLink: ResolveWikiLink }) => {
  return (tree: RootNode) => {
    visit(tree, "text", (node, index, parent) => {
      if (!isTextNode(node) || !hasChildren(parent) || typeof index !== "number") {
        return;
      }

      WIKI_LINK_PATTERN.lastIndex = 0;
      if (!WIKI_LINK_PATTERN.test(node.value)) {
        return;
      }

      const replacement = splitTextWithWikiLinks(node.value, options.resolveWikiLink);
      if (replacement.length === 0) {
        return;
      }

      parent.children.splice(index, 1, ...replacement);
      return [SKIP, index + replacement.length];
    });
  };
};

/**
 * Sanitization schema for rendered markdown.
 */
const SANITIZED_SCHEMA: SanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "className"],
    pre: [...(defaultSchema.attributes?.["pre"] ?? []), "style"],
    code: [...(defaultSchema.attributes?.["code"] ?? []), "style"],
    span: [...(defaultSchema.attributes?.["span"] ?? []), "style"],
    ["a"]: [...(defaultSchema.attributes?.["a"] ?? []), ["className", /^[\w\s-:]+$/]],
  },
};

/**
 * Render markdown to HTML with wiki links.
 */
export const renderMarkdown = async (
  content: string,
  resolveWikiLink: ResolveWikiLink,
): Promise<string> => {
  const file = await unified()
    .use(remarkParse)
    .use(remarkWikiLink, { resolveWikiLink })
    .use(remarkRehype)
    .use(rehypeShiki, {
      theme: "github-light",
      langs: [
        "bash",
        "css",
        "html",
        "js",
        "java",
        "javascript",
        "json",
        "jsonc",
        "markdown",
        "md",
        "sql",
        "sh",
        "ts",
        "tsx",
        "jsx",
        "typescript",
        "yaml",
        "yml",
      ],
    })
    .use(rehypeSanitize, SANITIZED_SCHEMA)
    .use(rehypeStringify)
    .process(content);

  return String(file);
};
