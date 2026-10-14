import type { PropsOf } from "@builder.io/qwik";
import type { Meta, StoryObj } from "storybook-framework-qwik";
import { CopyCommand } from "./copy-command";

type Props = PropsOf<typeof CopyCommand>;
const meta = {
  title: "UI/Copy command",
  component: CopyCommand,
  render: (args) => <CopyCommand {...args} />,
  args: { command: "baste generate cyberbotanist" },
  argTypes: { tone: { control: "inline-radio", options: ["paper", "night"] } },
} satisfies Meta<Props>;
export default meta;

export const Paper: StoryObj<Props> = { args: { tone: "paper" } };
export const Night: StoryObj<Props> = { args: { tone: "night" } };
