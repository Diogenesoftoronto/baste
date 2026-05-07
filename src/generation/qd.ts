/**
 * Quality Diversity (QD) Engine
 * 
 * QD algorithms maintain a diverse archive of high-quality solutions.
 * We use a simplified MAP-Elites approach for generating diverse design assets.
 * 
 * Rather than optimizing for a single best solution, we explore a feature space
 * and keep the best solution found for each region of that space.
 */

export interface FeatureDescriptor {
  name: string;
  min: number;
  max: number;
  bins: number;
}

export interface QDConfig {
  // Feature dimensions that define our diversity space
  features: FeatureDescriptor[];

  // How many iterations to run
  iterations: number;

  // How many children to generate per iteration
  batchSize: number;

  // Mutation rate for generating variations
  mutationRate: number;

  // Minimum quality score to enter archive
  qualityThreshold: number;
}

export interface QDSolution<T> {
  // The actual solution (prompt, asset, etc.)
  genome: T;

  // Quality score (0-1, higher is better)
  quality: number;

  // Position in feature space
  features: number[];

  // Generation this was created in
  generation: number;

  // Parent solutions
  parents?: string[];
}

export interface QDArchive<T> {
  // Grid of solutions indexed by feature bins
  cells: Map<string, QDSolution<T>>;

  // Feature descriptors
  descriptors: FeatureDescriptor[];

  // Stats
  coverage: number; // % of cells filled
  maxQuality: number;
  averageQuality: number;
}

/**
 * Default feature space for visual assets
 * Two dimensions: color temperature (warm->cool) and density (sparse->dense)
 */
export const defaultAssetFeatures: FeatureDescriptor[] = [
  {
    name: "color_temperature",
    min: -1, // cool/blue
    max: 1,  // warm/red
    bins: 5,
  },
  {
    name: "visual_density",
    min: 0,  // minimal
    max: 1,  // maximal
    bins: 5,
  },
  {
    name: "abstractness",
    min: 0,  // literal/representational
    max: 1,  // abstract
    bins: 3,
  },
];

/**
 * Generate feature bin key from feature values
 */
export function getBinKey(features: number[], descriptors: FeatureDescriptor[]): string {
  const bins = features.map((f, i) => {
    const desc = descriptors[i];
    const normalized = (f - desc.min) / (desc.max - desc.min);
    const binIdx = Math.min(
      Math.floor(normalized * desc.bins),
      desc.bins - 1
    );
    return `${desc.name}:${binIdx}`;
  });
  return bins.join("|");
}

/**
 * Initialize empty archive
 */
export function createArchive<T>(descriptors: FeatureDescriptor[]): QDArchive<T> {
  return {
    cells: new Map(),
    descriptors,
    coverage: 0,
    maxQuality: 0,
    averageQuality: 0,
  };
}

/**
 * Add solution to archive if it's better than existing in that cell
 */
export function addToArchive<T>(
  archive: QDArchive<T>,
  solution: QDSolution<T>
): { added: boolean; replaced: boolean } {
  const key = getBinKey(solution.features, archive.descriptors);
  const existing = archive.cells.get(key);

  if (!existing || solution.quality > existing.quality) {
    archive.cells.set(key, solution);
    updateStats(archive);
    return { added: true, replaced: !!existing };
  }

  return { added: false, replaced: false };
}

function updateStats<T>(archive: QDArchive<T>) {
  const solutions = Array.from(archive.cells.values());
  const totalCells = archive.descriptors.reduce((acc, d) => acc * d.bins, 1);

  archive.coverage = solutions.length / totalCells;
  archive.maxQuality = Math.max(...solutions.map((s) => s.quality), 0);
  archive.averageQuality =
    solutions.reduce((acc, s) => acc + s.quality, 0) / solutions.length || 0;
}

/**
 * Select random parent from archive, weighted by quality
 */
