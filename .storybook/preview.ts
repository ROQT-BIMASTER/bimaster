import type { Preview } from "@storybook/react";
import "../src/index.css";

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: "app",
      values: [
        { name: "app", value: "hsl(0 0% 100%)" },
        { name: "dark", value: "hsl(222 47% 11%)" },
      ],
    },
  },
};

export default preview;
