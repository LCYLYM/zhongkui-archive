import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const shots = [
  { target: [0, 1.03, 0], angle: .13, distance: 4.45 },
  { target: [0, 1.70, .015], angle: .18, distance: 1.3 },
  { target: [0, 1.23, .02], angle: .42, distance: 1.65 },
  { target: [0, 1.05, 0], angle: 2.85, distance: 4.1 },
];
const clamp = value => Math.max(0, Math.min(1, value));
function disposeObject(root) {
  const geometries = new Set(), materials = new Set(), textures = new Set();
  root?.traverse(object => {
    if (object.geometry) geometries.add(object.geometry);
    for (const material of (Array.isArray(object.material) ? object.material : [object.material])) if (material) {
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  geometries.forEach(item => item.dispose()); materials.forEach(item => item.dispose());
  textures.forEach(item => { item.dispose(); item.source?.data?.close?.(); });
}

export function createCharacterRenderer(host, { onStatus, quality = 'balanced' } = {}) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'default' });
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let pixelRatio = Math.min(devicePixelRatio, matchMedia('(max-width:700px)').matches ? 1 : 1.25);
  renderer.setPixelRatio(pixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.setAttribute('aria-label', '白衣人物三维模型 / White-clad character model');
  renderer.domElement.style.touchAction = 'pan-y';
  host.append(renderer.domElement);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#e7e3d9', '#26251f', 2.3));
  const key = new THREE.DirectionalLight('#fff2d8', 2.5); key.position.set(-3, 4, 5); scene.add(key);
  const rim = new THREE.DirectionalLight('#b2bbc0', 1.8); rim.position.set(3, 3, -4); scene.add(rim);
  const fill = new THREE.DirectionalLight('#ded4c4', .5); fill.position.set(3, 2, 4); scene.add(fill);
  const camera = new THREE.PerspectiveCamera(32, 1, .025, 40);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enabled = false; controls.enableDamping = true; controls.dampingFactor = .12;
  renderer.domElement.style.touchAction = 'pan-y';
  controls.enablePan = false; controls.enableZoom = false;
  controls.minDistance = .45; controls.maxDistance = 6; controls.maxPolarAngle = Math.PI * .82;
  let root = null, frame = 0, disposed = false, visible = false, free = false, desired = 0, progress = 0, settle = false, last = 0;
  let controller = null, generation = 0, movingFrames = 0, slowFrames = 0;
  const metrics = { frames: 0, drawCalls: 0, triangles: 0, quality, loadedBytes: 0, loadMs: 0, decodeMs: 0, warmupMs: 0, firstDrawMs: null, lastDrawMs: 0, maxDrawMs: 0, frameIntervals: [], visibilityEvents: 0, lastVisibilityBatch: [], state: 'loading' };

  function paintCamera(value) {
    const part = clamp(value) * (shots.length - 1), index = Math.min(shots.length - 2, Math.floor(part));
    const amount = part - index, a = shots[index], b = shots[index + 1];
    const eased = amount * amount * (3 - 2 * amount);
    const target = new THREE.Vector3(...a.target).lerp(new THREE.Vector3(...b.target), eased);
    const angle = THREE.MathUtils.lerp(a.angle, b.angle, eased);
    const distance = THREE.MathUtils.lerp(a.distance, b.distance, eased) * Math.max(1, .68 / camera.aspect);
    camera.position.set(Math.sin(angle) * distance, target.y + .035, Math.cos(angle) * distance);
    controls.target.copy(target); controls.update();
  }
  function wake() { if (!frame && !disposed && visible && !document.hidden && root) frame = requestAnimationFrame(draw); }
  function draw(now) {
    frame = 0;
    if (disposed || !visible || document.hidden || !root) { last = 0; return; }
    const delta = last ? Math.min((now - last) / 1000, .05) : 1 / 60;
    if (last && now - last < 100) {
      metrics.frameIntervals.push(now - last);
      if (metrics.frameIntervals.length > 360) metrics.frameIntervals.shift();
      movingFrames++;
      if (now - last > 28) slowFrames++;
      if (movingFrames >= 45) {
        if (slowFrames > 14 && pixelRatio > .8) { pixelRatio = Math.max(.8, pixelRatio - .2); renderer.setPixelRatio(pixelRatio); resize(); }
        movingFrames = 0; slowFrames = 0;
      }
    }
    last = now;
    let changed = false;
    if (!free) {
      const difference = desired - progress;
      progress = motion.matches ? Math.round(desired * 3) / 3 : progress + difference * (1 - Math.exp(-delta / .075));
      if (Math.abs(desired - progress) < .00025) progress = desired;
      paintCamera(progress);
      changed = !motion.matches && Math.abs(desired - progress) >= .00025;
      if (settle) { controls.update(); settle = false; }
    } else changed = controls.update();
    const start = performance.now(); renderer.render(scene, camera);
    metrics.lastDrawMs = performance.now() - start; metrics.maxDrawMs = Math.max(metrics.maxDrawMs, metrics.lastDrawMs);
    if (metrics.firstDrawMs === null) metrics.firstDrawMs = metrics.lastDrawMs;
    metrics.frames++; metrics.drawCalls = renderer.info.render.calls; metrics.triangles = renderer.info.render.triangles;
    host.dataset.renderCount = String(metrics.frames);
    host.dataset.renderState = changed ? 'moving' : 'idle';
    if (changed) wake(); else last = 0;
  }
  function resize() {
    const { width, height } = host.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    if (!free) paintCamera(progress);
    wake();
  }
  const observer = new ResizeObserver(resize); observer.observe(host);
  const visibility = new IntersectionObserver(entries => {
    metrics.visibilityEvents += entries.length;
    metrics.lastVisibilityBatch = entries.map(entry => ({ time: entry.time, visible: entry.isIntersecting, ratio: entry.intersectionRatio }));
    visible = entries.at(-1).isIntersecting;
    if (!visible) { cancelAnimationFrame(frame); frame = 0; last = 0; host.dataset.renderState = 'offscreen'; }
    else wake();
  }, { threshold: .01 }); visibility.observe(host);
  const onVisibility = () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; last = 0; host.dataset.renderState = 'hidden'; }
    else wake();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const onControlChange = () => { if (free) wake(); };
  controls.addEventListener('change', onControlChange);
  const onMotion = () => { settle = true; wake(); }; motion.addEventListener('change', onMotion);
  const onContextLost = event => { event.preventDefault(); onStatus?.({ status: 'error', message: 'CONTEXT_LOST' }); };
  renderer.domElement.addEventListener('webglcontextlost', onContextLost);
  resize();

  async function load(nextQuality) {
    const token = ++generation; controller?.abort(); controller = new AbortController();
    metrics.state = 'loading'; onStatus?.({ status: 'loading', replacing: Boolean(root) });
    const started = performance.now();
    let pending = null;
    try {
      const response = await fetch(`/assets/models/white-swordsman-${nextQuality}.glb`, { signal: controller.signal });
      if (!response.ok) throw new Error(`MODEL_HTTP_${response.status}`);
      const buffer = await response.arrayBuffer();
      if (disposed || token !== generation) return;
      const decodeStart = performance.now();
      const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(buffer, '');
      const decodeMs = performance.now() - decodeStart;
      if (disposed || token !== generation) { disposeObject(gltf.scene); return; }
      const box = new THREE.Box3().setFromObject(gltf.scene), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
      if (!Number.isFinite(size.y) || size.y <= 0) { disposeObject(gltf.scene); throw new Error('INVALID_MODEL'); }
      const group = new THREE.Group(); group.add(gltf.scene); pending = group;
      group.scale.setScalar(2 / size.y);
      group.position.set(-center.x * group.scale.x, -box.min.y * group.scale.y, -center.z * group.scale.z);
      group.traverse(object => { if (object.material) for (const material of Array.isArray(object.material) ? object.material : [object.material]) { material.side = THREE.FrontSide; if (material.map) material.map.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); } });
      const warmupStart = performance.now();
      await renderer.compileAsync(group, camera, scene);
      const textures = new Set();
      group.traverse(object => {
        for (const material of (Array.isArray(object.material) ? object.material : [object.material])) if (material) {
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        }
      });
      for (const texture of textures) {
        await new Promise(resolve => typeof requestIdleCallback === 'function' ? requestIdleCallback(resolve, { timeout: 200 }) : setTimeout(resolve, 0));
        if (disposed || token !== generation) { disposeObject(group); return; }
        renderer.initTexture(texture);
      }
      if (disposed || token !== generation) { disposeObject(group); return; }
      const warmupMs = performance.now() - warmupStart;
      const previous = root; root = group; scene.add(group); if (previous) { scene.remove(previous); disposeObject(previous); }
      pending = null;
      metrics.quality = nextQuality; metrics.loadedBytes = buffer.byteLength; metrics.decodeMs = decodeMs; metrics.warmupMs = warmupMs; metrics.loadMs = performance.now() - started; metrics.state = 'ready';
      host.dataset.modelQuality = nextQuality; host.dataset.modelBytes = String(buffer.byteLength); host.dataset.modelLoaded = 'true';
      if (!free) paintCamera(progress);
      wake(); onStatus?.({ status: 'ready', quality: nextQuality });
    } catch (error) {
      disposeObject(pending);
      if (error.name === 'AbortError' || disposed || token !== generation) return;
      metrics.state = 'error'; onStatus?.({ status: 'error', message: error.message, replacing: Boolean(root) });
      console.error('Character model:', error);
    }
  }
  load(quality);
  const api = {
    setProgress(value) { const next = clamp(value); if (Math.abs(desired - next) < .00001) return; desired = next; if (!free) wake(); },
    setFree(value) { free = value; controls.enabled = value; renderer.domElement.style.touchAction = value ? 'none' : 'pan-y'; host.dataset.free = String(value); if (!value) { controls.enableDamping = false; paintCamera(progress); controls.enableDamping = true; settle = true; } wake(); },
    setQuality: load,
    snapshot() { return { ...metrics, frameIntervals: [...metrics.frameIntervals], visible, hidden: document.hidden, scheduled: Boolean(frame), free, progress, targetProgress: desired, pixelRatio, renderWidth: renderer.domElement.width, renderHeight: renderer.domElement.height, geometryCount: renderer.info.memory.geometries, textureCount: renderer.info.memory.textures, camera: camera.position.toArray() }; },
    dispose() {
      disposed = true; generation++; controller?.abort(); cancelAnimationFrame(frame);
      observer.disconnect(); visibility.disconnect(); document.removeEventListener('visibilitychange', onVisibility); motion.removeEventListener('change', onMotion);
      controls.removeEventListener('change', onControlChange); controls.dispose(); disposeObject(root);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost); renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
      host.dataset.renderState = 'disposed';
      delete host.getModelMetrics;
    },
  };
  host.getModelMetrics = api.snapshot;
  return api;
}
