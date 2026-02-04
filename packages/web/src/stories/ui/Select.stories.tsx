import type { Meta, StoryObj } from "@storybook/react";
import { Select } from "@/components/ui/select";

const meta = {
  title: "Design System/Select",
  component: Select,
  tags: ["autodocs"],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Select defaultValue="research">
      <option value="research">Research</option>
      <option value="daily">Daily</option>
      <option value="idea">Idea</option>
    </Select>
  ),
};
