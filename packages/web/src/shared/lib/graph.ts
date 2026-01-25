import type { Note } from "@hako/core";

import { extractWikiLinks } from "./wiki-links";

export type GraphNode = {
  id: string;
  title: string;
};

export type GraphLink = {
  source: string;
  target: string;
};

export type NoteGraph = {
  nodes: GraphNode[];
  links: GraphLink[];
};

/**
 * Build a simple graph from notes and wiki links.
 */
export const buildNoteGraph = (notes: Note[]): NoteGraph => {
  const titleToId = new Map<string, string>();
  const nodes: GraphNode[] = notes.map((note) => {
    titleToId.set(note.title, note.id);
    return { id: note.id, title: note.title };
  });

  const links: GraphLink[] = [];
  for (const note of notes) {
    const extracted = extractWikiLinks(note.content);
    for (const link of extracted) {
      const targetId = titleToId.get(link.title);
      if (!targetId) {
        continue;
      }
      links.push({ source: note.id, target: targetId });
    }
  }

  return { nodes, links };
};
