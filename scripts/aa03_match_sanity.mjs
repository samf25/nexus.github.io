import { glyphTemplatePoints, matchRuneAgainstGrimoire } from '../src/systems/arcaneAscension.js';

function noisy(points, amount = 0.02, seed = 1) {
  let s = seed >>> 0;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return points.map(([x, y]) => ({
    x: Math.min(1, Math.max(0, x + ((next() * 2 - 1) * amount))),
    y: Math.min(1, Math.max(0, y + ((next() * 2 - 1) * amount))),
  }));
}

const glyphs = ['crd', 'worm', 'dcc', 'aa'];

function runCase(points, label) {
  const result = matchRuneAgainstGrimoire({
    strokePoints: points,
    glyphType: 'region',
    ownedGlyphs: glyphs,
  });
  return { label, best: result.bestMatch, score: result.accuracyScore.toFixed(4), ranked: result.ranked.slice(0, 4).map((entry) => `${entry.glyphId}:${entry.distance.toFixed(4)}`).join(' | ') };
}

for (const glyph of glyphs) {
  const template = glyphTemplatePoints('region', glyph);
  const exact = runCase(template, `${glyph}:exact`);
  const jitter = runCase(noisy(template, 0.018, glyph.charCodeAt(0)), `${glyph}:jitter`);
  console.log(`${exact.label} -> ${exact.best} (${exact.score})`);
  console.log(`  ${exact.ranked}`);
  console.log(`${jitter.label} -> ${jitter.best} (${jitter.score})`);
  console.log(`  ${jitter.ranked}`);
}

const scribble = [
  { x: 0.12, y: 0.3 },
  { x: 0.3, y: 0.5 },
  { x: 0.5, y: 0.45 },
  { x: 0.65, y: 0.2 },
  { x: 0.8, y: 0.82 },
];
const scribbleResult = runCase(scribble, 'scribble');
console.log(`${scribbleResult.label} -> ${scribbleResult.best} (${scribbleResult.score})`);
console.log(`  ${scribbleResult.ranked}`);
