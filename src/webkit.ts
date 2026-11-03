import type { WebGPURenderer } from 'three/webgpu';

/**
 * WebKit's WebGPU (Safari, and every browser on iPhone and iPad, Chrome included) refuses a shader whose module-scope
 * `var<private>` variables add up to more than 8192 bytes. three.js declares every TSL variable of a fragment shader
 * there, and with all the night lights' slots in every material (Model.setupLights) ours have about 900 of them,
 * around 9 KB, so every lit material's pipeline failed and phones showed an empty grey scene (Nov 2026). Chrome's
 * WebGPU has no such cap.
 *
 * WebKit caps a function's own variables at 8192 bytes too, so moving them all into main() just moves the error.
 * The two caps are separate, though, so the fix splits them: module scope up to about 7 KB, the rest declared
 * inside main(). It's the same program, since they're only ever used in main(). A shader where one of the helper
 * functions does use one is left as it was. Only on WebKit (or with ?localvars, to test it elsewhere), so the
 * desktop Chrome path is exactly as before. With many more lights this runs out too: then the fix is fewer slots.
 */
export function moveFragmentVarsIntoMain(renderer: WebGPURenderer, force = false) {
  const backend = renderer.backend as any;
  if (!backend.isWebGPUBackend) return;
  const ua = navigator.userAgent, webkit = /AppleWebKit/.test(ua) && !/Chrome\/|Chromium\//.test(ua);
  if (!webkit && !force) return;
  const make = backend.createNodeBuilder.bind(backend);
  backend.createNodeBuilder = (object: unknown, r: unknown) => {
    const builder = make(object, r);
    const frag = builder._getWGSLFragmentCode.bind(builder);
    builder._getWGSLFragmentCode = (data: { vars: string; codes: string; flow: string }) => {
      const decls = [...data.vars.matchAll(/var<private> (\w+) : ([^;]+);/g)];
      let bytes = 0;
      const keep: string[] = [], move: string[] = [];
      for (const [line, , type] of decls) (bytes += sizeOf(type)) <= BUDGET ? keep.push(line) : move.push(line);
      if (!move.length || usedByHelpers(data.codes, new Set(decls.map(d => d[1])))) return frag(data);
      return frag({ ...data, vars: keep.join('\n'), flow: move.map(l => l.replace('var<private> ', 'var ')).join('\n\t') + '\n\t' + data.flow });
    };
    return builder;
  };
}

/** Room left in module scope under WebKit's 8192 bytes, for the variables three.js puts there itself (output, varyings). */
const BUDGET = 7000;
/** A variable's size as WebKit counts it, rounded up (a vec3 takes a vec4's 16 bytes); anything unknown counts as 64. */
function sizeOf(type: string) {
  const m = type.match(/^(vec|mat)(\d)(?:x(\d))?<[fiu]32>$/);
  if (/^[fiu]32$|^bool$/.test(type)) return 4;
  if (!m) return 64;
  const rows = Number(m[3] ?? m[2]), cols = m[1] === 'mat' ? Number(m[2]) : 1;
  return (rows === 2 ? 8 : 16) * cols;
}

/** True if a helper function reads or writes one of the module-scope variables (one it doesn't declare itself). */
function usedByHelpers(codes: string, names: Set<string>) {
  for (const fn of codes.split(/\n(?=fn )/)) {
    if (!fn.startsWith('fn ')) continue;
    const own = new Set([...fn.matchAll(/\b(?:var|let|const)\s+(\w+)/g), ...fn.matchAll(/[(,]\s*(\w+)\s*:/g)].map(m => m[1]));
    for (const id of fn.match(/\b[A-Za-z_]\w*\b/g) ?? []) if (names.has(id) && !own.has(id)) return true;
  }
  return false;
}

/**
 * three's compileAsync() pauses between every object it builds (several times per object) with scheduler.yield().
 * Safari has no scheduler.yield, so three falls back to waiting for the next animation frame each time: 137 objects
 * took ~9 s on a Mac and longer on a phone (30 frames a second in Low Power Mode), with the CPU and GPU idle.
 * This stands in for it with a message to ourselves, which still lets input and painting through between objects
 * but doesn't wait for a frame. Chrome has the real one, so this does nothing there.
 */
export function polyfillSchedulerYield() {
  const s = ((globalThis as any).scheduler ??= {});
  if (typeof s.yield === 'function') return;
  const ch = new MessageChannel(), queue: (() => void)[] = [];
  ch.port1.onmessage = () => queue.shift()?.();
  s.yield = () => new Promise<void>(resolve => { queue.push(resolve); ch.port2.postMessage(0); });
}
