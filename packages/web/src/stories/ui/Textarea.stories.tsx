import type { Meta, StoryObj } from "@storybook/react";
import { Textarea } from "@/components/ui/textarea";

const meta = {
  title: "Design System/Textarea",
  component: Textarea,
  tags: ["autodocs"],
  args: {
    defaultValue: "本文を入力",
  },
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
