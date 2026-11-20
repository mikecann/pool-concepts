// WHAT THE VIEWER SHOWS. Three independent choices (heat pump spot, way in, floor drain) plus fixed gear under the deck.
// Plan units mm, origin = lounge's inside SW corner, x east, y north. RLs in metres.
// Placements: x, y = centre of the item's footprint (mm); rl = RL of its base (m); rotDeg 0 = front faces south.

// Way in. overhead = openings you can lift things out of; airPath = a real path for air in and out of the room.
export const WAYS = {
  hatch: {
    label: 'Hatch',
    line: 'Deck hatch 1.6 x 1.15 m, as drawn. You climb 1.26 m down onto the gear.',
    hatch: { x0: 0, y0: -1400, x1: 1600, y1: -250 },
    overhead: [{ name: 'hatch', x0: 0, y0: -1400, x1: 1600, y1: -250 }],
    airPath: false,
    person: { kind: 'standing', x: 1850, y: -600, rl: 2.38 },
  },
  stairs: {
    label: 'Stairs',
    line: 'The lounge steps lift on gas struts. You stand in a well with the gear in reach.',
    stairs: { x0: 0, y0: 0, x1: 1380, y1: 920, liftDeg: 109 },
    well: { x0: 0, y0: -240, x1: 1380, y1: 920, rl: 1.12 },
    wallCut: { x0: 0, y0: -240, x1: 1380, y1: 0, rl0: 0.88, rl1: 2.0 },
    overhead: [{ name: 'open stairs', x0: 0, y0: 0, x1: 1380, y1: 920 }],
    airPath: true,
    person: { kind: 'standing', x: 690, y: 460, rl: 1.12 },
  },
};

// Floor drain: how high the sea must be to get into the equipment room.
// Gear under the deck: the same in every state.
export const GEAR = [
  { item: 'pool_pump', x: 385, y: -1300, rl: 1.12, rotDeg: 180 },
  { item: 'pool_filter', x: 1300, y: -1150, rl: 1.12, rotDeg: 0 },
  { item: 'chlor_cell', x: 900, y: -1385, rl: 1.30, rotDeg: 0 },
  { item: 'chlor_pack', x: 200, y: -310, rl: 1.80, rotDeg: 0 },
  { item: 'ph_doser', x: 470, y: -315, rl: 1.85, rotDeg: 0 },
  { item: 'spa_jet_pump', x: 350, y: -400, rl: 1.12, rotDeg: 0 },
  { item: 'spa_filter', x: 800, y: -430, rl: 1.12, rotDeg: 0 },
  { item: 'spa_heater', x: 1300, y: -420, rl: 1.12, rotDeg: 0 },
  { item: 'spa_controller', x: 1210, y: -285, rl: 1.80, rotDeg: 0 },
];

// Pool heat pump spots (one shown at a time).
export const HEAT_PUMPS = {
  kitchen: {
    label: 'Kitchen wall',
    line: 'Against the house, inside the pool fence. About 13 m of pipe.',
    placement: { item: 'pool_heat_pump', x: -931, y: 10690, rl: 2.38, rotDeg: -90 },
    person: { kind: 'standing', x: -931, y: 11420, rl: 2.38 },
  },
  yard: {
    label: 'Side yard',
    line: 'North of the pool fence, on the boundary side. About 19 m of pipe.',
    placement: { item: 'pool_heat_pump', x: -4450, y: 13000, rl: 2.40, rotDeg: 180 },
    person: { kind: 'standing', x: -3300, y: 13000, rl: 2.40 },
  },
  corner: {
    label: 'Pool corner',
    line: 'South-west corner of the pool paving, back to the boundary fence. About 9 m of pipe.',
    placement: { item: 'pool_heat_pump', x: -7222, y: 28, rl: 2.38, rotDeg: 90 },
    person: { kind: 'standing', x: -6900, y: 1400, rl: 2.38 },
  },
};

// Everything the viewer needs for one combination of choices.
export function makeLayout({ hp, way }) {
  const spot = HEAT_PUMPS[hp] || HEAT_PUMPS.kitchen, w = WAYS[way] || WAYS.hatch;
  return {
    id: `${hp}-${way}`,
    access: way,
    spaType: 'shell',
    seaEntersRoomAtRl: 1.12,
    placements: [...GEAR, spot.placement],
    people: { standing: [w.person, spot.person].map(({ kind, ...p }) => p) },
    openings: [],
  };
}
