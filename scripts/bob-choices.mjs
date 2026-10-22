// The plain-words title and one-liner of every design option, for the /bob/ page's spec table (public/bob/choices.json).
// Runs on every build (package.json), so the page always has the walkthrough's current titles.
//   node --experimental-strip-types scripts/bob-choices.mjs [public/bob/choices.json]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import * as C from '../src/choices.ts';
const out = process.argv[2] ?? 'public/bob/choices.json';

// [key in profile.json ("layout" for the top level, otherwise options.<key>), name on the page, choices], in page order
const GROUPS = [
  ['layout', 'Layout', C.LAYOUT_CHOICES],
  ['roller', 'Pool cover', C.ROLLER_CHOICES],
  ['spaCover', 'Hot tub cover', C.SPA_COVER_CHOICES],
  ['deck', 'Spa deck', C.DECK_CHOICES],
  ['pump', 'Pump room', C.PUMP_CHOICES],
  ['kitchen', 'Outdoor kitchen', C.KITCHEN_CHOICES],
  ['post', 'Roof posts', C.POST_CHOICES],
  ['pier', 'Fence by the pillar', C.PIER_CHOICES],
  ['nfence', 'North fence', C.NFENCE_CHOICES],
  ['bfence', 'Boundary fence', C.BFENCE_CHOICES],
  ['bplant', 'Along the boundary wall', C.BPLANT_CHOICES],
  ['wallcap', 'Wall tops', C.WALLCAP_CHOICES],
  ['passage', 'Side path', C.PASSAGE_CHOICES],
  ['play', 'Play area', C.PLAY_CHOICES],
];
const missing = Object.keys(C.OPTION_DEFAULTS).filter(k => k !== 'lighting' && !GROUPS.some(([g]) => g === k));
if (missing.length) throw new Error(`bob-choices: no group for ${missing.join(', ')}: add it to GROUPS`);

const entry = c => [c.value, { title: c.title, short: c.short ?? '' }];
const data = {
  groups: GROUPS.map(([key, name, list]) => ({ key, name, options: Object.fromEntries(list.map(entry)) })),
  lighting: Object.fromEntries(C.LIGHTING_CHOICES.map(entry)),
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(data, null, 1) + '\n');
console.log(`wrote ${out}: ${data.groups.length} groups and ${Object.keys(data.lighting).length} lighting schemes`);
