// The renders page: everything the old /model/ page showed, full width. No three.js here.
import { buildGallery, type Fly } from './gallery';

/** "Open in 3D" goes to the walkthrough at the same camera, time and options. */
const walkUrl = (f: Fly) => {
  const q = new URLSearchParams();
  if (f.cam) q.set('cam', f.cam);
  if (f.scenario) q.set('scenario', f.scenario);
  if (f.date) q.set('date', f.date);
  if (f.minutes !== undefined) q.set('t', String(f.minutes));
  if (f.roller) q.set('roller', f.roller);
  if (f.kitchen) q.set('kitchen', f.kitchen);
  if (f.fence) q.set('fence', f.fence);
  return '../walk/?' + q.toString();
};
buildGallery(document.getElementById('gallery')!, f => { location.href = walkUrl(f); }, '../img/');
