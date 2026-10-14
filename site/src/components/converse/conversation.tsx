import { $, component$, noSerialize, sync$, useComputed$, useSignal, useStore, useVisibleTask$, type NoSerialize } from "@builder.io/qwik";
import { css } from "styled-system/css";
import type { DesignTokens, PersonaRecord } from "~/lib/api-types";
import { fittingVars } from "~/lib/fitting";
import { Garment } from "~/components/fitting/garment";
import {
  type Attachment, type Bubble, type Topic, type Turn,
  greet, respond, suggestions, typingDelay, voiceOf,
} from "~/lib/converse";
import { DEFAULT_API } from "~/lib/api";
import { CompanionVoice, type VoicePhase } from "~/lib/companion-voice";

interface ConversationProps {
  personas: PersonaRecord[];
  tokens: Record<string, DesignTokens>;
  /** Persona to open with. */
  initial?: string;
}

interface Thread {
  turns: Turn[];
  covered: Topic[];
  pending: boolean;
  error: string;
  draft: string;
}


const PORTRAITS: Record<string, { world: string; line: string; alt: string }> = {
  cyberbotanist: {
    world: "The greenhouse",
    line: "Field notes, field recordings, patient discovery.",
    alt: "Moss, a clay and felt character in an olive coat, studying a fern with a magnifying glass in a greenhouse.",
  },
  nightmarketcoder: {
    world: "The night market",
    line: "Lanterns, late nights, everything within reach.",
    alt: "Ren, a clay and felt character in a red jacket and knitted cap, among the lanterns of a night market.",
  },
  liminalweeb: {
    world: "The quiet archive",
    line: "Forgotten websites. Places that stay with you.",
    alt: "Ada, a silver-haired clay and felt character with round glasses, beside an old computer and stacks of papers.",
  },
};

const STEP_NAMES = ["Measure", "Draft", "Baste", "Fit", "Cut"];
const JUDGE = [
  { k: "Persona alignment", w: 30 },
  { k: "Visual quality", w: 20 },
  { k: "Uniqueness", w: 20 },
  { k: "Coherence", w: 15 },
  { k: "Usability", w: 15 },
];

/**
 * A companion and their cultural world beside a readable conversation.
 * The atelier framing stays steady; design samples carry the persona's tokens.
 * Each character keeps their own messages and draft when switching.
 */
