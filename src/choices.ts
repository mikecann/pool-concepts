// The design choices shown as cards in the walkthrough panel. Notes are trimmed from the renders page copy
// (ROLLER and KITCHEN in gallery.ts). Thumbnails are small card_*.jpg files made from
// the option renders by scripts/make-cards.mjs, so the walkthrough doesn't pull in full-size renders.
export type Choice = { value: string; title: string; note: string; img: string; src: string; /** The part of the render the card shows: [left, top, width, height] as fractions. */ crop?: [number, number, number, number];
  /** A product page for this option (opens in a new tab). */ link?: { href: string; label: string } };

export const ROLLER_CHOICES: Choice[] = [
  { value: 'none', title: 'No roller', note: 'As in the main renders: nothing at either end of the pool.', img: 'card_roller_none.jpg', src: '17_pool_overview__proposed.jpg', crop: [0.22, 0.1, 0.46, 0.8] },
  { value: 'roller_shallow', title: 'Shallow end', note: 'The easy fit. 1.66 m to the north fence leaves about 1 m to walk past, in full view from the alfresco.', img: 'card_roller_shallow.jpg', src: 'options_17_pool_overview_roller_shallow.jpg', crop: [0.24, 0.52, 0.42, 0.36] },
  { value: 'roller_deep', title: 'Deep end', note: "Standard roller at the deep end. At the west corner there's only 0.5 m from the coping to the drop to the lawn (0.24 m of paving plus the wall cap), so the stands sit half on the coping and half on the wall cap. It fits, just.", img: 'card_roller_deep.jpg', src: 'options_17_pool_overview_roller_deep.jpg', crop: [0.24, 0.1, 0.42, 0.36] },
  { value: 'roller_pit', title: 'In-ground box', note: 'In-ground box at the deep end, between the pool wall and the terrace wall, under a lid flush with the coping. Nothing to step around, but Bob has to build it in, and it only just fits at the west corner.', img: 'card_roller_pit.jpg', src: 'options_17_pool_overview_roller_pit.jpg', crop: [0.24, 0.1, 0.42, 0.36] },
  { value: 'roller_pit_shallow', title: 'In-ground box, shallow end', note: 'The same in-ground box behind the shallow-end wall. 1.44 m clear to the north fence as drawn (2.94 m with the fence moved), so there\'s room to walk behind it with the lids up.', img: 'card_roller_pit_shallow.jpg', src: 'options_17_pool_overview_roller_pit_shallow.jpg', crop: [0.24, 0.52, 0.42, 0.36] },
  { value: 'roller_lowpro', title: 'Low-profile, deep end', note: 'A low-profile roller: short stands with the roll just above the coping, so it fits the narrow strip at the deep end and stays below the view to the canal.', img: 'card_roller_lowpro.jpg', src: 'options_17_pool_overview_roller_lowpro.jpg', crop: [0.24, 0.1, 0.42, 0.36] , link: { href: 'https://daisypoolcovers.com.au/pool-rollers/stationary/sq-pool-roller', label: 'Daisy SQ Pool Roller' } },
  { value: 'roller_rollon_shallow', title: 'Roll-on cover, shallow end', note: 'A soft, padded, segmented cover with no frame or roller: it rolls off piece by piece and sits as a 0.8 m roll on the coping at the shallow end. Press E by the pool to roll it on or off.', img: 'card_roller_rollon_shallow.jpg', src: 'options_17_pool_overview_roller_rollon_shallow.jpg', crop: [0.24, 0.52, 0.42, 0.36], link: { href: 'https://www.australianspacovers.com.au/roll-on-spa-covers/', label: 'Australian Spa Covers Roll-On' } },
  { value: 'roller_rollon_deep', title: 'Roll-on cover, deep end', note: 'The same roll-on cover parked at the deep end, by the canal. Press E by the pool to roll it on or off.', img: 'card_roller_rollon_deep.jpg', src: 'options_17_pool_overview_roller_rollon_deep.jpg', crop: [0.24, 0.1, 0.42, 0.36], link: { href: 'https://www.australianspacovers.com.au/roll-on-spa-covers/', label: 'Australian Spa Covers Roll-On' } },
];

