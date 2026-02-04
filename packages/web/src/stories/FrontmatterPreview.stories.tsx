import type { Meta, StoryObj } from "@storybook/react";

type FrontmatterPreviewProps = {
  title: string;
  fields: Array<{ key: string; value: string }>;
};

const FrontmatterPreview = ({ title, fields }: FrontmatterPreviewProps): JSX.Element => (
  <details
    open
    style={{
      width: "min(720px, 100%)",
      border: "1px solid #dbe3ef",
      background: "#ffffff",
      padding: "14px",
      fontFamily: '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif',
    }}
  >
    <summary style={{ cursor: "pointer", marginBottom: "10px", fontWeight: 700 }}>{title}</summary>
    <div style={{ display: "grid", gap: "8px" }}>
      {fields.map((field, index) => (
        <div
          key={`${field.key}-${index}`}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(110px, 160px) 1fr",
            gap: "10px",
            padding: "6px 0",
            borderTop: index === 0 ? "none" : "1px solid #e2e8f0",
          }}
        >
          <p style={{ margin: 0, fontSize: "0.78rem", fontWeight: 700, color: "#334155" }}>
            {field.key}
          </p>
          <p style={{ margin: 0, fontSize: "0.92rem", color: "#0f172a" }}>{field.value}</p>
        </div>
      ))}
    </div>
  </details>
);

const meta = {
  title: "Web/FrontmatterPreview",
  component: FrontmatterPreview,
  tags: ["autodocs"],
  args: {
    title: "Frontmatter",
    fields: [
      { key: "title", value: "Hono で React SSR" },
      { key: "tags", value: "bun, hono, react, ssr" },
      { key: "updated", value: "2026-02-04" },
    ],
  },
} satisfies Meta<typeof FrontmatterPreview>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