export const Conversation = component$<ConversationProps>(({ personas, tokens, initial }) => {
  const activeId = useSignal(initial ?? personas[0].id);
  // Greetings render on the server. A slow script never leaves an empty chat.
  const threads = useStore<Record<string, Thread>>(Object.fromEntries(personas.map((p) => [p.id, {
    turns: greet(p, tokens[p.id]).map((bubble) => ({ from: "them" as const, ...bubble })),
    covered: ["who" as Topic], pending: false, error: "", draft: "",
  }])), { deep: true });
  const log = useSignal<HTMLElement>();
  const mode = useSignal<"checking" | "ai" | "demo">("checking");
  const followTail = useSignal(true);
  const epoch = useSignal(0);
  const voiceController = useSignal<NoSerialize<CompanionVoice>>();
  const presenceRoot = useSignal<HTMLElement>();
  const speech = useStore({ phase: 'idle' as VoicePhase, available: false, microphone: false, auto: false, seconds: 0, error: '', notice: '' });
  const spokenDraftBase = useSignal('');

  const persona = useComputed$(() => personas.find((p) => p.id === activeId.value) ?? personas[0]);
  const t = useComputed$(() => tokens[persona.value.id]);

  const scrollDown = $(async (id: string) => {
    // Let Qwik paint before measuring the new message's height.
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (activeId.value !== id || !followTail.value || !log.value) return;
    log.value.scrollTo({ top: log.value.scrollHeight, behavior: "auto" });
  });

  const open = $(async (id: string) => {
    if (!threads[id]) return;
    voiceController.value?.stop();
    speech.error = ''; speech.notice = '';
    activeId.value = id;
    followTail.value = true;
    await scrollDown(id);
  });

  const reply = $(async (id: string, text: string) => {
    const thread = threads[id];
    thread.error = "";
    const run = epoch.value;
    const p = personas.find((x) => x.id === id)!;
    const local = respond(p, tokens[id], text, thread.covered);
    try {
      let bubbles: Bubble[] = local.bubbles;
      if (mode.value === "ai") {
        const res = await fetch(`${DEFAULT_API}/converse/${encodeURIComponent(id)}`, {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ turns: thread.turns.slice(-16).map(({ from, text }) => ({ from, text })) }),
          signal: AbortSignal.timeout(25_000),
        });
        if (!res.ok) throw new Error("The reply didn’t arrive. Your message is still here. Try again.");
        const data = await res.json();
        if (!Array.isArray(data.bubbles) || !data.bubbles.length || !data.bubbles.every((b: unknown) => typeof b === "string" && b.trim())) {
          throw new Error("That reply was incomplete. Try again.");
        }
        const attach = local.bubbles.find((b) => b.attach)?.attach;
        bubbles = data.bubbles.slice(0, 4).map((text: string, i: number) => ({ text: text.slice(0, 400), attach: i === 0 ? attach : undefined }));
      }
      if (run !== epoch.value) return;
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      for (let i = 0; i < bubbles.length; i++) {
        if (!reduced && activeId.value === id) {
          await new Promise((resolve) => setTimeout(resolve, Math.min(700, typingDelay(bubbles[i].text, i === 0))));
        }
        if (run !== epoch.value) return;
        thread.turns.push({ from: "them", ...bubbles[i] });
        await scrollDown(id);
      }
      thread.covered.push(local.topic);
      if (activeId.value === id && speech.auto && speech.available) {
        void voiceController.value?.speak(id, bubbles.map(b => b.text).join(' '));
      }
    } catch (error) {
      if (run === epoch.value) thread.error = error instanceof Error && error.name !== "TimeoutError"
        ? error.message : "The reply took too long. Your message is still here. Try again.";
    } finally {
      if (run === epoch.value) thread.pending = false;
    }
  });

  const send = $(async (text: string) => {
    const id = activeId.value;
    const thread = threads[id];
    const clean = text.trim().slice(0, 600);
    if (!clean || thread.pending || mode.value === "checking" || ['requesting', 'listening', 'transcribing'].includes(speech.phase)) return;
    voiceController.value?.stop(); speech.error = ''; speech.notice = '';
    thread.pending = true;
    thread.draft = "";
    thread.turns.push({ from: "you", text: clean });
    followTail.value = true;
    await scrollDown(id);
    await reply(id, clean);
  });

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ cleanup }) => {
    let disposed = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);
    const hide = () => { if (document.hidden) voiceController.value?.stop(); };
    document.addEventListener('visibilitychange', hide);
    // Follow new messages unless the reader scrolls up to reread. A native listener
    // measures at once, so a reply that lands before a lazy handler runs can't stop it.
    const el = log.value;
    let lastTop = el?.scrollTop ?? 0;
    const follow = () => {
      if (!el) return;
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 64) followTail.value = true;
      else if (el.scrollTop < lastTop - 2) followTail.value = false;
      lastTop = el.scrollTop;
    };
    const pin = new MutationObserver(() => requestAnimationFrame(() => { if (el && followTail.value) el.scrollTop = el.scrollHeight; }));
    if (el) { el.addEventListener('scroll', follow, { passive: true }); pin.observe(el, { childList: true, subtree: true, characterData: true }); }
    cleanup(() => { disposed = true; controller.abort(); clearTimeout(timeout); epoch.value++; voiceController.value?.dispose(); document.removeEventListener('visibilitychange', hide); el?.removeEventListener('scroll', follow); pin.disconnect(); });
    try {
      const res = await fetch(`${DEFAULT_API}/health`, { signal: controller.signal });
      const health = res.ok ? await res.json() : null;
      if (!disposed) {
        mode.value = health?.conversation?.mode === "ai" ? "ai" : "demo";
        speech.available = health?.conversation?.voice === true;
        speech.microphone = !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined';
        voiceController.value = noSerialize(new CompanionVoice(DEFAULT_API, {
          phase: phase => { speech.phase = phase; },
          error: message => { speech.error = message; },
          seconds: seconds => { speech.seconds = seconds; },
          level: level => { presenceRoot.value?.style.setProperty('--voice-level', String(level)); },
          transcript: (text, truncated) => {
            const draft = [spokenDraftBase.value.trim(), text.trim()].filter(Boolean).join(' ');
            threads[activeId.value].draft = draft.slice(0, 600);
            speech.notice = truncated || draft.length > 600 ? 'The draft reached 600 characters. Please review it before sending.' : 'Your words are ready. Edit them, then send.';
            document.getElementById('converse-input')?.focus();
          },
        }, health?.conversation?.voiceRequiresAccount === true));
      }
    } catch {
      if (!disposed) mode.value = "demo";
    } finally { clearTimeout(timeout); }
  }, { strategy: "document-ready" });

  const thread = threads[persona.value.id];
  const voice = voiceOf(persona.value.id);
  const next = suggestions(thread.covered);
  const vars = fittingVars(t.value);
  const profile = PORTRAITS[persona.value.id] ?? PORTRAITS.cyberbotanist;
  const recording = ['requesting', 'listening', 'transcribing'].includes(speech.phase);
  const presence = speech.phase === 'idle' && thread.pending ? 'thinking' : speech.phase;
  const presenceLabel = ({ idle: 'Here with you', requesting: 'Waiting for your microphone', listening: `Listening · ${speech.seconds}s`, transcribing: 'Writing down your words', thinking: `${voice.handle} is thinking`, preparing: 'Preparing the voice', speaking: `${voice.handle} is speaking`, paused: 'Voice paused' } as Record<string, string>)[presence];

  return (
    <div class="companion-conversation" ref={presenceRoot} data-voice-state={presence}>
      <div role="tablist" aria-label="Talk to" class="companion-choices">
        {personas.map((p) => {
          const v = voiceOf(p.id);
          const selected = p.id === activeId.value;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              id={`talk-${p.id}`}
              aria-selected={selected}
              aria-controls="conversation-panel"
              tabIndex={selected ? 0 : -1}
              onKeyDown$={[sync$((event: KeyboardEvent) => {
                if (["Home", "End", "ArrowRight", "ArrowLeft"].includes(event.key)) event.preventDefault();
              }), $(async (event: KeyboardEvent) => {
                const i = personas.findIndex((item) => item.id === p.id);
                const n = event.key === "Home" ? 0 : event.key === "End" ? personas.length - 1 : event.key === "ArrowRight" ? (i + 1) % personas.length : event.key === "ArrowLeft" ? (i + personas.length - 1) % personas.length : -1;
                if (n < 0) return;
                await open(personas[n].id);
                document.getElementById(`talk-${personas[n].id}`)?.focus();
              })]}
              onClick$={() => open(p.id)}
              class="companion-choice"
            >
              <img src={`/assets/companions/${p.id}.webp`} width={48} height={48} alt="" loading="lazy" />
              <span><strong>{v.handle}</strong><small>{PORTRAITS[p.id]?.world ?? p.name}</small></span>
              <span class="companion-selected" aria-hidden="true">↗</span>
            </button>
          );
        })}
      </div>

      {/* Keep DOM and event captures specific to the selected thread. */}
      <section key={persona.value.id} id="conversation-panel" role="tabpanel" aria-labelledby={`talk-${persona.value.id}`} class="conversation-panel">
        <aside class="companion-profile" aria-label={`Meet ${voice.handle}`}>
          <div class="companion-portrait-frame"><img class="companion-portrait" src={`/assets/companions/${persona.value.id}.webp`} width={1024} height={1024} alt={profile.alt} loading="lazy" /></div>
          <div class="companion-profile-copy">
            <p class="companion-world">{profile.world}</p>
            <h3>{profile.line}</h3>
            <dl class="companion-influences">
              <div><dt>On repeat</dt><dd>{persona.value.influences.music.artists.slice(0, 2).join(" · ")}</dd></div>
              <div><dt>Feels like home</dt><dd>{persona.value.influences.spaces.slice(0, 2).join(" · ")}</dd></div>
            </dl>
          </div>
        </aside>

        <div class="companion-dialogue">
          <header class="companion-dialogue-heading">
            <div><h3>In conversation with {voice.handle}</h3><p>{voice.status}</p></div>
            <span class="conversation-mode">{mode.value === "ai" ? "AI conversation" : mode.value === "checking" ? "Connecting…" : "Guided demo"}</span>
          </header>

          <div class="companion-presence">
            <span class="companion-presence-indicator" aria-hidden="true"><i /><i /><i /><i /><i /></span>
            <span role="status" aria-live="polite" aria-atomic="true">{presence === 'listening' ? 'Listening' : presenceLabel}</span>
            {presence === 'listening' && <span class="voice-timer" aria-hidden="true">{speech.seconds}s / 45s</span>}
            {(speech.phase === 'speaking' || speech.phase === 'paused') && <button type="button" onClick$={() => speech.phase === 'paused' ? voiceController.value?.resume() : voiceController.value?.pause()}><VoiceIcon kind={speech.phase === 'paused' ? 'play' : 'pause'} />{speech.phase === 'paused' ? 'Resume' : 'Pause'}</button>}
            {speech.phase !== 'idle' && <button type="button" onClick$={() => voiceController.value?.stop()} aria-label={recording ? 'Cancel recording' : 'Stop voice'}><VoiceIcon kind="stop" />{recording ? 'Cancel' : 'Stop'}</button>}
          </div>

          <div
            ref={log}
            data-lenis-prevent
            tabIndex={0}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label={`Conversation with ${voice.handle}`}
            class="companion-log"
          >
            {thread.turns.map((turn, i) => {
              const grouped = thread.turns[i - 1]?.from === turn.from;
              return (
                <div key={i} class="companion-message msg-in" data-from={turn.from} data-grouped={grouped}>
                  {!grouped && <span class="companion-speaker">{turn.from === "you" ? "You" : voice.handle}</span>}
                  <p>{turn.text}</p>
                  {turn.attach && <div class="fitting companion-attachment" style={vars}><AttachmentView a={turn.attach} persona={persona.value} tokens={t.value} /></div>}
                </div>
              );
            })}
            {thread.pending && (
              <div class="companion-typing" aria-label={`${voice.handle} is typing`} role="status">
                <span>{voice.handle} is thinking</span><i class="typing-dot" /><i class="typing-dot" /><i class="typing-dot" />
              </div>
            )}
          </div>

          <footer class="companion-reply">
            {thread.error && <div role="alert" class="conversation-error">
              <p>{thread.error}</p>
              <button type="button" disabled={thread.pending} onClick$={() => {
                const last = thread.turns.filter((turn) => turn.from === "you").at(-1);
                if (last && !thread.pending) { thread.pending = true; return reply(activeId.value, last.text); }
              }}>Retry reply</button>
            </div>}
            {next.length > 0 && <div class="companion-suggestions" aria-label="Suggested questions">
              {next.map((s) => <button key={s.topic} type="button" disabled={thread.pending || recording || mode.value === "checking"} onClick$={() => send(s.label)}>{s.label}<span aria-hidden="true">↗</span></button>)}
            </div>}
            <form preventdefault:submit onSubmit$={(_, form) => send(String(new FormData(form).get("message") ?? ""))} class="companion-composer">
              <label for="converse-input" class={css({ srOnly: true })}>Message {voice.handle}</label>
              <textarea
                id="converse-input"
                name="message"
                rows={2}
                autocomplete="off"
                maxLength={600}
                readOnly={recording}
                placeholder={`Ask ${voice.handle} about a design, a feeling, a favourite film…`}
                value={thread.draft}
                onInput$={(_, el) => (thread.draft = el.value)}
                onKeyDown$={sync$((event: KeyboardEvent, el: HTMLTextAreaElement) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
                    event.preventDefault();
                    el.form?.requestSubmit();
                  }
                })}
              />
              <div class="companion-composer-actions">
                <button class="companion-microphone" type="button" aria-pressed={speech.phase === 'listening'} disabled={!speech.available || !speech.microphone || thread.pending || ['requesting', 'transcribing'].includes(speech.phase)} onClick$={() => {
                  if (speech.phase === 'listening') { voiceController.value?.finishListening(); return; }
                  spokenDraftBase.value = thread.draft; speech.notice = '';
                  return voiceController.value?.listen();
                }} aria-describedby="voice-help"><VoiceIcon kind={speech.phase === 'listening' ? 'stop' : 'mic'} />{speech.phase === 'listening' ? 'Finish' : 'Talk'}</button>
                <span>Shift + Enter for a new line</span>
                <button type="submit" disabled={!thread.draft.trim() || thread.pending || recording || mode.value === "checking"} aria-label={`Send message to ${voice.handle}`}>
                  Send <span aria-hidden="true">↗</span>
                </button>
              </div>
            </form>
            <div class="companion-voice-options">
              <button type="button" disabled={!speech.available} aria-pressed={speech.auto} onClick$={() => {
                speech.auto = !speech.auto;
                if (speech.auto) voiceController.value?.unlock();
                else voiceController.value?.stop();
              }}><VoiceIcon kind={speech.auto ? 'speaker' : 'mute'} />Spoken replies {speech.auto ? 'on' : 'off'}</button>
              <button type="button" disabled={!speech.available || thread.pending || speech.phase !== 'idle'} onClick$={() => {
                const turns = thread.turns;
                let start = turns.length - 1;
                while (start > 0 && turns[start - 1].from === 'them') start--;
                const text = turns.slice(start).filter(turn => turn.from === 'them').map(turn => turn.text).join(' ');
                if (text) return voiceController.value?.speak(activeId.value, text);
              }}>Listen to reply <VoiceIcon kind="play" /></button>
            </div>
            {speech.error && <p class="companion-voice-error" role="alert">{speech.error}</p>}
            {speech.notice && <p class="companion-voice-notice" role="status">{speech.notice}</p>}
            <p id="voice-help" class="voice-help">{!speech.available ? 'Voice is unavailable here right now.' : !speech.microphone ? 'Microphone recording needs a supported browser on a secure connection. You can still listen to replies.' : 'Tap Talk, then Finish. Audio goes to fal for transcription; review the words before sending.'}</p>
            <p class="conversation-note">{mode.value === "ai" ? "AI replies grounded in this character’s profile." : mode.value === "checking" ? "Checking conversation availability…" : "An authored conversation to explore their taste. Open-ended AI chat is unavailable here."}</p>
          </footer>
        </div>
      </section>
      <div class="companion-colophon"><span>Three illustrated characters. Three ways of seeing.</span><a href="/method/">How their taste becomes a design <span aria-hidden="true">↗</span></a></div>
    </div>
  );
});

