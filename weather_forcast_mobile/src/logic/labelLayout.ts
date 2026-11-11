/**
 * 1-D label de-overlap. Given desired positions (any order), return positions at least
 * `gap` apart, kept within [min, max], moving each label as little as possible:
 * labels that collide are merged into a cluster centred on their mean desired position.
 * Returns positions in the same order as the input.
 */
export function spreadLabels(desired: number[], gap: number, min = -Infinity, max = Infinity): number[] {
  const order = desired.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  type Cluster = { items: typeof order; start: number };
  const span = (c: Cluster) => (c.items.length - 1) * gap;
  const place = (c: Cluster) => {
    const mean = c.items.reduce((s, it) => s + it.v, 0) / c.items.length;
    c.start = Math.min(Math.max(mean - span(c) / 2, min), max - span(c));
  };

  const clusters: Cluster[] = [];
  for (const it of order) {
    const c: Cluster = { items: [it], start: 0 };
    place(c);
    clusters.push(c);
    // Merge backwards while the new cluster overlaps the previous one
    while (clusters.length > 1) {
      const b = clusters[clusters.length - 1];
      const a = clusters[clusters.length - 2];
      if (a.start + span(a) + gap <= b.start + 1e-9) break;
      a.items.push(...b.items);
      clusters.pop();
      place(a);
    }
  }

  const out = new Array<number>(desired.length);
  for (const c of clusters) c.items.forEach((it, k) => (out[it.i] = c.start + k * gap));
  return out;
}
