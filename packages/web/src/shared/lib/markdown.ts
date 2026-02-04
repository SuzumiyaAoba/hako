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
 * Matches fenced code blocks using backticks or tildes.
 */
const FENCED_CODE_BLOCK_PATTERN = /(```+|~~~+)([^\n]*)\n([\s\S]*?)\1/g;
/**
 * Matches inline code spans using one or more backticks.
 */
const INLINE_CODE_PATTERN = /(`+)([^\n]*?)\1/g;
const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
const CODE_TOKEN_PREFIX = "__HAKO_CODE_BLOCK_";

type BunMarkdownApi = {
  markdown?: {
    html?: (content: string) => string;
  };
};

/**
 * Escape text for HTML content.
 */
const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Escape text for HTML attributes.
 */
const escapeHtmlAttribute = (value: string): string =>
  escapeHtml(value).replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/**
 * Restrict links to safe protocols.
 */
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

/**
 * Builds a wiki link class string.
 */
const buildWikiLinkClassName = (href: string | null): string =>
  href
    ? "wiki-link text-blue-600 underline decoration-blue-300 underline-offset-4"
    : "wiki-link unresolved text-slate-400 underline decoration-dotted underline-offset-4";

/**
 * Build explicit HTML for a resolved wiki link.
 */
const buildWikiLinkHtml = (title: string, label: string, href: string | null): string => {
  const safeHref = sanitizeHref(href);
  return `<a href="${escapeHtmlAttribute(safeHref)}" title="${escapeHtmlAttribute(title)}" class="${buildWikiLinkClassName(href)}">${escapeHtml(label)}</a>`;
};

/**
 * Mask code spans to avoid replacing wiki links inside code.
 */
const maskCodeSpans = (content: string): string => {
  const maskedFenced = content.replace(FENCED_CODE_BLOCK_PATTERN, (match: string): string =>
    " ".repeat(match.length),
  );
  return maskedFenced.replace(INLINE_CODE_PATTERN, (match: string): string =>
    " ".repeat(match.length),
  );
};

/**
 * Replace wiki-link tokens with explicit HTML anchors.
 */
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

/**
 * Very small markdown fallback used only when Bun markdown API is unavailable.
 */
const renderWithFallback = (content: string): string => {
  const codeBlocks: string[] = [];
  let markdown = content.replace(
    FENCED_CODE_BLOCK_PATTERN,
    (_match: string, _fence: string, rawLang: string, code: string): string => {
      const lang = rawLang.trim();
      const className = lang ? ` class="language-${escapeHtmlAttribute(lang)}"` : "";
      const block = `<pre><code${className}>${escapeHtml(code)}</code></pre>`;
      const token = `${CODE_TOKEN_PREFIX}${codeBlocks.length}__`;
      codeBlocks.push(block);
      return token;
    },
  );

  markdown = markdown.replace(
    LINK_PATTERN,
    (_match: string, label: string, href: string): string => {
      const safeHref = sanitizeHref(href);
      return `<a href="${escapeHtmlAttribute(safeHref)}">${escapeHtml(label)}</a>`;
    },
  );

  const segments = markdown.split(/\n{2,}/);
  const html = segments
    .map((segment) => {
      const trimmed = segment.trim();
      if (!trimmed) {
        return "";
      }
      if (trimmed.startsWith(CODE_TOKEN_PREFIX) && trimmed.endsWith("__")) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    })
    .join("\n");

  return html.replace(
    new RegExp(`${CODE_TOKEN_PREFIX}(\\d+)__`, "g"),
    (_match: string, index: string) => {
      const codeBlock = codeBlocks[Number(index)];
      return codeBlock ?? "";
    },
  );
};

/**
 * Remove clearly unsafe HTML snippets.
 */
const sanitizeRenderedHtml = (html: string): string =>
  html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*(javascript|data|vbscript):[\s\S]*?\2/gi, ' $1="#"');

/**
 * Add lightweight inline styling for fenced code output.
 */
const applyCodeBlockTheme = (html: string): string =>
  html.replace(
    /<pre>/g,
    '<pre style="background-color: #f6f8fa; color: #24292f; padding: 0.75rem; border-radius: 0.5rem; overflow-x: auto;">',
  );

/**
 * Render markdown to HTML with wiki links.
 */
export const renderMarkdown = async (
  content: string,
  resolveWikiLink: ResolveWikiLink,
): Promise<string> => {
  const markdown = replaceWikiLinksWithHtml(content, resolveWikiLink);
  const renderToHtml = (globalThis as { Bun?: BunMarkdownApi }).Bun?.markdown?.html;
  const html = renderToHtml ? renderToHtml(markdown) : renderWithFallback(markdown);
  return applyCodeBlockTheme(sanitizeRenderedHtml(html));
};
