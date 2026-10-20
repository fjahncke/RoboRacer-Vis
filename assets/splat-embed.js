/*
 * Interactive Gaussian-splat robot cards, self-hosted (no CDN), for TYPO3 or any page.
 *
 *   <div class="splat-viewer" data-splat="/fileadmin/roboracer/model.splat"></div>
 *   <script type="module" src="/fileadmin/roboracer/splat-embed.js"></script>
 *
 * Every element with data-splat becomes a viewer: drag to orbit, scroll/pinch to zoom, auto-rotation that
 * resumes 3 s after the last interaction. Viewers start when scrolled into view.
 *
 * Optional attributes (defaults fit the RoboRacer model: metres, z up, +x forward):
 *   data-distance="0.85"   camera distance [m]        data-elevation="22"  camera elevation [deg]
 *   data-azimuth="35"     start azimuth [deg]        data-target-z="0.09" look-at height [m]
 *   data-speed="1.0"      auto-rotate speed          data-fov="35"        vertical field of view [deg]
 *   data-splat-inline="id"   read the model from <script type="application/octet-stream" id="id"> (base64)
 *                            in the page itself: a single-file viewer for CMSs that refuse .js/.splat uploads
 *
 * Built on three.js and GaussianSplats3D (both MIT, vendor/ with their licences).
 */
import * as THREE from './vendor/three.module.js';
import * as GS from './vendor/gaussian-splats-3d.module.js';

const DEFAULTS = { distance: 0.85, elevation: 22, azimuth: 35, targetZ: 0.09, speed: 1.0, fov: 35 };

function num(el, key, fallback) {
  const v = parseFloat(el.dataset[key]);
  return Number.isFinite(v) ? v : fallback;
}

function startViewer(el) {
  if (el.dataset.splatStarted) return;
  el.dataset.splatStarted = '1';
  if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
  if (!el.style.height && el.clientHeight < 50) el.style.aspectRatio = el.style.aspectRatio || '16 / 9';

  const o = {};
  for (const k of Object.keys(DEFAULTS)) o[k] = num(el, k, DEFAULTS[k]);
  const az = THREE.MathUtils.degToRad(o.azimuth), elv = THREE.MathUtils.degToRad(o.elevation);
  const target = new THREE.Vector3(0, 0, o.targetZ);
  const eye = new THREE.Vector3(Math.cos(az) * Math.cos(elv), Math.sin(az) * Math.cos(elv), Math.sin(elv))
    .multiplyScalar(o.distance).add(target);

  // our own renderer: alpha so the page background shows through, sized to the card
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, precision: 'highp' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0.0);
  renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none';
  el.appendChild(renderer.domElement);
  const camera = new THREE.PerspectiveCamera(o.fov, 1, 0.02, 50);
  camera.up.set(0, 0, 1);
  camera.position.copy(eye);
  camera.lookAt(target);
  const resize = () => {
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  new ResizeObserver(resize).observe(el);

  const viewer = new GS.Viewer({
    rootElement: el,
    renderer, camera,
    cameraUp: [0, 0, 1],
    initialCameraPosition: eye.toArray(),
    initialCameraLookAt: target.toArray(),
    sharedMemoryForWorkers: false,     // works without COOP/COEP headers
    dynamicScene: false,
    sphericalHarmonicsDegree: 0,
    antialiased: true,
    useBuiltInControls: true,
    selfDrivenMode: true,
  });
  const loading = document.createElement('div');
  loading.textContent = 'Loading 3D model\u2026';
  loading.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:14px Arial,sans-serif;color:#8a94a0;pointer-events:none';
  el.appendChild(loading);
  // The model is fetched here and handed to the library as a local Blob. The library sizes its buffers
  // from Content-Length, which is the *compressed* size when the server gzips (GitHub Pages, most CDNs),
  // and then fails on the larger decompressed stream; fetch() itself decompresses transparently.
  const source = (async () => {
    const inline = el.dataset.splatInline && document.getElementById(el.dataset.splatInline);
    let bytes;
    if (inline) {
      bytes = Uint8Array.from(atob(inline.textContent.replace(/\s+/g, '')), (c) => c.charCodeAt(0));
    } else {
      const res = await fetch(el.dataset.splat);
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${el.dataset.splat}`);
      bytes = await res.arrayBuffer();
    }
    return URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  })();
  source.then((src) => viewer.addSplatScene(src, { showLoadingUI: true, progressiveLoad: false, format: GS.SceneFormat.Splat }))
  .then(() => {
    loading.remove();
    viewer.start();
    const c = viewer.controls || viewer.perspectiveControls;
    if (c) {
      c.target.copy(target);
      c.autoRotate = true;
      c.autoRotateSpeed = o.speed;
      c.minDistance = 0.35 * o.distance;
      c.maxDistance = 3.0 * o.distance;
      c.minPolarAngle = 0.15;
      c.maxPolarAngle = Math.PI / 2 - 0.02;   // stay above the ground
      c.update();
      let timer = null;
      const pause = () => { c.autoRotate = false; clearTimeout(timer); timer = setTimeout(() => { c.autoRotate = true; }, 3000); };
      renderer.domElement.addEventListener('pointerdown', pause);
      renderer.domElement.addEventListener('wheel', pause, { passive: true });
    }
  }).catch((err) => {
    loading.textContent = 'Could not load the 3D model.';
    console.error('splat-embed', el.dataset.splat, err);
  });
}

function init() {
  const els = document.querySelectorAll('[data-splat], [data-splat-inline]');
  if (!('IntersectionObserver' in window)) { els.forEach(startViewer); return; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) if (e.isIntersecting) { startViewer(e.target); io.unobserve(e.target); }
  }, { rootMargin: '200px' });
  els.forEach((el) => {
    // already on screen (e.g. a full-page viewer in an iframe): start now, don't wait for the observer
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.bottom > -200 && r.top < window.innerHeight + 200) startViewer(el);
    else io.observe(el);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
