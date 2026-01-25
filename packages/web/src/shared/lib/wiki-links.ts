export type WikiLink = {
  title: string;
  label: string;
};

const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

/**
 * Extract wiki links from markdown content.
 */
export const extractWikiLinks = (content: string): WikiLink[] => {
  const links: WikiLink[] = [];
  for (const match of content.matchAll(WIKI_LINK_PATTERN)) {
    const title = match[1]?.trim();
    if (!title) {
      continue;
    }
    const label = match[2]?.trim() || title;
    links.push({ title, label });
  }
  return links;
};
