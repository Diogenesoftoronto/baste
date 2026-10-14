import type { PropsOf } from "@builder.io/qwik";
import type { Meta, StoryObj } from "storybook-framework-qwik";
import { Fabric, lookFromTokens } from "./fabric";
import { LINEN } from "./fabric-gl";
import { DEMO_PERSONAS, DEMO_TOKENS } from "~/lib/demo-data";

type Props = PropsOf<typeof Fabric>;
const meta = {
  title: "FX/Fabric",
  component: Fabric,
  render: (args) => (
    <div style={{ width: "900px", height: "500px" }}>
      <Fabric {...args} />
    </div>
  ),
  args: { quality: 1, parallax: 0.65 },
} satisfies Meta<Props>;
export default meta;
type Story = StoryObj<Props>;

export const Linen: Story = { args: { look: LINEN, label: "House linen" } };
export const Cyberbotanist: Story = {
  args: {
    look: lookFromTokens(
      DEMO_TOKENS.cyberbotanist,
      DEMO_PERSONAS.find((p) => p.id === "cyberbotanist")!.aesthetic.density,
    ),
    label: "Cyberbotanist cloth",
  },
};
export const NightMarketCoder: Story = {
  args: {
    look: lookFromTokens(
      DEMO_TOKENS.nightmarketcoder,
      DEMO_PERSONAS.find((p) => p.id === "nightmarketcoder")!.aesthetic.density,
    ),
    label: "Night Market Coder cloth",
  },
};
export const LiminalWeeb: Story = {
  args: {
    look: lookFromTokens(
      DEMO_TOKENS.liminalweeb,
      DEMO_PERSONAS.find((p) => p.id === "liminalweeb")!.aesthetic.density,
    ),
    label: "Liminal Weeb cloth",
  },
};
