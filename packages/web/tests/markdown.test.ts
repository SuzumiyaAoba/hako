import { describe, expect, it } from "vitest";

import { buildBacklinks, renderMarkdown } from "../src/shared/lib/markdown";
import { extractWikiLinks } from "../src/shared/lib/wiki-links";

describe("wiki links", () => {
  it("extracts wiki links with labels", () => {
    const links = extractWikiLinks("See [[Alpha]] and [[Beta|Label]].");

    expect(links).toEqual([
      { title: "Alpha", label: "Alpha" },
      { title: "Beta", label: "Label" },
    ]);
  });

  it("builds backlinks", () => {
    const backlinks = buildBacklinks(
      [
        { title: "Alpha", content: "See [[Beta]]" },
        { title: "Gamma", content: "No links" },
        { title: "Delta", content: "[[Beta|B]]" },
      ],
      "Beta",
    );

    expect(backlinks.map((link) => link.title)).toEqual(["Alpha", "Delta"]);
  });
});

describe("renderMarkdown", () => {
  it("renders wiki links with href", async () => {
    const html = await renderMarkdown("Hello [[Alpha]]", (title, label) => ({
      href: `/notes/${title}`,
      label,
    }));

    expect(html).toContain('href="/notes/Alpha"');
    expect(html).toContain("wiki-link");
  });

  it("renders wiki links across paragraphs", async () => {
    const html = await renderMarkdown(
      "Long paragraph with [[Alpha]] content.\n\n[[Beta]]",
      (title, label) => ({
        href: `/notes/${title}`,
        label,
      }),
    );

    expect(html).toContain('href="/notes/Alpha"');
    expect(html).toContain('href="/notes/Beta"');
  });

  it("marks unresolved links", async () => {
    const html = await renderMarkdown("Missing [[Zeta]]", (_title, label) => ({
      href: null,
      label,
    }));

    expect(html).toContain("wiki-link");
    expect(html).toContain("unresolved");
  });

  it("sanitizes unsafe html and urls", async () => {
    const html = await renderMarkdown(
      "<script>alert(1)</script> [x](javascript:alert(1))",
      (_title, label) => ({ href: null, label }),
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("javascript:");
  });
});