export const KITCHEN_CHOICES: Choice[] = [
  { value: 'kitchen_split', title: 'Split by the gate', note: "Keeps SK02's gate: a 2.4 m bench with the pizza oven north of it, the BBQ cabinet south of it.", img: 'card_kitchen_split.jpg', src: 'options_16_outdoor_kitchen_kitchen_split.jpg' },
  { value: 'kitchen_continuous', title: 'One long bench', note: 'The gate moves about 1 m south so the cabinets run unbroken for 3.3 m. The most workspace.', img: 'card_kitchen_continuous.jpg', src: 'options_16_outdoor_kitchen_kitchen_continuous.jpg' },
  { value: 'kitchen_freestanding', title: 'Freestanding', note: 'A BBQ on a trolley and the oven on a stainless table. The cheapest, and the least bench space.', img: 'card_kitchen_freestanding.jpg', src: 'options_16_outdoor_kitchen_kitchen_freestanding.jpg' },
  { value: 'kitchen_none', title: 'No outdoor kitchen', note: 'No kitchen at all: the alfresco stays open, and the gate stays where SK02 has it.', img: 'card_kitchen_none.jpg', src: 'options_16_outdoor_kitchen_kitchen_none.jpg' },
];

export const POST_CHOICES: Choice[] = [
  { value: 'post_as_drawn', title: 'As drawn (SK02)', note: 'One post in the middle of the alfresco with a beam along it: 1.35 m to the pool coping and 0.27 m to the lounge coping.', img: 'card_post_as_drawn.jpg', src: 'options_10_alfresco_corner_post_as_drawn.jpg' },
  { value: 'post_corner', title: 'Corner post', note: "One post at the roof's south-west corner and a long beam to the pavilion's pier: the most open alfresco. An engineer has to say whether the pier can take a second post.", img: 'card_post_corner.jpg', src: 'options_10_alfresco_corner_post_corner.jpg' },
  { value: 'post_west', title: 'West edge, cantilevered', note: 'One post on the west edge, with the beam running over it and cantilevering 1.65 m: nothing stands on the side facing the pool and lounge, but the post sits where you step onto the coping.', img: 'card_post_west.jpg', src: 'options_10_alfresco_corner_post_west.jpg' },
  { value: 'post_two', title: 'Two posts', note: 'Two posts along the south side with shorter spans and nothing on the pier, but both stand along the edge of the lounge.', img: 'card_post_two.jpg', src: 'options_10_alfresco_corner_post_two.jpg' },
];

export const PUMP_CHOICES: Choice[] = [
  { value: 'pump_doors', title: 'Slatted doors', note: 'A pair of slatted doors in a charcoal frame, opening out onto the promenade. Inside: 0.96 m headroom (you kneel), the filter, pumps, blower and chlorinator.', img: 'card_pump_doors.jpg', src: 'options_22_pump_room_pump_doors.jpg' },
  { value: 'pump_open', title: 'Open bay', note: 'The same 1.7 m opening with no doors, under a galvanised lintel.', img: 'card_pump_open.jpg', src: 'options_22_pump_room_pump_open.jpg' },
];

