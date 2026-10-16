// NOAA solar position, ported line for line from the-pool's scripts/blender/build_time.py so the browser sun
// matches the Cycles renders. Site: 35 Keel Retreat, Geographe. AWST is UTC+8 with no daylight saving.
export const LAT = -33.6344, LON = 115.3959, TZ = 8;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

/** Julian day of a proleptic Gregorian date at UTC midnight, matching Python's toordinal() + 1721424.5. */
function julianMidnight(y: number, m: number, d: number) {
  const ordinal = Math.round(Date.UTC(y, m - 1, d) / 86400000) + 719163; // days since 0001-01-01, +1
  return ordinal + 1721424.5;
}

/** Sun azimuth (degrees clockwise from north) and elevation (degrees) for a local AWST date and minute of the day. */
export function sunPosition(date: string, minutes: number, lat = LAT, lon = LON, tz = TZ) {
  const [y, mo, d] = date.split('-').map(Number);
  // dt_local - tz hours, carried across midnight like Python's datetime arithmetic
  const utc = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0) + (minutes - tz * 60) * 60000);
  const hour = utc.getUTCHours() + utc.getUTCMinutes() / 60 + utc.getUTCSeconds() / 3600;
  const jd = julianMidnight(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate()) + hour / 24;
  const T = (jd - 2451545.0) / 36525;
  const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
  const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
  const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
  const C = Math.sin(rad(M)) * (1.914602 - T * (0.004817 + 0.000014 * T)) +
    Math.sin(rad(2 * M)) * (0.019993 - 0.000101 * T) + Math.sin(rad(3 * M)) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lam = trueLong - 0.00569 - 0.00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
  const eps = eps0 + 0.00256 * Math.cos(rad(omega));
  const decl = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lam))));
  const yy = Math.tan(rad(eps / 2)) ** 2;
  const eqt = 4 * deg(yy * Math.sin(2 * rad(L0)) - 2 * e * Math.sin(rad(M)) +
    4 * e * yy * Math.sin(rad(M)) * Math.cos(2 * rad(L0)) -
    0.5 * yy * yy * Math.sin(4 * rad(L0)) - 1.25 * e * e * Math.sin(2 * rad(M)));
  const tst = ((((utc.getUTCHours() * 60 + utc.getUTCMinutes() + utc.getUTCSeconds() / 60 + eqt + 4 * lon) % 1440) + 1440) % 1440);
  const ha = tst / 4 >= 0 ? tst / 4 - 180 : tst / 4 + 180;
  const zen = deg(Math.acos(Math.sin(rad(lat)) * Math.sin(rad(decl)) +
    Math.cos(rad(lat)) * Math.cos(rad(decl)) * Math.cos(rad(ha))));
  const el = 90 - zen;
  const az = (deg(Math.atan2(Math.sin(rad(ha)),
    Math.cos(rad(ha)) * Math.sin(rad(lat)) - Math.tan(rad(decl)) * Math.cos(rad(lat)))) + 180) % 360;
  return { az, el };
}

/** Unit vector towards the sun in three.js coordinates (Y up, -Z north, +X east). */
export function sunDirection(az: number, el: number): [number, number, number] {
  const c = Math.cos(rad(el));
  return [Math.sin(rad(az)) * c, Math.sin(rad(el)), -Math.cos(rad(az)) * c];
}

/** Minutes after midnight of sunrise and sunset (sun centre at -0.833 deg), found by bisection. */
export function sunTimes(date: string) {
  const f = (m: number) => sunPosition(date, m).el + 0.833;
  const solve = (a: number, b: number) => {
    for (let i = 0; i < 30; i++) { const c = (a + b) / 2; if (Math.sign(f(c)) === Math.sign(f(a))) a = c; else b = c; }
    return (a + b) / 2;
  };
  return { rise: solve(0, 720), set: solve(720, 1439) };
}

export const compass = (az: number) =>
  ['north', 'north-north-east', 'north-east', 'east-north-east', 'east', 'east-south-east', 'south-east', 'south-south-east',
    'south', 'south-south-west', 'south-west', 'west-south-west', 'west', 'west-north-west', 'north-west', 'north-north-west'][Math.round(az / 22.5) % 16];
