import type { Meta, StoryObj } from "@storybook/react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const meta = {
  title: "Design System/Label",
  component: Label,
  tags: ["autodocs"],
} satisfies Meta<typeof Label>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="grid gap-2 max-w-sm">
      <Label htmlFor="label-story-input">タイトル</Label>
      <Input id="label-story-input" placeholder="タイトル" />
    </div>
  ),
};
