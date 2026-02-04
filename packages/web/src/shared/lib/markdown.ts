import { createHighlighter, bundledLanguagesInfo } from "shiki";

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
const CODE_BLOCK_HTML_PATTERN =
  /<pre><code(?: class="language-([^"]+)")?>([\s\S]*?)<\/code><\/pre>/g;
const BUN_MARKDOWN_OPTIONS: Bun.markdown.Options = {
  tables: true,
  strikethrough: true,
  tasklists: true,
  hardSoftBreaks: true,
  wikiLinks: true,
  underline: true,
  latexMath: true,
  collapseWhitespace: true,
  permissiveAtxHeaders: true,
  noIndentedCodeBlocks: false,
  noHtmlBlocks: false,
  noHtmlSpans: false,
  tagFilter: false,
  autolinks: true,
  headings: true,
};

const SUPPORTED_LANGUAGES = new Set(bundledLanguagesInfo.map((language) => language.id));

const highlighterPromise = createHighlighter({
  themes: ["github-light"],
  langs: [...SUPPORTED_LANGUAGES],
});

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
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*(javascript|data|vbscript):[\s\S]*?\2/gi, ' $1="#"');

const applyCodeBlockTheme = (html: string): string =>
  html.replace(
    /<pre>/g,
    '<pre style="background-color: #f6f8fa; color: #24292f; padding: 0.75rem; border-radius: 0.5rem; overflow-x: auto;">',
  );

const decodeHtml = (value: string): string =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const normalizeLanguage = (language: string | undefined): string => {
  if (!language) {
    return "text";
  }
  const normalized = language.toLowerCase();
  if (normalized === "text") {
    return "text";
  }
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : "text";
};

const highlightCodeBlocks = async (html: string): Promise<string> => {
  try {
    const highlighter = await highlighterPromise;
    const replacements = [...html.matchAll(CODE_BLOCK_HTML_PATTERN)];
    if (replacements.length === 0) {
      return html;
    }

    let output = html;
    for (const block of replacements) {
      const whole = block[0];
      const language = normalizeLanguage(block[1]);
      const code = decodeHtml(block[2] ?? "");
      const highlighted = highlighter.codeToHtml(code, {
        lang: language,
        theme: "github-light",
      });
      output = output.replace(whole, highlighted);
    }
    return output;
  } catch {
    return html;
  }
};

export const renderMarkdown = async (
  content: string,
  resolveWikiLink: ResolveWikiLink,
): Promise<string> => {
  const source = replaceWikiLinksWithHtml(content, resolveWikiLink);
  const renderToHtml = (
    globalThis as {
      Bun?: { markdown?: { html?: (value: string, options?: Bun.markdown.Options) => string } };
    }
  ).Bun?.markdown?.html;
  if (!renderToHtml) {
    throw new Error("Bun.markdown.html is not available");
  }
  const html = renderToHtml(source, BUN_MARKDOWN_OPTIONS);
  const safeHtml = sanitizeRenderedHtml(html);
  const highlighted = await highlightCodeBlocks(safeHtml);
  return applyCodeBlockTheme(highlighted);
};