const VoiceIcon = component$<{ kind: 'mic' | 'play' | 'pause' | 'stop' | 'speaker' | 'mute' }>(({ kind }) => {
  const paths = {
    mic: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',
    play: 'm8 5 11 7-11 7V5Z', pause: 'M8 5v14M16 5v14', stop: 'M6 6h12v12H6V6Z',
    speaker: 'M11 5 6 9H3v6h3l5 4V5ZM15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14',
    mute: 'M11 5 6 9H3v6h3l5 4V5ZM16 9l6 6M22 9l-6 6',
  };
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d={paths[kind]} /></svg>;
});

const AttachmentView = component$<{ a: Attachment; persona: PersonaRecord; tokens: DesignTokens }>(({ a, persona, tokens }) => {
  const card = css({ maxW: "min(420px, 92%)", p: 3, display: "flex", flexDirection: "column", gap: 2 });
  const cardStyle = { background: "var(--f-surface)", border: "1px solid var(--f-border)", borderRadius: "6px" };
  switch (a.kind) {
    case "palette":
      return (
        <div class="conversation-palette" role="group" aria-label={`${voiceOf(persona.id).handle}’s palette`}>
          {a.swatches.map((s) => (
            <span key={s.role} title={s.hex.toUpperCase()}>
              <i style={{ background: s.hex }} />
              <span>{({ background: "Ground", surface: "Surface", primary: "Main", secondary: "Support", accent: "Accent", text: "Ink" } as Record<string, string>)[s.role] ?? s.role}</span>
            </span>
          ))}
        </div>
      );
    case "type":
      return (
        <div class={card} style={cardStyle}>
          <span class="f-heading" style={{ fontSize: "28px", lineHeight: 1.15, overflowWrap: "anywhere" }}>Aa · {a.heading}</span>
          <span style={{ fontSize: "14px", color: "var(--f-muted)" }}>{a.body}: the quick brown fox reads the whole manual.</span>
        </div>
      );
    case "garment":
      return (
        <div class={css({ w: "min(440px, 92%)", pointerEvents: "none" })} aria-label="A screen in this fitting" role="img">
          <div>
            <Garment persona={persona} tokens={tokens} size="compact" />
          </div>
        </div>
      );
    case "steps":
      return (
        <ol class={card} style={{ ...cardStyle, flexDirection: "row", gap: "6px", listStyle: "none" }} aria-label="Baste's method">
          {STEP_NAMES.map((n, i) => (
            <li
              key={n}
              class={css({ flex: 1, textAlign: "center", fontSize: "11.5px", py: 2, px: 1 })}
              style={{
                borderRadius: "var(--f-radius)",
                background: i === a.active ? "var(--f-primary)" : "transparent",
                color: i === a.active ? "var(--f-on-primary)" : "var(--f-muted)",
                border: "1px var(--f-border-style) var(--f-border)",
              }}
            >
              <span class="f-mono" style={{ display: "block", fontSize: "10px", opacity: 0.8 }}>0{i + 1}</span>
              {n}
            </li>
          ))}
        </ol>
      );
    case "judge":
      return (
        <div class={card} style={cardStyle}>
          {JUDGE.map((j, i) => (
            <div key={j.k} class={css({ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 54px 34px", gap: 2, alignItems: "center", fontSize: "12.5px" })}>
              <span>{j.k}</span>
              <span style={{ height: "6px", background: "var(--f-border)", borderRadius: "99px", overflow: "hidden" }}>
                <i style={{ display: "block", height: "100%", width: `${j.w * 3.33}%`, background: i === 0 ? "var(--f-accent)" : "var(--f-primary)" }} />
              </span>
              <span class="f-mono" style={{ textAlign: "right", color: "var(--f-muted)" }}>{j.w}%</span>
            </div>
          ))}
        </div>
      );
    case "link":
      return (
        <a href={a.href} class="f-btn f-btn--ghost" style={{ fontSize: "13.5px", padding: "8px 14px" }}>
          {a.label} <span aria-hidden="true">→</span>
        </a>
      );
  }
});
