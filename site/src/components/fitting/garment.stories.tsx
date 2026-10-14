import type { PropsOf } from "@builder.io/qwik";
import type { Meta, StoryObj } from "storybook-framework-qwik";
import { Garment } from "./garment";
import { DEMO_PERSONAS, DEMO_TOKENS } from "~/lib/demo-data";

type Props = PropsOf<typeof Garment>;
const meta = {
  title: "Fitting/Garment",
  component: Garment,
  render: (args) => <Garment {...args} />,
  argTypes: { size: { control: "inline-radio", options: ["full", "compact"] } },
} satisfies Meta<Props>;
export default meta;
type Story = StoryObj<Props>;

export const Cyberbotanist: Story = {
  args: {
    persona: DEMO_PERSONAS.find((p) => p.id === "cyberbotanist")!,
    tokens: DEMO_TOKENS.cyberbotanist,
  },
};
export const NightMarketCoder: Story = {
  args: {
    persona: DEMO_PERSONAS.find((p) => p.id === "nightmarketcoder")!,
    tokens: DEMO_TOKENS.nightmarketcoder,
  },
};
export const LiminalWeeb: Story = {
  args: {
    persona: DEMO_PERSONAS.find((p) => p.id === "liminalweeb")!,
    tokens: DEMO_TOKENS.liminalweeb,
  },
};
export const Compact: Story = {
  args: { ...Cyberbotanist.args!, size: "compact" },
};
