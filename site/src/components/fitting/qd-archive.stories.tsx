import type { Meta, StoryObj } from "storybook-framework-qwik";
import { QDArchive } from "./qd-archive";

const meta = {
  title: "Fitting/QD archive",
  component: QDArchive,
  render: () => (
    <div style={{ width: "600px", maxWidth: "100%" }}>
      <QDArchive />
    </div>
  ),
} satisfies Meta;
export default meta;

export const Default: StoryObj = {};
