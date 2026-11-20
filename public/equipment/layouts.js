// ACCESS OPTIONS AND LAYOUTS.
// Plan units mm, origin = lounge's inside SW corner, x east, y north. RLs in metres.
//
// ACCESS: how you get into the room. Each option changes the geometry the viewer draws and the fit check:
//   hatch:    deck hatch rectangle (lid drawn open)
//   stairs:   the lower lounge steps hinge up; a standing well opens under them
//   eastDoor: louvred door through the east masonry wall
//   panels:   lift-out deck panels over the band east of the spa
// overhead:   openings you can lift things out of (a tall item fits if its footprint is inside one)
// airPath:    is there a real path for air in and out of the room?
export const ACCESS = {
  hatch: {
    label: 'Hatch',
    hatch: { x0: 0, y0: -1400, x1: 1600, y1: -250, name: 'hatch' },
    overhead: [{ name: 'hatch', x0: 0, y0: -1400, x1: 1600, y1: -250 }],
    airPath: false,
  },
  stairs: {
    label: 'Stairs',
    stairs: { x0: 0, y0: 0, x1: 1380, y1: 920, liftDeg: 109 },
    well: { x0: 0, y0: -240, x1: 1380, y1: 920, rl: 1.12 },
    wallCut: { x0: 0, y0: -240, x1: 1380, y1: 0, rl0: 0.88, rl1: 2.0 },
    overhead: [{ name: 'open stairs', x0: 0, y0: 0, x1: 1380, y1: 920 }],
    airPath: true,
  },
  eastDoor: {
    label: 'East door',
    door: { y0: 550, y1: 1350, sill: 1.45, head: 2.15, wallX0: 4695, wallX1: 4935 },
    overhead: [],
    airPath: true,
  },
  panels: {
    label: 'Deck panels',
    hatch: { x0: 3760, y0: -282, x1: 4695, y1: 1420, name: 'panels' },
    overhead: [{ name: 'deck panels', x0: 3760, y0: -282, x1: 4695, y1: 1420 }],
    airPath: true,
  },
};

// Camera views per layout. inside: eye and target [x, y, RL]; cut: the cutaway plane.
const V_HATCH = { inside: { eye: [40, -700, 1.75], target: [2300, -950, 1.4] }, cut: { axis: 'x', at: 800 } };
const V_DOOR = { inside: { eye: [3100, -1000, 1.75], target: [4400, 300, 1.3] }, cut: { axis: 'y', at: 100 } };
const V_YARD = { inside: { eye: [3500, -1000, 1.75], target: [4300, 300, 1.5] }, cut: { axis: 'y', at: 300 } };

// Placements. x, y = centre of the item's footprint (mm); rl = RL of its base (m); rotDeg 0 = front faces south.
const A = [
  { item: 'pool_pump', x: 385, y: -1300, rl: 1.12, rotDeg: 180 },
  { item: 'pool_filter', x: 1300, y: -1150, rl: 1.12, rotDeg: 0 },
  { item: 'chlor_cell', x: 900, y: -1385, rl: 1.30, rotDeg: 0 },
  { item: 'chlor_pack', x: 200, y: -310, rl: 1.80, rotDeg: 0 },
  { item: 'ph_doser', x: 470, y: -315, rl: 1.85, rotDeg: 0 },
  { item: 'spa_jet_pump', x: 350, y: -400, rl: 1.12, rotDeg: 0 },
  { item: 'spa_filter', x: 800, y: -430, rl: 1.12, rotDeg: 0 },
  { item: 'spa_heater', x: 1300, y: -420, rl: 1.12, rotDeg: 0 },
  { item: 'spa_controller', x: 1210, y: -285, rl: 1.80, rotDeg: 0 },
  { item: 'acid_drum', x: 5300, y: 3000, rl: 1.80, rotDeg: 0 },
];
const SUMP = { item: 'sump_pump', x: 1450, y: -720, rl: 1.12, rotDeg: 0 };

