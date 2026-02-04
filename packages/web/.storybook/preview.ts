import type { Preview } from "@storybook/react";
import "../src/styles/globals.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
    backgrounds: {
      default: "canvas",
      values: [
        { name: "canvas", value: "#f7f3ed" },
        { name: "paper", value: "#ffffff" },
      ],
    },
  },
};

export default preview;
