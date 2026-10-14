import { component$ } from "@builder.io/qwik";
import { css } from "styled-system/css";

type Part = { kind: "text" | "hex" | "comment" | "string" | "key"; v: string };

const TOKEN_RE = /(\/\*[\s\S]*?\*\/|\/\/[^\n]*)|(#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b)|('[^'\n]*'|"[^"\n]*")|(--[\w-]+)/g;

function tokenize(src: string): Part[] {
  const out: Part[] = [];
  let last = 0;
  for (const m of src.matchAll(TOKEN_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: "text", v: src.slice(last, i) });
    if (m[1]) out.push({ kind: "comment", v: m[1] });
    else if (m[2]) out.push({ kind: "hex", v: m[2] });
    else if (m[3]) {
      // a quoted hex still gets a swatch
      const inner = m[3].slice(1, -1);
      if (/^#[0-9a-fA-F]{3,6}$/.test(inner)) {
        out.push({ kind: "string", v: m[3][0] });
        out.push({ kind: "hex", v: inner });
        out.push({ kind: "string", v: m[3][0] });
      } else out.push({ kind: "string", v: m[3] });
    } else if (m[4]) out.push({ kind: "key", v: m[4] });
    last = i + m[0].length;
  }
  if (last < src.length) out.push({ kind: "text", v: src.slice(last) });
  return out;
}

const COLOR: Record<Part["kind"], string> = {
  text: "#EDE7DA",
  comment: "#8F887A",
  string: "#E9C46A",
  hex: "#EDE7DA",
  key: "#9DB4E8",
};

/** Read-only code with light highlighting; colour literals carry a swatch. */
export const CodeView = component$<{ code: string; label?: string; maxHeight?: string }>(({ code, label, maxHeight = "420px" }) => {
  const parts = tokenize(code);
  return (
    <pre
      aria-label={label}
      tabIndex={0}
      class={css({
        m: 0,
        p: 5,
        bg: "night",
        color: "night-text",
        fontFamily: "mono",
        fontSize: "12.5px",
        lineHeight: 1.7,
        overflow: "auto",
        rounded: "sm",
        tabSize: 2,
      })}
      style={{ maxHeight }}
    >
      <code>
        {parts.map((p, i) =>
          p.kind === "hex" ? (
            <span key={i} style={{ whiteSpace: "nowrap" }}>
              <i
                aria-hidden="true"
                style={{
                  display: "inline-block",
                  width: "10px",
                  height: "10px",
                  borderRadius: "2px",
                  background: p.v,
                  marginRight: "5px",
                  verticalAlign: "-1px",
                  boxShadow: "0 0 0 1px rgba(237,231,218,0.25)",
                }}
              />
              {p.v}
            </span>
          ) : (
            <span key={i} style={{ color: COLOR[p.kind] }}>{p.v}</span>
          ),
        )}
      </code>
    </pre>
  );
});
