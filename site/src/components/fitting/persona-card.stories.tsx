import type { PropsOf } from "@builder.io/qwik";
import type { Meta, StoryObj } from "storybook-framework-qwik";
import { PersonaCard } from "./persona-card";
import { DEMO_PERSONAS, DEMO_TOKENS } from "~/lib/demo-data";

type Props = PropsOf<typeof PersonaCard>;
const meta = {
  title: "Fitting/Persona card",
  component: PersonaCard,
  render: (args) => (
    <div style={{ width: "380px", maxWidth: "100%" }}>
      <PersonaCard {...args} />
    </div>
  ),
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
