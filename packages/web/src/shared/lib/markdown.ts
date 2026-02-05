import sanitizeHtml from "sanitize-html";
import { createHighlighter, bundledLanguagesInfo } from "shiki";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeStringify from "rehype-stringify";
import { visit } from "unist-util-visit";

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

const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const FENCED_CODE_BLOCK_PATTERN = /(```+|~~~+)([^\n]*)\n([\s\S]*?)\1/g;
const INLINE_CODE_PATTERN = /(`+)([^\n]*?)\1/g;
const SUPPORTED_LANGUAGES = new Set(
  bundledLanguagesInfo.flatMap((language) => [language.id, ...(language.aliases ?? [])]),
);

const highlighterPromise = createHighlighter({
  themes: ["github-light"],
  langs: [...SUPPORTED_LANGUAGES],
});

const normalizeCodeLanguages: any = () => (tree: unknown) => {
  visit(tree as { children?: unknown[] }, "code", (node: { lang?: string }) => {
    const lang = node.lang?.toLowerCase();
    if (!lang || !SUPPORTED_LANGUAGES.has(lang)) {
      node.lang = "text";
    }
  });
};

const highlightCodeBlocks: any = () => async (tree: unknown) => {
  const targets: Array<{ node: { lang?: string; value?: string }; index: number; parent: any }> =
    [];
  visit(
    tree as { children?: unknown[] },
    "code",
    (node: { lang?: string; value?: string }, index: number | null, parent: any) => {
      if (!parent || typeof index !== "number") {
        return;
      }
      targets.push({ node, index, parent });
    },
  );

  const highlighter = await highlighterPromise;
  for (const { node, index, parent } of targets) {
    const lang = node.lang?.toLowerCase() ?? "text";
    const code = node.value ?? "";
    const highlighted = highlighter.codeToHtml(code, { lang, theme: "github-light" });
    parent.children[index] = { type: "html", value: highlighted };
  }
};

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(normalizeCodeLanguages)
  .use(highlightCodeBlocks)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeRaw)
  .use(rehypeStringify);

const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const escapeHtmlAttribute = (value: string): string =>
  escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const sanitizeHref = (href: string | null): string => {
  if (!href) {
    return "#";
  }
  const trimmed = href.trim();
  if (/^(javascript|data|vbscript):/i.test(trimmed)) {
    return "#";
  }
  return trimmed;
};

const buildWikiLinkClassName = (href: string | null): string =>
  href
    ? "wiki-link text-blue-600 underline decoration-blue-300 underline-offset-4"
    : "wiki-link unresolved text-slate-400 underline decoration-dotted underline-offset-4";

const buildWikiLinkHtml = (title: string, label: string, href: string | null): string => {
  const safeHref = sanitizeHref(href);
  return `<a href="${escapeHtmlAttribute(safeHref)}" title="${escapeHtmlAttribute(title)}" class="${buildWikiLinkClassName(href)}">${escapeHtml(label)}</a>`;
};

const maskCodeSpans = (content: string): string => {
  const maskedFenced = content.replace(FENCED_CODE_BLOCK_PATTERN, (match: string): string =>
    " ".repeat(match.length),
  );
  return maskedFenced.replace(INLINE_CODE_PATTERN, (match: string): string =>
    " ".repeat(match.length),
  );
};

const replaceWikiLinksWithHtml = (content: string, resolveWikiLink: ResolveWikiLink): string => {
  const maskedContent = maskCodeSpans(content);
  let result = "";
  let lastIndex = 0;

  WIKI_LINK_PATTERN.lastIndex = 0;
  for (const match of maskedContent.matchAll(WIKI_LINK_PATTERN)) {
    const matchIndex = match.index ?? 0;
    const fullMatch = match[0];
    if (!fullMatch) {
      continue;
    }

    result += content.slice(lastIndex, matchIndex);

    const title = match[1]?.trim();
    if (!title) {
      result += fullMatch;
      lastIndex = matchIndex + fullMatch.length;
      continue;
    }

    const label = match[2]?.trim() || title;
    const resolved = resolveWikiLink(title, label);
    result += buildWikiLinkHtml(title, resolved.label, resolved.href);
    lastIndex = matchIndex + fullMatch.length;
  }

  result += content.slice(lastIndex);
  return result;
};

const sanitizeRenderedHtml = (html: string): string =>
  sanitizeHtml(html, {
    allowedTags: [
      "a",
      "b",
      "blockquote",
      "br",
      "code",
      "del",
      "div",
      "em",
      "h1",
      "h2",
      "h3",
      "h4",
      "h5",
      "h6",
      "hr",
      "i",
      "kbd",
      "li",
      "ol",
      "p",
      "pre",
      "s",
      "span",
      "strong",
      "sub",
      "sup",
      "table",
      "tbody",
      "td",
      "th",
      "thead",
      "tr",
      "u",
      "ul",
    ],
    allowedAttributes: {
      a: ["href", "title", "class"],
      code: ["class"],
      pre: ["class", "tabindex", "style"],
      span: ["class", "style"],
      th: ["align"],
      td: ["align"],
    },
    allowedClasses: {
      a: ["wiki-link", "unresolved", "line"],
      pre: ["*"],
      code: ["*"],
      span: ["*"],
    },
    transformTags: {},
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    parser: {
      lowerCaseAttributeNames: true,
    },
  });

const stripUnsafeProtocols = (html: string): string =>
  html.replace(/(?:javascript|data|vbscript):/gi, "");

export const renderMarkdown = async (
  content: string,
  resolveWikiLink: ResolveWikiLink,
): Promise<string> => {
  const source = replaceWikiLinksWithHtml(content, resolveWikiLink);
  const html = String(await markdownProcessor.process(source));
  const safeHtml = stripUnsafeProtocols(sanitizeRenderedHtml(html));
  return safeHtml;
};
