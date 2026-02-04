import type { Meta, StoryObj } from "@storybook/react";
import { Checkbox } from "@/components/ui/checkbox";

const meta = {
  title: "Design System/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
} satisfies Meta<typeof Checkbox>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <label className="inline-flex items-center gap-2 text-sm">
      <Checkbox aria-label="公開" defaultChecked />
      公開
    </label>
  ),
};
