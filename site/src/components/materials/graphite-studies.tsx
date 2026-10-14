import { $, component$, useSignal, useStyles$ } from "@builder.io/qwik";
import styles from "./material-room.css?inline";

interface Study {
  id: string;
  name: string;
  description: string;
  motion?: boolean;
  files: Array<{ href: string; label: string; kind: string }>;
}

const DIR = "/materials/graphite";
const studies: Study[] = [
  {
    id: "chromatic-bath",
    name: "Chromatic bath",
    description: "Warm dye moves through a warped field. A cyclic colour ramp changes the light without replacing the composition.",
    motion: true,
    files: [
      { href: `${DIR}/chromatic-bath.graphite`, label: "Drawing", kind: "Graphite" },
      { href: `${DIR}/chromatic-bath-loop.graphite`, label: "Animated drawing", kind: "Graphite" },
      { href: `${DIR}/chromatic-bath-loop.mp4`, label: "Motion study", kind: "MP4" },
    ],
  },
  {
    id: "chalk-strata",
    name: "Chalk strata",
    description: "A repeated blue-and-paper ramp traces the same height field many times, building a landscape of contours.",
    files: [{ href: `${DIR}/chalk-strata.graphite`, label: "Drawing", kind: "Graphite" }],
  },
  {
    id: "radial-dye",
    name: "Radial dye",
    description: "A dyed strip repeats around a centre. Colour and rotation share a clock, so the whole fan turns together.",
    motion: true,
    files: [
      { href: `${DIR}/radial-dye.graphite`, label: "Drawing", kind: "Graphite" },
      { href: `${DIR}/radial-dye.svg`, label: "Vector", kind: "SVG" },
      { href: `${DIR}/radial-dye-loop.graphite`, label: "Animated drawing", kind: "Graphite" },
      { href: `${DIR}/radial-dye-pointer.graphite`, label: "Pointer-driven drawing", kind: "Graphite" },
      { href: `${DIR}/radial-dye-loop.mp4`, label: "Motion study", kind: "MP4" },
    ],
  },
  {
    id: "interference-weave",
    name: "Interference weave",
    description: "Two slightly rotated arrays create a slower rhythm where their threads cross. Small changes make large bands.",
    files: [
      { href: `${DIR}/interference-weave.graphite`, label: "Drawing", kind: "Graphite" },
      { href: `${DIR}/interference-weave.svg`, label: "Vector", kind: "SVG" },
    ],
  },
];

/** A motion study: a still until asked, then the loop plays (and pauses again on request). */
const MotionStudy = component$<{ study: Study }>(({ study }) => {
  const video = useSignal<HTMLVideoElement>();
  const playing = useSignal(false);
  const toggle = $(async () => {
    const v = video.value;
    if (!v) return;
    if (v.paused) {
      try {
        await v.play();
        playing.value = true;
      } catch {
        playing.value = false;
      }
    } else {
      v.pause();
      playing.value = false;
    }
  });
  return (
    <div class="mr-study-media">
      <video
        ref={video}
        src={study.files.find((f) => f.kind === "MP4")!.href}
        poster={`${DIR}/${study.id}.webp`}
        width={1024}
        height={640}
        muted
        loop
        playsInline
        preload="none"
        aria-label={`${study.name}, motion study`}
        onEnded$={() => (playing.value = false)}
      />
      <button type="button" class="mr-study-play" aria-pressed={playing.value} onClick$={toggle}>
        <span aria-hidden="true">{playing.value ? "❚❚" : "▶"}</span>
        {playing.value ? "Pause" : "Watch it move"}
      </button>
    </div>
  );
});

export const GraphiteStudies = component$(() => {
  useStyles$(styles);
  return (
    <section class="mr-section mr-graphite" aria-labelledby="graphite-studies">
      <header class="mr-section-head">
        <span class="label mr-kicker">From the Graphite workbench</span>
        <h2 id="graphite-studies" class="display">Four studies to take apart.</h2>
        <p>
          Native documents for{" "}
          <a href="https://graphite.rs" rel="noopener" target="_blank">Graphite</a>, the open-source node-based editor,
          picked from twenty variations. Open one to follow how the pattern is built, then change a node and make it yours.
        </p>
      </header>
      <div class="mr-studies">
        {studies.map((s) => (
          <article key={s.id} class="mr-study">
            {s.motion ? (
              <MotionStudy study={s} />
            ) : (
              <div class="mr-study-media">
                <img src={`${DIR}/${s.id}.webp`} width={1024} height={640} loading="lazy" decoding="async" alt={`${s.name}, a Graphite study`} />
              </div>
            )}
            <div class="mr-study-body">
              <h3>{s.name}</h3>
              <p>{s.description}</p>
              <ul class="mr-files" aria-label={`${s.name} downloads`}>
                {s.files.map((f) => (
                  <li key={f.href}>
                    <a href={f.href} download class="mr-file" data-juice="chalk">
                      <span>{f.kind}</span>
                      {f.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
});
