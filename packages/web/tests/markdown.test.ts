import { describe, expect, it } from "vitest";

import { renderMarkdown } from "../src/shared/lib/markdown";
import { buildBacklinks } from "../src/shared/lib/backlinks";
import { extractWikiLinks } from "../src/shared/lib/wiki-links";

describe("wiki links", () => {
  it("extracts wiki links with labels", () => {
    const links = extractWikiLinks("See [[Alpha]] and [[Beta|Label]].");

    expect(links).toEqual([
      { title: "Alpha", label: "Alpha" },
      { title: "Beta", label: "Label" },
    ]);
  });

  it("ignores wiki links inside code blocks and inline code", () => {
    const content = [
      "Before [[Alpha]]",
      "```ts",
      'const code = "[[Beta]]";',
      "```",
      "Inline ``[[Gamma]]`` sample.",
      "~~~",
      "[[Epsilon]]",
      "~~~",
      "After [[Delta|D]]",
    ].join("\n");

    const links = extractWikiLinks(content);

    expect(links).toEqual([
      { title: "Alpha", label: "Alpha" },
      { title: "Delta", label: "D" },
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

  it("renders code blocks with shiki highlighting", async () => {
    const html = await renderMarkdown("```ts\nconst value = 1\n```", (_title, label) => ({
      href: null,
      label,
    }));

    expect(html).toContain("<pre");
    expect(html).toContain("background-color");
    expect(html).toContain("color:");
  });

  it("renders frontmatter as a table", async () => {
    const html = await renderMarkdown(
      ["---", "title: Sample", "tags: demo", "---", "", "# Heading"].join("\n"),
      (_title, label) => ({ href: null, label }),
    );

    expect(html).toContain("frontmatter");
    expect(html).toContain("<table>");
    expect(html).toContain("title");
    expect(html).toContain("Sample");
  });

  it("renders frontmatter even with leading whitespace", async () => {
    const html = await renderMarkdown(
      ["", "", "---", "title: Sample", "---", "", "# Heading"].join("\n"),
      (_title, label) => ({ href: null, label }),
    );

    expect(html).toContain("frontmatter");
    expect(html).toContain("Sample");
  });
});
