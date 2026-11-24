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
import { crochetize, smoothCounts } from '../src/domain/crochetize';
import { exportStl, parseMeshFile, toMesh, uvSphere } from '../src/domain/mesh';
import { bagPreset, seamIssues, withPreview } from '../src/domain/piece';
import { sculptFromPrompt } from '../src/domain/sculpt';
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

const spoken = sculptFromPrompt('红黑小熊');
assert(spoken.spoken, '红黑 is an explicit palette');
assert(spoken.palettes.length >= 3, 'explicit colors still offer variants');
const spokenColors = Object.values(spoken.palettes[0].colors).map((hex) => hex.toLowerCase());
assert(spokenColors.includes('#c23b3b') && spokenColors.includes('#1c1a19'), `红黑小熊 colors ${spokenColors.join(',')}`);
const plain = sculptFromPrompt('一只小熊挂件');
assert(!plain.spoken, 'no color words means themed palettes');
assert(plain.palettes.length >= 3, 'themed palettes');
for (const palette of plain.palettes) {
  for (const part of plain.parts) assert(Boolean(palette.colors[part.id]), `${palette.name} missing ${part.name}`);
}
const fan = sculptFromPrompt('华晨宇应援公仔');
assert(fan.palettes[0].name.includes('火星'), `fan palette ${fan.palettes[0].name}`);
const mint = sculptFromPrompt('薄荷绿和奶白兔耳包');
const mintColors = Object.values(mint.palettes[0].colors).map((hex) => hex.toLowerCase());
assert(mintColors.includes('#7ec8bc') && mintColors.includes('#f7f3ea'), `mint colors ${mintColors.join(',')}`);

const sphere = toMesh('s', '球', 'body', uvSphere(4, 6));
const stl = exportStl([sphere]);
const parsed = parseMeshFile('ball.stl', stl);
const triCount = (meshes: { indices: { length: number } }[]) => meshes.reduce((sum, mesh) => sum + mesh.indices.length / 3, 0);
assert(triCount(parsed) === sphere.indices.length / 3, `stl triangles ${triCount(parsed)}`);

const shaped = smoothCounts([6, 48, 10, 10, 30]);
for (let i = 1; i < shaped.length; i++) {
  const cap = Math.max(2, Math.round(shaped[i - 1] * 0.34));
  assert(Math.abs(shaped[i] - shaped[i - 1]) <= cap, `smooth jump ${shaped[i - 1]} -> ${shaped[i]}`);
}
const plan = crochetize(spoken.parts, spoken.palettes[0].colors, 12, 4);
assert(plan.rounds[0]?.line.includes('魔法环'), plan.rounds[0]?.line ?? 'no round');
assert(plan.pattern.includes('短针'), 'pattern names the stitch');
assert(plan.graphs.length === spoken.parts.length, 'each part becomes yarn');
let previousPart = '';
let previousCount = 0;
for (const round of plan.rounds) {
  if (round.partId !== previousPart) {
    previousPart = round.partId;
    previousCount = round.count;
    continue;
  }
  const cap = Math.max(2, Math.round(previousCount * 0.34));
  assert(Math.abs(round.count - previousCount) <= cap + 0.01, `${round.partName} jump`);
  previousCount = round.count;
}

if (failed) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('graphs ok');
