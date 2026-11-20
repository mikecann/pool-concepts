// EQUIPMENT CATALOGUE (researched numbers). All sizes in millimetres. Axes before rotation:
//   box:      size {w, d, h}   w = left-right, d = front-back, h = height
//   cylinder: size {dia, h}
// The FRONT is the side you stand on to service it. At rotDeg 0 the front faces south (down the page
// on the plan); rotDeg turns it anticlockwise seen from above. "left" is on your left facing the front.
// clearance: free space beyond each face, mm (front/back/left/right/top). Missing = 0.
// serviceLift: extra height above the item needed to service it (pulling an element).
// airflow: { m3h, intake, discharge, throwMm } (sides: front|back|left|right|top), or null.
// heatW: waste heat into the room, watts.
// wallMount: true = hangs on a wall (its rl is the base of the unit).
// mountMinAboveFloor: maker's minimum height of the base above the floor, mm.
// outdoorOnly: maker says outdoors only.  mustBeOutsideRoom: must not be in the equipment room.
export const CATALOGUE = [
  { id: 'pool_pump', name: 'Pool pump', shape: 'box', size: { w: 670, d: 250, h: 305 }, colour: '#7f9bb0',
    clearance: { front: 300, top: 150 }, serviceLift: 0, airflow: null, heatW: 150, notes: 'Davey ProMaster type.' },
  { id: 'pool_filter', name: 'Cartridge filter', shape: 'cylinder', size: { dia: 483, h: 668 }, colour: '#a7b4ba',
    clearance: {}, serviceLift: 332, airflow: null, heatW: 0, notes: 'Needs 1,000 mm in total to pull the element.' },
  { id: 'chlor_pack', name: 'Chlorinator control box', shape: 'box', size: { w: 310, d: 140, h: 290 }, colour: '#c3b48f', wallMount: true,
    mountMinAboveFloor: 1000, clearance: { front: 600 }, serviceLift: 0, airflow: null, heatW: 50, notes: "Maker's rule: base 1 m above the ground." },
  { id: 'chlor_cell', name: 'Chlorinator cell', shape: 'box', size: { w: 300, d: 120, h: 170 }, colour: '#b6a57c',
    clearance: {}, serviceLift: 0, airflow: null, heatW: 0, notes: '' },
  { id: 'ph_doser', name: 'pH doser', shape: 'box', size: { w: 200, d: 150, h: 100 }, colour: '#b99a8b', wallMount: true,
    clearance: {}, serviceLift: 0, airflow: null, heatW: 0, notes: '' },
  { id: 'acid_drum', name: 'Acid drum', shape: 'box', size: { w: 290, d: 250, h: 390 }, colour: '#c4a07e', mustBeOutsideRoom: true,
    clearance: {}, serviceLift: 0, airflow: null, heatW: 0, notes: 'Keep out of the equipment room.' },
  { id: 'spa_jet_pump', name: 'Spa jet pump', shape: 'box', size: { w: 600, d: 241, h: 335 }, colour: '#6f8fa3',
    clearance: { front: 300 }, serviceLift: 0, airflow: null, heatW: 450, notes: '' },
  { id: 'spa_filter', name: 'Spa filter', shape: 'cylinder', size: { dia: 250, h: 600 }, colour: '#a9b5b9',
    clearance: {}, serviceLift: 350, airflow: null, heatW: 0, notes: '' },
  { id: 'spa_heater', name: 'Spa heater (6 kW element)', shape: 'box', size: { w: 390, d: 260, h: 240 }, colour: '#b58f86',
    clearance: {}, serviceLift: 0, airflow: null, heatW: 100, notes: '' },
  { id: 'spa_controller', name: 'Spa controller', shape: 'box', size: { w: 544, d: 90, h: 309 }, colour: '#9c9a8e', wallMount: true,
    clearance: {}, serviceLift: 0, airflow: null, heatW: 40, notes: 'Max 40 C ambient.' },
  { id: 'pool_heat_pump', name: 'Pool heat pump (17 kW)', shape: 'box', size: { w: 1036, d: 494, h: 655 }, colour: '#8fb0a5', outdoorOnly: true,
    clearance: { back: 500, left: 500, right: 500, top: 1000 },
    serviceLift: 0, airflow: { m3h: 4500, intake: 'back', discharge: 'front', throwMm: 2500 }, heatW: 600, notes: '53 dB(A) at 1 m.' },
  { id: 'spa_heat_pump', name: 'Spa heat pump (5.5 kW)', shape: 'box', size: { w: 870, d: 330, h: 610 }, colour: '#86a89c', outdoorOnly: true,
    clearance: { back: 300, left: 700, right: 700, top: 500 },
    serviceLift: 0, airflow: { m3h: 1600, intake: 'back', discharge: 'front', throwMm: 2500 }, heatW: 400, notes: '' },
  { id: 'gas_heater', name: 'Gas heater', shape: 'box', size: { w: 440, d: 650, h: 860 }, colour: '#b0a08f', outdoorOnly: true,
    clearance: { front: 500, left: 300, right: 300, top: 3000 }, serviceLift: 0, airflow: null, heatW: 500, notes: 'Open sky above.' },
];
