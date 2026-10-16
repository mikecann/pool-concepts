// The design choices shown as cards in the walkthrough panel. Notes are trimmed from the renders page copy
// (ROLLER, KITCHEN and the fence comparison in gallery.ts). Thumbnails are small card_*.jpg files made from
// the option renders by scripts/make-cards.mjs, so the walkthrough doesn't pull in full-size renders.
export type Choice = { value: string; title: string; note: string; img: string; src: string };

export const ROLLER_CHOICES: Choice[] = [
  { value: 'none', title: 'No roller', note: 'As in the main renders: nothing at either end of the pool.', img: 'card_roller_none.jpg', src: '05_pool_north_end__proposed.jpg' },
  { value: 'roller_shallow', title: 'Shallow end', note: 'The easy fit. 1.66 m to the north fence leaves about 1 m to walk past, in full view from the alfresco.', img: 'card_roller_shallow.jpg', src: 'options_05_pool_north_end_roller_shallow.jpg' },
  { value: 'roller_deep', title: 'Deep end', note: "Out of sight from the house, but it doesn't really fit: the strip behind the coping narrows to about 0.5 m.", img: 'card_roller_deep.jpg', src: 'options_13_deep_end_to_house_roller_deep.jpg' },
  { value: 'roller_pit', title: 'In-ground box', note: 'A 4.5 m by 0.5 m box under a flush lid. Nothing to step around, but it has to go in before the concourse is poured.', img: 'card_roller_pit.jpg', src: 'options_05_pool_north_end_roller_pit.jpg' },
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
  { value: 'pier_around', title: 'Round the pier', note: 'The fence steps out onto the deck and round the pier, so the pier is on the pool side. Takes about a 1 m by 1.2 m bite out of the deck.', img: 'card_pier_around.jpg', src: 'options_18_pier_fence_pier_around.jpg' },
];

export const CARD_IMAGES = [...ROLLER_CHOICES, ...KITCHEN_CHOICES, ...FENCE_CHOICES, ...PIER_CHOICES].map(c => ({ img: c.img, src: c.src }));
