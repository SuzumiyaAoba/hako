import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const meta = {
  title: "Design System/Card",
  component: Card,
  tags: ["autodocs"],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Weekly Notes</CardTitle>
        <CardDescription>ノートを編集して保存します。</CardDescription>
      </CardHeader>
      <CardContent>本文のプレビュー領域です。</CardContent>
      <CardFooter>
        <Button>保存</Button>
      </CardFooter>
    </Card>
  ),
};
