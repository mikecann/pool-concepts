// The design choices shown as cards in the walkthrough panel. Notes are trimmed from the renders page copy
// (ROLLER, KITCHEN and the fence comparison in gallery.ts). Thumbnails are small card_*.jpg files made from
// the option renders by scripts/make-cards.mjs, so the walkthrough doesn't pull in full-size renders.
export type Choice = { value: string; title: string; note: string; img: string; src: string };

export const ROLLER_CHOICES: Choice[] = [
  { value: 'none', title: 'No roller', note: 'As in the main renders: nothing at either end of the pool.', img: 'card_roller_none.jpg', src: '05_pool_north_end__proposed.jpg' },
  { value: 'roller_shallow', title: 'Shallow end', note: 'The easy fit. 1.66 m to the north fence leaves about 1 m to walk past, in full view from the alfresco.', img: 'card_roller_shallow.jpg', src: 'options_13_deep_end_to_house_roller_shallow.jpg' },
  { value: 'roller_deep', title: 'Deep end', note: "Standard roller at the deep end. At the west corner there's only 0.5 m from the coping to the drop to the lawn (0.24 m of paving plus the wall cap), so the stands sit half on the coping and half on the wall cap. It fits, just.", img: 'card_roller_deep.jpg', src: 'options_05_pool_north_end_roller_deep.jpg' },
  { value: 'roller_pit', title: 'In-ground box', note: 'In-ground box at the deep end, between the pool wall and the terrace wall, under a lid flush with the coping. Nothing to step around, but Bob has to build it in, and it only just fits at the west corner.', img: 'card_roller_pit.jpg', src: 'options_05_pool_north_end_roller_pit.jpg' },
  { value: 'roller_lowpro', title: 'Low-profile, deep end', note: 'A low-profile roller: short stands with the roll just above the coping, so it fits the narrow strip at the deep end and stays below the view to the canal.', img: 'card_roller_lowpro.jpg', src: 'options_05_pool_north_end_roller_lowpro.jpg' },
];

export const KITCHEN_CHOICES: Choice[] = [
  { value: 'kitchen_split', title: 'Split by the gate', note: "Keeps SK02's gate: a 2.4 m bench with the pizza oven north of it, the BBQ cabinet south of it.", img: 'card_kitchen_split.jpg', src: 'options_16_outdoor_kitchen_kitchen_split.jpg' },
  { value: 'kitchen_continuous', title: 'One long bench', note: 'The gate moves about 1 m south so the cabinets run unbroken for 3.3 m. The most workspace.', img: 'card_kitchen_continuous.jpg', src: 'options_16_outdoor_kitchen_kitchen_continuous.jpg' },
  { value: 'kitchen_freestanding', title: 'Freestanding', note: 'A BBQ on a trolley and the oven on a stainless table. The cheapest, and the least bench space.', img: 'card_kitchen_freestanding.jpg', src: 'options_16_outdoor_kitchen_kitchen_freestanding.jpg' },
];

export const FENCE_CHOICES: Choice[] = [
  { value: 'perforated', title: 'Perforated', note: 'Charcoal perforated aluminium, 1.2 m, as priced on 7 Oct. Reads as a dark screen.', img: 'card_fence_perforated.jpg', src: '03_lawn_to_terrace__proposed.jpg' },
  { value: 'glass', title: 'Glass', note: 'Frameless glass, as SK02 draws it. Keeps the pool and spa in view, for about $630 more.', img: 'card_fence_glass.jpg', src: '03_lawn_to_terrace__glass.jpg' },
];

export const PIER_CHOICES: Choice[] = [
  { value: 'pier_as_drawn', title: 'As drawn', note: "The 0.5 m pier is a foothold 0.4 m from the fence, inside the climbing zone, and the fence is only 1.1 m above the deck. Unlikely to pass.", img: 'card_pier_as_drawn.jpg', src: 'options_18_pier_fence_pier_as_drawn.jpg' },
  { value: 'pier_tall', title: '1.8 m section', note: 'The fence and gate are 1.8 m high from the deck past the gate and the pier, so no climbing zone applies there. 1.2 m from the deck elsewhere.', img: 'card_pier_tall.jpg', src: 'options_18_pier_fence_pier_tall.jpg' },
  { value: 'pier_across', title: 'Across the deck', note: 'Instead of going round the pier, the fence leaves the line south of the pier and runs straight across the deck to the house wall, just west of the big pavilion slider, so the pier ends up outside the pool area.', img: 'card_pier_across.jpg', src: 'options_18_pier_fence_pier_across.jpg' },
  { value: 'pier_around', title: 'Round the pier', note: 'The fence steps out onto the deck and round the pier, so the pier is on the pool side. Takes about a 1 m by 1.2 m bite out of the deck.', img: 'card_pier_around.jpg', src: 'options_18_pier_fence_pier_around.jpg' },
];

export const NFENCE_CHOICES: Choice[] = [
  { value: 'nfence_as_drawn', title: 'As drawn', note: "The north pool fence crosses the side passage about 1.6 m past the pool's shallow end.", img: 'card_nfence_as_drawn.jpg', src: 'options_20_pool_north_seating_side_as_drawn_pavers.jpg' },
  { value: 'nfence_moved', title: 'Moved 1.5 m north', note: 'Room for a couple of loungers and an umbrella inside the pool area. The trampoline would then be 0.4 m from the outside of the fence, inside the 900 mm non-climbable zone, so it would have to move north or that stretch of fence go to 1.8 m.', img: 'card_nfence_moved.jpg', src: 'options_20_pool_north_seating_side_moved_pavers.jpg' },
];

export const PASSAGE_CHOICES: Choice[] = [
  { value: 'passage_pavers', title: 'Aggregate to the fence', note: 'The new aggregate stops at the pool fence and the existing pavers stay up the side passage.', img: 'card_passage_pavers.jpg', src: 'options_19_play_area_side_as_drawn_pavers.jpg' },
  { value: 'passage_aggregate', title: 'Aggregate to the play area', note: 'The aggregate carries on up the side passage to the sunken bark play area, under the trampoline.', img: 'card_passage_aggregate.jpg', src: 'options_19_play_area_side_as_drawn_aggregate.jpg' },
];

/** What render.py shows when nothing in a group is picked. */
export const OPTION_DEFAULTS = { roller: 'none', kitchen: 'kitchen_split', fence: 'perforated', pier: 'pier_as_drawn', nfence: 'nfence_as_drawn', passage: 'passage_pavers' };

export const CARD_IMAGES = [...ROLLER_CHOICES, ...KITCHEN_CHOICES, ...FENCE_CHOICES, ...PIER_CHOICES, ...NFENCE_CHOICES, ...PASSAGE_CHOICES].map(c => ({ img: c.img, src: c.src }));