export const SPA_COVER_CHOICES: Choice[] = [
  { value: 'spa_cover_none', title: 'No cover', note: 'The hot tub as it is in the main renders: open.', img: 'card_spa_cover_none.jpg', src: '14_spa_to_canal__proposed.jpg', crop: [0.0, 0.45, 0.5, 0.55] },
  { value: 'spa_cover_rolled', title: 'Roll-on, rolled up', note: 'A soft segmented roll-on cover, rolled up on the deck along the spa\'s south-east edge (from A$4,180; a round 2.0 m spa is a custom order). Press E by the spa to roll it on.', img: 'card_spa_cover_rolled.jpg', src: 'options_14_spa_to_canal_spa_cover_rolled.jpg', link: { href: 'https://www.australianspacovers.com.au/roll-on-spa-covers/', label: 'Australian Spa Covers Roll-On' } },
  { value: 'spa_cover_on', title: 'Roll-on, covering it', note: 'The same cover flat on the spa. Press E by the spa to roll it off.', img: 'card_spa_cover_on.jpg', src: 'options_14_spa_to_canal_spa_cover_on.jpg', link: { href: 'https://www.australianspacovers.com.au/roll-on-spa-covers/', label: 'Australian Spa Covers Roll-On' } },
];

export const PLAY_CHOICES: Choice[] = [
  { value: 'play_as_is', title: 'Play area where it is', note: 'The bark, sandpit, climbing frame and trampoline stay where they are.', img: 'card_play_as_is.jpg', src: 'options_19_play_area_play_as_is_pavers.jpg' },
  { value: 'play_moved', title: 'Play area moved north', note: 'The whole play area moves 1.75 m north along the boundary wall. With the north fence moved too, the trampoline is 2 m from the fence instead of 0.4 m, clear of the non-climbable zone.', img: 'card_play_moved.jpg', src: 'options_19_play_area_play_moved_pavers.jpg' },
];

export const PIER_CHOICES: Choice[] = [
  { value: 'pier_as_drawn', title: 'As drawn', note: "The 0.5 m pier is a foothold 0.4 m from the fence, inside the climbing zone, and the fence is only 1.1 m above the deck. Unlikely to pass.", img: 'card_pier_as_drawn.jpg', src: 'options_18_pier_fence_pier_as_drawn.jpg' },
  { value: 'pier_tall', title: '1.8 m section', note: 'The fence and gate are 1.8 m high from the deck past the gate and the pier, so no climbing zone applies there. 1.2 m from the deck elsewhere.', img: 'card_pier_tall.jpg', src: 'options_18_pier_fence_pier_tall.jpg' },
  { value: 'pier_across', title: 'Across the deck', note: 'Instead of going round the pier, the fence leaves the line south of the pier and runs straight across the deck to the house wall, just west of the big pavilion slider, so the pier ends up outside the pool area.', img: 'card_pier_across.jpg', src: 'options_18_pier_fence_pier_across.jpg' },
  { value: 'pier_around', title: 'Round the pier', note: 'The fence steps out onto the deck and round the pier, so the pier is on the pool side. Takes about a 1 m by 1.2 m bite out of the deck.', img: 'card_pier_around.jpg', src: 'options_18_pier_fence_pier_around.jpg' },
  { value: 'pier_inset', title: 'Inset (Kelsie)', note: "The fence pulled into the alfresco just in front of the kitchen benchtops, so the pier is 1.23 m outside it. Meant to go with No outdoor kitchen: with a kitchen, its benches end up 45 mm outside the fence, which makes them climbable. The walkway to the spa deck is pinched to about 0.25 m.", img: 'card_pier_inset.jpg', src: 'options_18_pier_fence_pier_inset.jpg' },
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
export const OPTION_DEFAULTS = { roller: 'none', kitchen: 'kitchen_none', post: 'post_as_drawn', pump: 'pump_doors', play: 'play_as_is', spaCover: 'spa_cover_none', pier: 'pier_as_drawn', nfence: 'nfence_as_drawn', passage: 'passage_pavers' };

export const CARD_IMAGES = [...ROLLER_CHOICES, ...KITCHEN_CHOICES, ...POST_CHOICES, ...PUMP_CHOICES, ...SPA_COVER_CHOICES, ...PLAY_CHOICES, ...PIER_CHOICES, ...NFENCE_CHOICES, ...PASSAGE_CHOICES].map(c => ({ img: c.img, src: c.src, crop: c.crop }));
