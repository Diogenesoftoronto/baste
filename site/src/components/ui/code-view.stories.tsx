import type { PropsOf } from "@builder.io/qwik";
import type { Meta, StoryObj } from "storybook-framework-qwik";
import { CodeView } from "./code-view";
import { DEMO_TOKEN_EXPORTS } from "~/lib/demo-data";

type Props = PropsOf<typeof CodeView>;
const meta = {
  title: "UI/Code view",
  component: CodeView,
  render: (args) => <CodeView {...args} />,
} satisfies Meta<Props>;
export default meta;

export const CSS: StoryObj<Props> = {
  args: {
    code: DEMO_TOKEN_EXPORTS.cyberbotanist.css,
    label: "Cyberbotanist CSS tokens",
  },
};
export const JSON: StoryObj<Props> = {
  args: {
    code: DEMO_TOKEN_EXPORTS.cyberbotanist.json,
    label: "Cyberbotanist JSON tokens",
  },
};
