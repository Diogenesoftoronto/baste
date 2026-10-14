import type { PropsOf } from "@builder.io/qwik";
import type { Meta, StoryObj } from "storybook-framework-qwik";
import { MeasurementSheet, AxisTape } from "./measurement-sheet";
import { DEMO_PERSONAS } from "~/lib/demo-data";

type Props = PropsOf<typeof MeasurementSheet>;
const meta = {
  title: "Fitting/Measurement sheet",
  component: MeasurementSheet,
  render: (args) => <MeasurementSheet {...args} />,
} satisfies Meta<Props>;
export default meta;
type Story = StoryObj<Props>;

export const Cyberbotanist: Story = {
  args: {
    persona: DEMO_PERSONAS.find((p) => p.id === "cyberbotanist")!,
    number: "001",
  },
};
export const NightMarketCoder: Story = {
  args: {
    persona: DEMO_PERSONAS.find((p) => p.id === "nightmarketcoder")!,
    number: "002",
  },
};
export const LiminalWeeb: Story = {
  args: {
    persona: DEMO_PERSONAS.find((p) => p.id === "liminalweeb")!,
    number: "003",
  },
};

const tapeArgs = {
  label: "Density",
  options: ["sparse", "balanced", "dense"],
  value: "balanced",
};
export const TapeBalanced: StoryObj<PropsOf<typeof AxisTape>> = {
  name: "Axis tape / Balanced",
  render: (args) => <AxisTape {...args} />,
  args: tapeArgs,
};
export const TapeSparse: StoryObj<PropsOf<typeof AxisTape>> = {
  ...TapeBalanced,
  name: "Axis tape / Sparse",
  args: { ...tapeArgs, value: "sparse" },
};
export const TapeDense: StoryObj<PropsOf<typeof AxisTape>> = {
  ...TapeBalanced,
  name: "Axis tape / Dense",
  args: { ...tapeArgs, value: "dense" },
};
export const TapeCompact: StoryObj<PropsOf<typeof AxisTape>> = {
  ...TapeBalanced,
  name: "Axis tape / Compact",
  args: { ...tapeArgs, compact: true },
};
