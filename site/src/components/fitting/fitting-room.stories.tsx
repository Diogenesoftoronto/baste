import type { PropsOf } from "@builder.io/qwik";
import type { Meta, StoryObj } from "storybook-framework-qwik";
import { FittingRoom } from "./fitting-room";
import { DEMO_PERSONAS, DEMO_TOKENS } from "~/lib/demo-data";

type Props = PropsOf<typeof FittingRoom>;
const meta = {
  title: "Fitting/Fitting room",
  component: FittingRoom,
  render: (args) => <FittingRoom {...args} />,
  args: { personas: DEMO_PERSONAS, tokens: DEMO_TOKENS, autoplay: true },
} satisfies Meta<Props>;
export default meta;

export const Default: StoryObj<Props> = {};
