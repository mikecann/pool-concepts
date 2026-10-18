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
  if (f.post) q.set('post', f.post);
  if (f.pump) q.set('pump', f.pump);
  if (f.play) q.set('play', f.play);
  if (f.pier) q.set('pier', f.pier);
  if (f.nfence) q.set('nfence', f.nfence.replace('nfence_', ''));
  if (f.passage) q.set('passage', f.passage.replace('passage_', ''));
  if (f.bfence) q.set('bfence', f.bfence.replace('bfence_', ''));
  if (f.bplant) q.set('bplant', f.bplant.replace('bplant_', ''));
  if (f.lighting) q.set('lighting', f.lighting.replace('lights_', ''));
  // the picture's layout, whatever the walkthrough last had (a one-off: links aren't remembered)
  q.set('layout', f.layout ?? 'a');
  return '../walk/?' + q.toString();
};
buildGallery(document.getElementById('gallery')!, f => { location.href = walkUrl(f); }, '../img/');
