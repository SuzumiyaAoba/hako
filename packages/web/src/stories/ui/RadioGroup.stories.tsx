import type { Meta, StoryObj } from "@storybook/react";
import { RadioGroup, RadioItem } from "@/components/ui/radio-group";

const meta = {
  title: "Design System/RadioGroup",
  component: RadioGroup,
  tags: ["autodocs"],
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <RadioGroup aria-label="優先度">
      <label className="inline-flex items-center gap-2 text-sm">
        <RadioItem name="priority" defaultChecked aria-label="高" />高
      </label>
      <label className="inline-flex items-center gap-2 text-sm">
        <RadioItem name="priority" aria-label="通常" />
        通常
      </label>
    </RadioGroup>
  ),
};
