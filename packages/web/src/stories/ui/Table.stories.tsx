import type { Meta, StoryObj } from "@storybook/react";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const meta = {
  title: "Design System/Table",
  component: Table,
  tags: ["autodocs"],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table>
      <TableCaption>最近更新したノート</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>タイトル</TableHead>
          <TableHead>タグ</TableHead>
          <TableHead>更新日</TableHead>
          <TableHead className="text-right">状態</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Hono SSR メモ</TableCell>
          <TableCell>#bun</TableCell>
          <TableCell className="tabular-nums">2026-02-04</TableCell>
          <TableCell className="text-right">公開</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Shiki 設計ノート</TableCell>
          <TableCell>#frontend</TableCell>
          <TableCell className="tabular-nums">2026-02-03</TableCell>
          <TableCell className="text-right">下書き</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
