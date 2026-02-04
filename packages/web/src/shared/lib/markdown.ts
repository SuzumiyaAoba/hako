import { createHighlighter, bundledLanguagesInfo } from "shiki";
import sanitizeHtml from "sanitize-html";

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
const SHIKI_THEME = "catppuccin-latte";
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

const SUPPORTED_LANGUAGES = new Set(
  bundledLanguagesInfo.flatMap((language) => [language.id, ...(language.aliases ?? [])]),
);

const highlighterPromise = createHighlighter({
  themes: [SHIKI_THEME],
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
      pre: ["shiki", "github-light", "catppuccin-latte"],
      code: ["language-*"],
      span: ["line"],
    },
    allowedSchemes: ["http", "https", "mailto", "tel"],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    parser: {
      lowerCaseAttributeNames: true,
    },
  });

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
        theme: SHIKI_THEME,
      });
      output = output.replace(whole, highlighted);
    }
    return output;
  } catch {
    return html;
  }
};

const renderFallbackMarkdown = (source: string): string => {
  const codeBlocks: string[] = [];
  const withCodePlaceholders = source.replace(
    FENCED_CODE_BLOCK_PATTERN,
    (_match: string, _fence: string, languageHint: string, code: string): string => {
      const normalizedLanguage = normalizeLanguage(languageHint.trim() || undefined);
      const className =
        normalizedLanguage === "text" ? "" : ` class="language-${normalizedLanguage}"`;
      const html = `<pre><code${className}>${escapeHtml(code)}</code></pre>`;
      const token = `@@CODE_BLOCK_${codeBlocks.length}@@`;
      codeBlocks.push(html);
      return token;
    },
  );

  const renderInline = (value: string): string =>
    value
      .replace(INLINE_CODE_PATTERN, (_match: string, _ticks: string, code: string) => {
        return `<code>${escapeHtml(code)}</code>`;
      })
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match: string, label: string, href: string) => {
        const safeHref = sanitizeHref(href);
        return `<a href="${escapeHtmlAttribute(safeHref)}">${label}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  const htmlBlocks = withCodePlaceholders
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map((block) => {
      if (/^@@CODE_BLOCK_\d+@@$/.test(block)) {
        return block;
      }

      const headingMatch = block.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1]?.length ?? 1;
        const text = headingMatch[2] ?? "";
        return `<h${level}>${renderInline(text)}</h${level}>`;
      }

      if (/^(?:-{3,}|\*{3,}|_{3,})$/.test(block)) {
        return "<hr>";
      }

      const quoteLines = block.split("\n");
      if (quoteLines.every((line) => /^>\s?/.test(line))) {
        const quoteText = quoteLines.map((line) => line.replace(/^>\s?/, "")).join("<br>");
        return `<blockquote>${renderInline(quoteText)}</blockquote>`;
      }

      if (quoteLines.every((line) => /^[-*+]\s+/.test(line))) {
        const items = quoteLines
          .map((line) => line.replace(/^[-*+]\s+/, ""))
          .map((item) => `<li>${renderInline(item)}</li>`)
          .join("");
        return `<ul>${items}</ul>`;
      }

      if (quoteLines.every((line) => /^\d+\.\s+/.test(line))) {
        const items = quoteLines
          .map((line) => line.replace(/^\d+\.\s+/, ""))
          .map((item) => `<li>${renderInline(item)}</li>`)
          .join("");
        return `<ol>${items}</ol>`;
      }

      return `<p>${renderInline(block).replace(/\n/g, "<br>")}</p>`;
    });

  return htmlBlocks
    .join("\n")
    .replace(/@@CODE_BLOCK_(\d+)@@/g, (_match: string, index: string): string => {
      const codeBlock = codeBlocks[Number(index)];
      return codeBlock ?? "";
    });
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
  const html = renderToHtml
    ? renderToHtml(source, BUN_MARKDOWN_OPTIONS)
    : renderFallbackMarkdown(source);
  const safeHtml = sanitizeRenderedHtml(html);
  const highlighted = await highlightCodeBlocks(safeHtml);
  return highlighted;
};
