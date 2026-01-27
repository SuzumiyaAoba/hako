/**
 * Represents a parsed wiki link.
 */
export type WikiLink = {
  title: string;
  label: string;
};

/**
 * Matches wiki link syntax like [[Title]] or [[Title|Label]].
 */
const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
/**
 * Matches fenced code blocks using backticks or tildes.
 */
const FENCED_CODE_BLOCK_PATTERN = /(```+|~~~+)[\s\S]*?\1/g;
/**
 * Matches inline code spans using one or more backticks.
 */
const INLINE_CODE_PATTERN = /(`+)([^\n]*?)\1/g;

/**
 * Mask code spans to avoid matching wiki links inside code.
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
 * Extract wiki links from markdown content.
 */
export const extractWikiLinks = (content: string): WikiLink[] => {
  const links: WikiLink[] = [];
  const maskedContent = maskCodeSpans(content);
  for (const match of maskedContent.matchAll(WIKI_LINK_PATTERN)) {
    const title = match[1]?.trim();
    if (!title) {
      continue;
    }
    const label = match[2]?.trim() || title;
    links.push({ title, label });
  }
  return links;
};
