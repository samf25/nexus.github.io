import { glyphTemplatePoints, matchRuneAgainstGrimoire } from '../src/systems/arcaneAscension.js';

const glyphs = [
  'force-lattice',
  'precision-mark',
  'resonance-loop',
  'vital-knot',
  'swift-circuit',
  'merchant-sigil',
  'overflow-channel',
  'stability-anchor',
  'echo-ward',
  'surge-glyph',
];

function test(glyph) {
  const stroke = glyphTemplatePoints('enhancement', glyph);
  const result = matchRuneAgainstGrimoire({ strokePoints: stroke, glyphType: 'enhancement', ownedGlyphs: glyphs });
  return `${glyph} -> ${result.bestMatch} (${result.accuracyScore.toFixed(4)})`;
}

for (const glyph of glyphs) {
  console.log(test(glyph));
}
