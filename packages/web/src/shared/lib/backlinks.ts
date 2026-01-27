import { extractWikiLinks, type WikiLink } from "./wiki-links";

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