export function selectParent<T>(archive: QDArchive<T>): QDSolution<T> | null {
  const solutions = Array.from(archive.cells.values());
  if (solutions.length === 0) return null;

  // Weighted by quality squared (elitist but allows exploration)
  const weights = solutions.map((s) => s.quality ** 2 + 0.1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < solutions.length; i++) {
    random -= weights[i];
    if (random <= 0) return solutions[i];
  }

  return solutions[solutions.length - 1];
}

/**
 * Run QD algorithm to generate diverse, high-quality solutions
 */
export async function runQD<T>(
  config: QDConfig,
  generateSeed: () => Promise<QDSolution<T>>,
  mutate: (parent: QDSolution<T>, rate: number) => Promise<QDSolution<T>>,
  evaluate: (genome: T) => Promise<{ quality: number; features: number[] }>
): Promise<QDArchive<T>> {
  const archive = createArchive<T>(config.features);

  // Initialize with seeds
  console.log(`🌱 Initializing QD archive with ${config.batchSize} seeds...`);
  for (let i = 0; i < config.batchSize; i++) {
    const seed = await generateSeed();
    const evaluation = await evaluate(seed.genome);

    if (evaluation.quality >= config.qualityThreshold) {
      addToArchive(archive, {
        ...seed,
        quality: evaluation.quality,
        features: evaluation.features,
        generation: 0,
      });
    }
  }

  // Evolution loop
  for (let gen = 1; gen <= config.iterations; gen++) {
    console.log(`\n🧬 Generation ${gen}/${config.iterations}`);
    console.log(`   Archive: ${archive.cells.size} cells | Coverage: ${(archive.coverage * 100).toFixed(1)}% | Max Q: ${archive.maxQuality.toFixed(3)}`);

    const batchPromises: Promise<void>[] = [];

    for (let b = 0; b < config.batchSize; b++) {
      batchPromises.push(
        (async () => {
          const parent = selectParent(archive);
          if (!parent) return;

          const child = await mutate(parent, config.mutationRate);
          const evaluation = await evaluate(child.genome);

          if (evaluation.quality >= config.qualityThreshold) {
            addToArchive(archive, {
              ...child,
              quality: evaluation.quality,
              features: evaluation.features,
              generation: gen,
              parents: [getBinKey(parent.features, archive.descriptors)],
            });
          }
        })()
      );
    }

    await Promise.all(batchPromises);
  }

  console.log(`\n✅ QD Complete!`);
  console.log(`   Final archive: ${archive.cells.size} cells | Coverage: ${(archive.coverage * 100).toFixed(1)}% | Max Q: ${archive.maxQuality.toFixed(3)}`);

  return archive;
}

/**
 * Get diverse samples from archive for presentation
 */
export function getDiverseSamples<T>(
  archive: QDArchive<T>,
  count: number
): QDSolution<T>[] {
  const solutions = Array.from(archive.cells.values());

  // Sort by quality and then sample across the feature space
  solutions.sort((a, b) => b.quality - a.quality);

  if (solutions.length <= count) return solutions;

  // Greedy selection to maximize feature space coverage
  const selected: QDSolution<T>[] = [];
  const remaining = [...solutions];

  // Always include the best
  selected.push(remaining.shift()!);

  while (selected.length < count && remaining.length > 0) {
    // Pick the solution furthest from all selected in feature space
    let maxMinDist = -1;
    let maxIdx = 0;

    for (let i = 0; i < remaining.length; i++) {
      let minDist = Infinity;
      for (const sel of selected) {
        const dist = euclideanDistance(remaining[i].features, sel.features);
        minDist = Math.min(minDist, dist);
      }
      if (minDist > maxMinDist) {
        maxMinDist = minDist;
        maxIdx = i;
      }
    }

    selected.push(remaining[maxIdx]);
    remaining.splice(maxIdx, 1);
  }

  return selected;
}

function euclideanDistance(a: number[], b: number[]): number {
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
}
