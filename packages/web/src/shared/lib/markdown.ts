import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkFrontmatter from "remark-frontmatter";
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

type FrontmatterEntry = {
  key: string;
  value: string;
};

/**
 * Builds a link node for a resolved wiki link.
 */
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
 * Parses frontmatter into key/value entries (simple YAML).
 */
const parseFrontmatterEntries = (frontmatter: string): FrontmatterEntry[] => {
  return frontmatter
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf(":");
      if (index === -1) {
        return { key: line, value: "" };
      }
      const key = line.slice(0, index).trim();
      const value = line.slice(index + 1).trim();
      return { key, value };
    })
    .filter((entry) => entry.key.length > 0);
};

/**
 * Rehype plugin that converts YAML frontmatter into a table.
 */
const rehypeFrontmatterTable = () => {
  return (tree: { type: string; children?: unknown[] }) => {
    let handled = false;
    visit(tree, (node, index, parent) => {
      if (handled || !isRecord(node) || node["type"] !== "yaml") {
        return;
      }
      if (!parent || typeof index !== "number" || !isRecord(parent)) {
        return;
      }
      const value = typeof node["value"] === "string" ? node["value"] : "";
      const entries = value ? parseFrontmatterEntries(value) : [];
      const rows =
        entries.length > 0
          ? entries.map((entry) => ({
              type: "element",
              tagName: "tr",
              properties: {},
              children: [
                {
                  type: "element",
                  tagName: "th",
                  properties: {},
                  children: [{ type: "text", value: entry.key }],
                },
                {
                  type: "element",
                  tagName: "td",
                  properties: {},
                  children: [{ type: "text", value: entry.value }],
                },
              ],
            }))
          : [
              {
                type: "element",
                tagName: "tr",
                properties: {},
                children: [
                  {
                    type: "element",
                    tagName: "th",
                    properties: {},
                    children: [{ type: "text", value: "raw" }],
                  },
                  {
                    type: "element",
                    tagName: "td",
                    properties: {},
                    children: [{ type: "text", value }],
                  },
                ],
              },
            ];

      const section = {
        type: "element",
        tagName: "section",
        properties: { className: ["frontmatter"] },
        children: [
          {
            type: "element",
            tagName: "div",
            properties: { className: ["frontmatter-title"] },
            children: [{ type: "text", value: "Frontmatter" }],
          },
          {
            type: "element",
            tagName: "table",
            properties: {},
            children: [
              {
                type: "element",
                tagName: "tbody",
                properties: {},
                children: rows,
              },
            ],
          },
        ],
      };

      const parentNode = parent as { children?: unknown[] };
      if (!Array.isArray(parentNode.children)) {
        return;
      }
      parentNode.children.splice(index, 1, section);
      handled = true;
      return [SKIP, index + 1];
    });
  };
};

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
    ["a"]: [
      ...(defaultSchema.attributes?.["a"] ?? []),
      ["className", /^wiki-link(\s+unresolved)?$/],
    ],
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
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkWikiLink, { resolveWikiLink })
    .use(remarkRehype, { passThrough: ["yaml"] })
    .use(rehypeFrontmatterTable)
    .use(rehypeShiki, {
      theme: "github-light",
      langs: [
        "bash",
        "css",
        "html",
        "javascript",
        "json",
        "markdown",
        "sql",
        "tsx",
        "typescript",
        "yaml",
      ],
    })
    .use(rehypeSanitize, SANITIZED_SCHEMA)
    .use(rehypeStringify)
    .process(content);

  return String(file);
};
