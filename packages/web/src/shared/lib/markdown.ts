import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import { visit, SKIP } from "unist-util-visit";

import { extractWikiLinks, type WikiLink } from "./wiki-links";

export type ResolveWikiLink = (
  title: string,
  label: string,
) => {
  href: string | null;
  label: string;
};

const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

type TextNode = {
  type: "text";
  value: string;
};

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

type RootNode = {
  type: "root";
  children: Array<TextNode | LinkNode>;
};

const buildWikiLinkNode = (title: string, label: string, href: string | null): LinkNode => {
  const className = href ? "wiki-link" : "wiki-link unresolved";
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isTextNode = (node: unknown): node is TextNode => {
  if (!isRecord(node)) {
    return false;
  }
  return node["type"] === "text" && typeof node["value"] === "string";
};

const hasChildren = (node: unknown): node is RootNode => {
  if (!isRecord(node)) {
    return false;
  }
  return Array.isArray(node["children"]);
};

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
 * Render markdown to HTML with wiki links.
 */
export const renderMarkdown = async (
  content: string,
  resolveWikiLink: ResolveWikiLink,
): Promise<string> => {
  const sanitizedSchema: SanitizeSchema = {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      "*": [...(defaultSchema.attributes?.["*"] ?? []), "className"],
      ["a"]: [
        ...(defaultSchema.attributes?.["a"] ?? []),
        ["className", /^wiki-link(\s+unresolved)?$/],
      ],
    },
  };
  const file = await unified()
    .use(remarkParse)
    .use(remarkWikiLink, { resolveWikiLink })
    .use(remarkRehype)
    .use(rehypeSanitize, sanitizedSchema)
    .use(rehypeStringify)
    .process(content);

  return String(file);
};

/**
 * Build backlinks for a note title from other notes.
 */
export const buildBacklinks = (
  notes: Array<{ title: string; content: string }>,
  targetTitle: string,
): WikiLink[] => {
  const backlinks: WikiLink[] = [];

  for (const note of notes) {
    const links = extractWikiLinks(note.content);
    for (const link of links) {
      if (link.title === targetTitle) {
        backlinks.push({ title: note.title, label: note.title });
        break;
      }
    }
  }

  return backlinks;
};
