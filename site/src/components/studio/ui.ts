import { css, cx } from "styled-system/css";

/** Studio primitives in the atelier house style. */

export type BtnVariant = "primary" | "secondary" | "ghost" | "danger";

const btnBase = css({
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  h: "38px",
  px: 4,
  rounded: "base",
  fontSize: "14px",
  fontWeight: 600,
  lineHeight: 1,
  whiteSpace: "nowrap",
  border: "1px solid transparent",
  textDecoration: "none",
  transition: "background 0.18s, border-color 0.18s, color 0.18s, transform 0.18s",
  _active: { transform: "translateY(1px)" },
  _disabled: { opacity: 0.45, _active: { transform: "none" } },
});

const btnVariants: Record<BtnVariant, string> = {
  primary: css({ bg: "ink", color: "paper", _hover: { bg: "thread-ink" }, _disabled: { _hover: { bg: "ink" } } }),
  secondary: css({ bg: "card", color: "ink", borderColor: "rule-strong", _hover: { borderColor: "ink" } }),
  ghost: css({ bg: "transparent", color: "ink-soft", _hover: { bg: "paper-deep", color: "ink" } }),
  danger: css({ bg: "transparent", color: "thread-ink", borderColor: "rule", _hover: { borderColor: "thread-ink", bg: "rgba(210,64,42,0.06)" } }),
};

export const btn = (variant: BtnVariant = "primary", extra?: string) => cx(btnBase, btnVariants[variant], extra);
export const btnSm = css({ h: "30px", px: 3, fontSize: "13px" });

/**
 * Action verbs. Pick by what the control *does*, not how loud it should be;
 * each verb looks, hovers, sounds and answers a press differently
 * (global.css "Action verbs", fx/juice, fx/press-gl).
 *   cut    — commit: save, create, generate for real
 *   spend  — a commit that costs wallet credit
 *   baste  — a safe, reversible try: draft, preview, dry run, reconnect
 *   pin    — select, toggle, add to a set
 *   chalk  — copy, export, download
 *   go     — move to another view or page
 *   unpick — remove (pair with HoldButton for anything lasting)
 */
export type Verb = "cut" | "spend" | "baste" | "pin" | "chalk" | "go" | "unpick";

const verbVariants: Record<Verb, string> = {
  cut: css({ bg: "ink", color: "paper", _hover: { bg: "thread-ink" }, _disabled: { _hover: { bg: "ink" } } }),
  spend: css({ bg: "ink", color: "paper", _hover: { bg: "#2B2820" } }),
  baste: css({ bg: "transparent", color: "ink", _hover: { bg: "rgba(210,64,42,0.05)" } }),
  pin: css({ bg: "card", color: "ink", borderColor: "rule-strong", _hover: { borderColor: "ink", boxShadow: "sheet" }, "&[aria-pressed=true]": { borderColor: "ink", bg: "paper-deep" } }),
  chalk: css({ bg: "card", color: "chalk", borderColor: "chalk-soft", _hover: { borderColor: "chalk", bg: "#F3F5FB" } }),
  go: css({ bg: "transparent", color: "ink-soft", px: 2, _hover: { color: "ink", textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: "4px" } }),
  unpick: css({ bg: "transparent", color: "thread-ink", borderColor: "rule", _hover: { bg: "rgba(210,64,42,0.05)" } }),
};

/** A "go" that is the main way forward from an empty state: same verb, more presence. */
const goLead = css({ bg: "card", color: "ink", borderColor: "ink", _hover: { bg: "paper-deep", boxShadow: "sheet" } });

export const act = (verb: Verb, extra?: string, lead = false) =>
  cx(btnBase, lead && verb === "go" ? goLead : verbVariants[verb], `act act-${verb}`, extra);

export const input = css({
  w: "100%",
  h: "38px",
  px: 3,
  rounded: "base",
  border: "1px solid token(colors.rule-strong)",
  bg: "card",
  color: "ink",
  fontSize: "14px",
  transition: "border-color 0.15s, box-shadow 0.15s",
  _placeholder: { color: "ink-muted", opacity: 0.8 },
  _focus: { outline: "none", borderColor: "chalk", boxShadow: "0 0 0 3px token(colors.chalk-soft)" },
  _disabled: { bg: "paper-deep", color: "ink-muted" },
});

export const textarea = cx(input, css({ h: "auto", minH: "88px", py: 2, lineHeight: 1.5, resize: "vertical" }));

export const fieldLabel = css({
  display: "block",
  fontSize: "12.5px",
  fontWeight: 600,
  color: "ink-soft",
  mb: "6px",
});

export const hint = css({ fontSize: "12.5px", color: "ink-muted", mt: "6px", lineHeight: 1.45 });

export const panel = css({
  bg: "card",
  border: "1px solid token(colors.rule)",
  rounded: "lg",
  p: { base: 4, md: 6 },
});

export const panelTitle = css({
  fontFamily: "display",
  fontSize: "22px",
  fontWeight: 500,
  letterSpacing: "-0.01em",
  lineHeight: 1.1,
});

export const kicker = css({
  fontFamily: "mono",
  fontSize: "11px",
  fontWeight: 500,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "ink-muted",
});

export const chip = css({
  display: "inline-flex",
  alignItems: "center",
  gap: 1,
  h: "26px",
  px: "10px",
  rounded: "full",
  fontSize: "12.5px",
  bg: "paper-deep",
  color: "ink-soft",
  border: "1px solid token(colors.rule)",
  whiteSpace: "nowrap",
});

export const mono = css({ fontFamily: "mono", fontSize: "12.5px" });

export const emptyBox = css({
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: 3,
  p: { base: 5, md: 8 },
  rounded: "lg",
  border: "1.5px dashed token(colors.rule-strong)",
  color: "ink-soft",
});

export const splitList = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
