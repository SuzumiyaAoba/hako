const escapeHtml = (value: string): string =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const mockMarkdownHtml = (content: string): string => {
  const FENCED_CODE_BLOCK_PATTERN = /(```+|~~~+)([^\n]*)\n([\s\S]*?)\1/g;
  const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
  const tokens: string[] = [];

  let source = content.replace(
    FENCED_CODE_BLOCK_PATTERN,
    (_match: string, _fence: string, rawLang: string, code: string): string => {
      const lang = rawLang.trim();
      const className = lang ? ` class="language-${lang}"` : "";
      const token = `__code_${tokens.length}__`;
      tokens.push(`<pre><code${className}>${escapeHtml(code)}\n</code></pre>`);
      return token;
    },
  );

  source = source.replace(LINK_PATTERN, (_match: string, label: string, href: string): string => {
    const safeHref = href.trim();
    return `<a href="${safeHref}">${escapeHtml(label)}</a>`;
  });

  const html = source
    .split(/\n{2,}/)
    .map((segment) => {
      const trimmed = segment.trim();
      if (!trimmed) {
        return "";
      }
      if (trimmed.startsWith("__code_")) {
        return trimmed;
      }
      if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    })
    .join("\n");

  return html.replace(
    /__code_(\d+)__/g,
    (_match: string, index: string) => tokens[Number(index)] ?? "",
  );
};

if (!globalThis.Bun) {
  (
    globalThis as {
      Bun?: {
        env: Record<string, string | undefined>;
        gc: (force?: boolean) => void;
        markdown: { html: (value: string) => string };
      };
    }
  ).Bun = {
    env: process.env,
    gc: () => undefined,
    markdown: {
      html: mockMarkdownHtml,
    },
  };
}