export const LAYOUTS = [
  {
    id: 'hatch', title: 'As drawn: everything under the hatch', access: 'hatch', spaType: 'shell',
    seaEntersRoomAtRl: 1.12, rank: 'weak',
    placements: A,
    people: { standing: { x: 1850, y: -600, rl: 2.38 } },
    views: V_HATCH,
    verdict: 'Fits on the floor but you climb down onto the gear, and the control boxes cannot hang at the makers\' height.',
    flood: 'The floor drain to the canal lets the sea in at the 2-year level.',
    thermal: 'About 300 W of heat, 1 kW during a spa session. Deck gaps and a grille are enough.',
  },
  {
    id: 'stairs', title: 'Stairs that lift, room sealed as a tub', access: 'stairs', spaType: 'shell',
    seaEntersRoomAtRl: 2.32, rank: 'ok',
    placements: [...A, SUMP],
    people: { standing: { x: 690, y: 460, rl: 1.12 } },
    views: V_HATCH,
    verdict: 'Best way to keep the gear under the deck: stand-up access with everything in reach.',
    flood: 'Dry to the 200-year level if the walls are tanked and the drain becomes a sump pump.',
    thermal: 'Same 300 W. Slatted stair risers let it out.',
  },
  {
    id: 'eastDoor', title: 'East side door', access: 'eastDoor', spaType: 'shell',
    seaEntersRoomAtRl: 1.45, rank: 'weak',
    placements: [
      { item: 'pool_pump', x: 1985, y: -1300, rl: 1.12, rotDeg: 180 },
      { item: 'pool_filter', x: 2850, y: -1180, rl: 1.12, rotDeg: 0 },
      { item: 'chlor_cell', x: 2440, y: -1385, rl: 1.60, rotDeg: 0 },
      { item: 'ph_doser', x: 2440, y: -1375, rl: 1.85, rotDeg: 180 },
      { item: 'chlor_pack', x: 3250, y: -1380, rl: 1.80, rotDeg: 180 },
      { item: 'spa_jet_pump', x: 4000, y: -150, rl: 1.12, rotDeg: 90 },
      { item: 'spa_filter', x: 3950, y: 380, rl: 1.12, rotDeg: 0 },
      { item: 'spa_heater', x: 4560, y: 0, rl: 1.12, rotDeg: 90 },
      { item: 'spa_controller', x: 4650, y: 0, rl: 1.80, rotDeg: -90 },
      { item: 'acid_drum', x: 5300, y: 3000, rl: 1.80, rotDeg: 0 },
    ],
    people: { kneeling: { x: 5200, y: 950, rl: 1.4 } },
    views: V_DOOR,
    verdict: 'Nobody enters the pool area, but the door is 0.7 m high and it is a crawl in beside the spa.',
    flood: 'The sill at RL 1.45 lets the sea in between the 2 and 5-year levels.',
    thermal: 'Good through-draught for the pumps.',
  },
  {
    id: 'sideYard', title: 'Pool gear in the side yard, spa pack under the deck', access: 'panels', spaType: 'shell',
    seaEntersRoomAtRl: 2.32, rank: 'pick',
    structures: [
      { name: 'raised shelf', x0: 3780, y0: -250, x1: 4680, y1: 1050, rl0: 1.12, rl1: 1.80 },
      { name: 'filter step', x0: 3780, y0: 1050, x1: 4680, y1: 1400, rl0: 1.12, rl1: 1.55 },
    ],
    placements: [
      { item: 'pool_pump', x: -4500, y: 13000, rl: 2.40, rotDeg: 90 },
      { item: 'chlor_cell', x: -4500, y: 13560, rl: 2.75, rotDeg: 90 },
      { item: 'pool_filter', x: -4500, y: 14050, rl: 2.40, rotDeg: 0 },
      { item: 'chlor_pack', x: -4900, y: 13200, rl: 3.40, rotDeg: 90 },
      { item: 'ph_doser', x: -4900, y: 13600, rl: 3.45, rotDeg: 90 },
      { item: 'acid_drum', x: -4900, y: 14050, rl: 2.40, rotDeg: 0 },
      { item: 'pool_heat_pump', x: -3950, y: 15300, rl: 2.40, rotDeg: 180 },
      { item: 'spa_jet_pump', x: 4000, y: 200, rl: 1.80, rotDeg: 90 },
      { item: 'spa_heater', x: 4050, y: 800, rl: 1.80, rotDeg: 0 },
      { item: 'spa_filter', x: 4500, y: 1225, rl: 1.55, rotDeg: 0 },
      { item: 'spa_controller', x: 4650, y: 300, rl: 1.85, rotDeg: -90 },
      SUMP,
    ],
    people: { standing: { x: -3700, y: 13400, rl: 2.40 } },
    views: V_YARD,
    verdict: 'Pool gear serviced standing up in the open, makers\' rules met, heat pump in free air.',
    flood: 'Side yard is dry to the 200-year level. Spa pack sits at the 25-year level inside a sealed room.',
    thermal: 'Heat pump breathes freely. Quiet model on a daytime timer for the neighbour.',
  },
  {
    id: 'terrace', title: 'Gear under the deck, heat pumps on the east terrace', access: 'stairs', spaType: 'shell',
    seaEntersRoomAtRl: 2.32, rank: 'ok',
    structures: [{ name: 'plinth', x0: 5900, y0: 1800, x1: 6700, y1: 4550, rl0: 1.80, rl1: 2.10 }],
    placements: [
      ...A, SUMP,
      { item: 'pool_heat_pump', x: 6300, y: 3960, rl: 2.10, rotDeg: 90 },
      { item: 'spa_heat_pump', x: 6300, y: 2305, rl: 2.10, rotDeg: 90 },
    ],
    people: { standing: { x: 690, y: 460, rl: 1.12 } },
    views: V_HATCH,
    verdict: 'Works, and the pipes are short, but the units sit in the view to the canal.',
    flood: 'Terrace is the 25-year level; on a 300 mm plinth the units reach the 100-year level.',
    thermal: 'Open air on all sides, 2.5 m clear in front.',
  },
  {
    id: 'heatPumpInside', title: 'Heat pump under the deck (why it cannot work)', access: 'hatch', spaType: 'shell',
    seaEntersRoomAtRl: 1.12, rank: 'no',
    placements: [
      { item: 'pool_heat_pump', x: 4230, y: 500, rl: 1.12, rotDeg: 90 },
      { item: 'pool_pump', x: 385, y: -1300, rl: 1.12, rotDeg: 180 },
      { item: 'pool_filter', x: 1300, y: -1150, rl: 1.12, rotDeg: 0 },
    ],
    people: { standing: { x: 1850, y: -600, rl: 2.38 } },
    views: V_HATCH,
    verdict: 'It needs 1.66 m of height in a 1.095 m room and 2.5 m of clear air in front where it has 0.25 m.',
    flood: 'Wet at the 2-year level.',
    thermal: 'It would swap the room\'s air every 6 seconds. Every maker says outdoors only.',
  },
];
