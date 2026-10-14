import type { Preview } from "storybook-framework-qwik";
import "../src/global.css";
import "../styled-system/styles.css";
import "./preview.css";

const preview: Preview = {
  parameters: {
    layout: "padded",
    backgrounds: {
      default: "Pattern paper",
      values: [{ name: "Pattern paper", value: "#F1ECE2" }],
    },
    controls: { expanded: true },
    options: { storySort: { order: ["Fitting", "UI", "FX"] } },
  },
};

export default preview;
