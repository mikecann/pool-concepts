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
export const DRAINS = {
  canal: { label: 'To canal', seaEntersRoomAtRl: 1.12 },
  sump: { label: 'Sump pump', seaEntersRoomAtRl: 2.32 },
};

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
export const SUMP = { item: 'sump_pump', x: 1450, y: -720, rl: 1.12, rotDeg: 0 };

// Pool heat pump spots (one shown at a time). view = the "Heat pump" camera: eye and target [x, y, RL].
export const HEAT_PUMPS = {
  kitchen: {
    label: 'Kitchen wall',
    line: 'Against the house, inside the pool fence. About 13 m of pipe.',
    placement: { item: 'pool_heat_pump', x: -931, y: 10690, rl: 2.38, rotDeg: -90 },
    person: { kind: 'standing', x: -931, y: 11420, rl: 2.38 },
    view: { eye: [-6200, 6000, 8.5], target: [-1700, 10900, 2.8] },
  },
  yard: {
    label: 'Side yard',
    line: 'North of the pool fence, on the boundary side. About 19 m of pipe.',
    placement: { item: 'pool_heat_pump', x: -4450, y: 13000, rl: 2.40, rotDeg: 180 },
    person: { kind: 'standing', x: -3300, y: 13000, rl: 2.40 },
    view: { eye: [-2300, 9000, 7.2], target: [-4450, 12900, 2.6] },
  },
  corner: {
    label: 'Pool corner',
    line: 'South-west corner of the pool paving, by the canal. About 9 m of pipe.',
    placement: { item: 'pool_heat_pump', x: -6900, y: -150, rl: 2.38, rotDeg: 180 },
    person: { kind: 'standing', x: -5800, y: -150, rl: 2.38 },
    view: { eye: [-3600, 3600, 7.2], target: [-6700, -100, 2.6] },
  },
};

// Other camera views. inside: eye and target; cut: the cutaway plane.
export const VIEWS = { inside: { eye: [40, -700, 1.75], target: [2300, -950, 1.4] }, cut: { axis: 'x', at: 800 } };

// Everything the viewer needs for one combination of choices.
export function makeLayout({ hp, way, drain }) {
  const spot = HEAT_PUMPS[hp] || HEAT_PUMPS.kitchen, w = WAYS[way] || WAYS.hatch, d = DRAINS[drain] || DRAINS.canal;
  return {
    id: `${hp}-${way}-${drain}`,
    access: way,
    spaType: 'shell',
    seaEntersRoomAtRl: d.seaEntersRoomAtRl,
    placements: [...GEAR, ...(drain === 'sump' ? [SUMP] : []), spot.placement],
    people: { standing: [w.person, spot.person].map(({ kind, ...p }) => p) },
    openings: [],
    views: VIEWS,
  };
}
