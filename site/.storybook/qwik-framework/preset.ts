// The adapter's root preset.js is CommonJS inside an ESM package. Use the package
// export for its real ESM preset, without patching installed dependencies.
// Load this preset once: registering it again as a renderer would duplicate
// the adapter's Qwik loader in the iframe.
export {
  previewAnnotations,
  previewHead,
  viteFinal,
} from "storybook-framework-qwik/preset";

export const core = {
  builder: "@storybook/builder-vite",
};
