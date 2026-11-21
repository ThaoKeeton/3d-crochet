import { writeFileSync } from 'node:fs';
import { mirrorGraph } from '../src/domain/builder';
import { dist, type Vec3 } from '../src/domain/math';
import {
  buildChain,
  buildDisc,
  buildEar,
  buildFoundationDemo,
  buildGranny,
  buildMagicRing,
  buildSlipknot,
  buildSphere,
  buildStrap,
} from '../src/domain/motifs';
import { bagPreset, seamIssues, withPreview } from '../src/domain/piece';
import { stepsForGraph } from '../src/domain/teach';
import type { Graph } from '../src/domain/types';

let failed = 0;

function assert(cond: boolean, message: string) {
  if (!cond) {
    failed += 1;
    console.error('FAIL', message);
  }
}

function inspect(graph: Graph) {
  for (const sample of graph.samples) {
    for (const n of sample.p) assert(Number.isFinite(n), `${graph.id} has a non-finite point`);
  }
  let tiny = 0;
  for (let i = 1; i < graph.samples.length; i++) {
    if (dist(graph.samples[i - 1].p, graph.samples[i].p) < 1e-4) tiny += 1;
  }
  assert(graph.samples.length > 8, `${graph.id} is almost empty`);
  assert(graph.lengthCm > 1, `${graph.id} length ${graph.lengthCm}`);
  assert(tiny === 0, `${graph.id} has ${tiny} tiny segments`);
  console.log(
    graph.id,
    'stitches',
    graph.stitches.length,
    'cm',
    graph.lengthCm.toFixed(1),
    'edges',
    graph.edges.map((edge) => `${edge.id}:${edge.count}`).join(', '),
  );
}

function svg(graph: Graph, file: string) {
  const pad = 8;
  const min = graph.min;
  const max = graph.max;
  const w = Math.max(1, max[0] - min[0]);
  const h = Math.max(1, max[1] - min[1]);
  const scale = 28;
  const W = Math.ceil(w * scale + pad * 2);
  const H = Math.ceil(h * scale + pad * 2);
  const map = (p: Vec3) => {
    const x = pad + (p[0] - min[0]) * scale;
    const y = pad + (max[1] - p[1]) * scale;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  };
  const pts = graph.samples.map((sample) => map(sample.p)).join(' ');
  const rings = graph.stitches
    .filter((stitch) => stitch.insertion)
    .map((stitch) => {
      const p = stitch.insertion as Vec3;
      const [x, y] = map(p).split(',');
      return `<circle cx="${x}" cy="${y}" r="2.2" fill="#c4624a"/>`;
    })
    .join('');
  const body = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="100%" height="100%" fill="#f3ecdf"/>
<polyline points="${pts}" fill="none" stroke="#c4624a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
${rings}
</svg>`;
  writeFileSync(file, body);
}

for (const graph of [
  buildSlipknot(),
  buildChain(8),
  buildFoundationDemo('sc'),
  buildFoundationDemo('hdc'),
  buildFoundationDemo('dc'),
  buildFoundationDemo('slst'),
  buildFoundationDemo('inc'),
  buildFoundationDemo('dec'),
  buildMagicRing(),
  buildDisc(5),
  buildGranny(1),
  buildGranny(4),
  buildStrap(3, 28),
  buildEar(3),
  buildSphere(),
]) {
  inspect(graph);
}

for (const rounds of [1, 2, 3, 4, 5]) {
  const graph = buildGranny(rounds);
  const counts = ['s', 'e', 'n', 'w'].map((id) => graph.edges.find((edge) => edge.id === id)?.count ?? -1);
  assert(counts.every((count) => count === counts[0] && count > 0), `granny ${rounds} edges ${counts.join(',')}`);
}
assert(buildGranny(4).edges[0].count > buildGranny(3).edges[0].count, 'more rounds, more edge stitches');

const chain = buildChain(8);
const chainSteps = stepsForGraph(chain, { rich: true });
assert(chainSteps.some((step) => step.beat === 'insert'), 'chain demonstrates insertion');
assert(chainSteps.some((step) => step.beat === 'wrap'), 'chain demonstrates wrap');
assert(chainSteps.some((step) => step.beat === 'loop'), 'chain demonstrates the loop');
assert(chainSteps.filter((step) => step.stitchId === chain.stitches[0].id).length >= 3, 'one stitch has several beats');

const dc = buildFoundationDemo('dc');
const dcSteps = stepsForGraph(dc, { fromRound: 1, rich: true });
assert(dcSteps.some((step) => step.beat === 'insert'), 'dc insert');
assert(dcSteps.some((step) => step.beat === 'wrap'), 'dc wrap');
assert(dcSteps.some((step) => step.loops === 3), 'dc shows 3 loops');
assert(dcSteps.some((step) => step.loops === 1 && step.beat.startsWith('finish')), 'dc returns to one loop');

const mirrored = mirrorGraph(buildGranny(2));
assert(mirrored.samples[0].p[0] === -buildGranny(2).samples[0].p[0], 'mirror flips x');

const bag = bagPreset();
assert(bag.modules.filter((mod) => mod.kind === 'granny').length === 4, 'bag has 4 squares');
assert(bag.modules.some((mod) => mod.kind === 'strap'), 'bag has a strap');
assert(bag.seams.length >= 4, `bag seams ${bag.seams.length}`);
const calm = seamIssues(bag);
assert(calm.length === 0, `preset bag should match, issues ${calm.map((issue) => issue.message).join(' | ')}`);

const broken = {
  ...bag,
  modules: bag.modules.map((mod) => (mod.id === 'front' ? { ...mod, params: { ...mod.params, rounds: 3 } } : mod)),
};
const issues = seamIssues(broken);
assert(issues.length > 0, 'mismatched rounds should warn');
const preview = withPreview(broken, issues[0]);
assert(preview.modules.find((mod) => mod.id === 'front')?.params.rounds === 4, 'preview restores the matching round');
assert(seamIssues(preview).length < issues.length, 'preview clears that mismatch');

svg(buildChain(8), '/tmp/chain.svg');
svg(buildGranny(1), '/tmp/granny1.svg');
svg(buildGranny(4), '/tmp/granny4.svg');
svg(buildFoundationDemo('dc'), '/tmp/dc.svg');
svg(buildDisc(4), '/tmp/disc.svg');
svg(buildMagicRing(), '/tmp/magic.svg');

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('graphs ok');
