import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import * as CANNON from "cannon-es";

const COLORS = ["#ff5a1f", "#ffc21a", "#4d8bff", "#1fb36b", "#ff6fae", "#b18cff"];
const INK = "#161513";
const MESSAGES = [
  "Pouring the foundation…",
  "Arguing with the CSS…",
  "Measuring twice, cutting once…",
  "Waiting for the coffee to kick in…",
  "Bribing the building inspector…",
  "Reading the instructions (finally)…",
  "Hiding the duct tape…",
  "Untangling the cables…",
  "Deciding what this site is for…",
];
const MAX_EXTRAS = 80;
const S = 1;          // name block size
const GAP = 0.06;

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const dark = matchMedia("(prefers-color-scheme: dark)").matches;
const BG = dark ? 0x151412 : 0xf3efe6;

// caution tape text and rotating status
const tapeText = Array(16).fill("UNDER CONSTRUCTION").map(t => `<span>${t}</span>`).join("");
document.getElementById("tape").innerHTML = tapeText + tapeText;
const statusEl = document.getElementById("status");
let msgIndex = 0;
setInterval(() => {
  msgIndex = (msgIndex + 1) % MESSAGES.length;
  statusEl.textContent = MESSAGES[msgIndex];
}, 2800);

// ---------- three.js scene ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(BG);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
const target = new THREE.Vector3(0, 2.4, 0);
let camDist = 14;

const HEMI_INTENSITY = dark ? 1.6 : 2.2;
const SUN_INTENSITY = dark ? 1.8 : 2.4;
const hemi = new THREE.HemisphereLight(0xffffff, dark ? 0x333028 : 0xd8cfbd, HEMI_INTENSITY);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, SUN_INTENSITY);
sun.position.set(6, 14, 9);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 50 });
sun.shadow.radius = 4;
scene.add(sun);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(300, 300),
  new THREE.ShadowMaterial({ opacity: dark ? 0.5 : 0.16 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

// ---------- physics ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -14, 0) });
world.allowSleep = true;
world.broadphase = new CANNON.SAPBroadphase(world);
world.defaultContactMaterial.friction = 0.5;
world.defaultContactMaterial.restitution = 0.15;

const ground = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane() });
ground.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(ground);

// ---------- materials ----------
const boxGeoms = new Map();
const boxGeom = size => {
  if (!boxGeoms.has(size)) boxGeoms.set(size, new RoundedBoxGeometry(size, size, size, 4, size * 0.1));
  return boxGeoms.get(size);
};

const letterMats = new Map();
function letterMaterial(ch, color) {
  const key = ch + color;
  if (letterMats.has(key)) return letterMats.get(key);
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 256, 256);
  ctx.fillStyle = INK;
  ctx.font = '170px "Archivo Black", Impact, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ch, 128, 140);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 });
  letterMats.set(key, mat);
  return mat;
}

const ballGeom = new THREE.SphereGeometry(1, 32, 16);
const ballMats = COLORS.map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.3 }));

// ---------- objects ----------
const items = [];   // everything with a body and a mesh
let letters = [];   // the name blocks, each with a home position
let extras = [];    // everything visitors add

function addItem(mesh, body) {
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
  world.addBody(body);
  const item = { mesh, body };
  items.push(item);
  return item;
}

function removeItem(item) {
  scene.remove(item.mesh);
  world.removeBody(item.body);
  const i = items.indexOf(item);
  if (i >= 0) items.splice(i, 1);
}

function makeBlock(ch, color, size, pos) {
  const body = new CANNON.Body({
    mass: size ** 3,
    shape: new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2)),
    position: new CANNON.Vec3(pos.x, pos.y, pos.z),
    sleepSpeedLimit: 0.15,
    sleepTimeLimit: 0.6,
  });
  return addItem(new THREE.Mesh(boxGeom(size), letterMaterial(ch, color)), body);
}

function addExtra(item) {
  extras.push(item);
  if (extras.length > MAX_EXTRAS) removeItem(extras.shift());
}

function buildName() {
  const rowWidth = 7 * S + 6 * GAP;
  const place = (word, y, offset, colorShift) => {
    [...word].forEach((ch, i) => {
      const x = -rowWidth / 2 + S / 2 + (i + offset) * (S + GAP);
      const home = new CANNON.Vec3(x, y, 0);
      const item = makeBlock(ch, COLORS[(i + colorShift) % COLORS.length], S, home);
      item.home = home;
      item.body.sleep();
      letters.push(item);
    });
  };
  place("RIBEIRO", S / 2, 0, 0);
  place("DAVID", S * 1.5 + 0.001, 1, 4);
}

function rebuild() {
  extras.forEach(removeItem);
  extras = [];
  removeWreckingBall();
  dynamites.forEach(d => removeItem(d.item));
  dynamites.length = 0;
  tornado = null;
  twisterMat.opacity = 0;
  quake = null;
  ufoState = null;
  ufo.visible = false;
  beamMat.opacity = 0;
  meteors.forEach(m => scene.remove(m.mesh));
  meteors.length = 0;
  meteorTime = 0;
  for (const { body, home } of letters) {
    body.position.copy(home);
    body.quaternion.set(0, 0, 0, 1);
    body.velocity.setZero();
    body.angularVelocity.setZero();
    body.sleep();
  }
}

// ---------- toys ----------
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();

function throwBall(clientX, clientY) {
  ndc.set((clientX / innerWidth) * 2 - 1, -(clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const dir = raycaster.ray.direction;
  const r = 0.3;
  const start = camera.position.clone().addScaledVector(dir, 2);
  const body = new CANNON.Body({
    mass: 2.5,
    shape: new CANNON.Sphere(r),
    position: new CANNON.Vec3(start.x, start.y, start.z),
    linearDamping: 0.05,
  });
  body.velocity.set(dir.x * 32, dir.y * 32, dir.z * 32);
  const mesh = new THREE.Mesh(ballGeom, pick(ballMats));
  mesh.scale.setScalar(r);
  addExtra(addItem(mesh, body));
}

function dropLetter(ch) {
  const size = 0.7;
  const item = makeBlock(ch, pick(COLORS), size, {
    x: (Math.random() - 0.5) * 8,
    y: 9 + Math.random() * 2,
    z: (Math.random() - 0.5) * 3,
  });
  item.body.angularVelocity.set(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2);
  addExtra(item);
}

// earthquake: a few seconds of rolling jolts that build, peak and fade
const QUAKE_TIME = 4;
const DUST = ["#b8a98f", "#8f8371", "#d6cbb5", "#6d685e"];
let quake = null;

function earthquake() {
  ensureAudio();
  quake = { t: 0, next: 0, side: 1, peaked: false };
  boom(0.5);
}

function updateQuake(dt) {
  if (!quake) return;
  quake.t += dt;
  const p = quake.t / QUAKE_TIME;
  if (p >= 1) { quake = null; return; }
  const strength = Math.min(1, p * 5, (1 - p) * 2.5);
  shake = Math.max(shake, 0.45 * strength);
  if (!quake.peaked && p > 0.25) {
    quake.peaked = true;
    boom(0.9);
  }

  quake.next -= dt;
  if (quake.next > 0) return;
  quake.next = 0.09 + Math.random() * 0.06;
  quake.side = -quake.side;
  const sway = quake.side * (2 + Math.random() * 2) * strength;
  for (const { body } of items) {
    if (Math.abs(body.velocity.y) > 3) continue;  // leave airborne things alone
    body.wakeUp();
    body.applyImpulse(new CANNON.Vec3(
      sway * body.mass,
      (0.8 + Math.random() * 2.2) * strength * body.mass,
      (Math.random() - 0.5) * 2.5 * strength * body.mass
    ));
    body.angularVelocity.x += (Math.random() - 0.5) * 3 * strength;
    body.angularVelocity.z += (Math.random() - 0.5) * 3 * strength;
  }
  burst(new THREE.Vector3((Math.random() - 0.5) * 18, 0.1, (Math.random() - 0.5) * 6),
    Math.round(30 * strength), { speed: 3, up: 4, colors: DUST, life: 1.2, drag: 1.5 });
}

// debris, sparks and confetti share one instanced mesh
const MAX_DEBRIS = 800;
const debrisMesh = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshStandardMaterial({ roughness: 0.6 }),
  MAX_DEBRIS
);
debrisMesh.castShadow = true;
debrisMesh.frustumCulled = false;
scene.add(debrisMesh);
const dummy = new THREE.Object3D();
const tmpColor = new THREE.Color();
const debris = [];
let debrisCursor = 0;
for (let i = 0; i < MAX_DEBRIS; i++) {
  debris.push({
    pos: new THREE.Vector3(), vel: new THREE.Vector3(),
    rot: new THREE.Vector3(), spin: new THREE.Vector3(),
    size: new THREE.Vector3(), life: 0, drag: 0,
  });
  debrisMesh.setColorAt(i, tmpColor.set(INK));
}

function burst(origin, count, { speed = 10, up = 6, colors = COLORS, flat = false, life = 1.6, drag = 0.2, scale = 1 } = {}) {
  for (let n = 0; n < count; n++) {
    const i = debrisCursor++ % MAX_DEBRIS;
    const p = debris[i];
    p.pos.copy(origin);
    p.vel.set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5)
      .normalize().multiplyScalar(speed * (0.3 + Math.random() * 0.7));
    p.vel.y += up * Math.random();
    p.spin.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(20);
    const s = (0.06 + Math.random() * 0.12) * scale;
    p.size.set(s, flat ? s * 0.15 : s, flat ? s * 1.6 : s);
    p.life = life * (0.6 + Math.random() * 0.4);
    p.drag = drag;
    debrisMesh.setColorAt(i, tmpColor.set(pick(colors)));
  }
  debrisMesh.instanceColor.needsUpdate = true;
}

function updateDebris(dt) {
  for (let i = 0; i < MAX_DEBRIS; i++) {
    const p = debris[i];
    if (p.life <= 0) {
      dummy.scale.setScalar(0);
    } else {
      p.life -= dt;
      p.vel.y += world.gravity.y * dt;
      p.vel.multiplyScalar(1 - p.drag * dt);
      p.pos.addScaledVector(p.vel, dt);
      const floorY = p.size.y / 2;
      if (p.pos.y < floorY) {
        p.pos.y = floorY;
        p.vel.set(p.vel.x * 0.6, -p.vel.y * 0.3, p.vel.z * 0.6);
        p.spin.multiplyScalar(0.6);
      }
      p.rot.addScaledVector(p.spin, dt);
      dummy.position.copy(p.pos);
      dummy.rotation.set(p.rot.x, p.rot.y, p.rot.z);
      dummy.scale.copy(p.size).multiplyScalar(Math.min(1, p.life * 2));
    }
    dummy.updateMatrix();
    debrisMesh.setMatrixAt(i, dummy.matrix);
  }
  debrisMesh.instanceMatrix.needsUpdate = true;
}

function confetti() {
  for (let x = -8; x <= 8; x += 2) {
    burst(new THREE.Vector3(x, 11, (Math.random() - 0.5) * 4), 45,
      { speed: 4, up: 2, flat: true, life: 6, drag: 1.8, scale: 1.4 });
  }
}

// explosions
let audio = null;
function ensureAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") audio.resume();
  } catch {}
}

function boom(volume = 1) {
  if (!audio) return;
  const len = Math.floor(audio.sampleRate * 1.4);
  const buf = audio.createBuffer(1, len, audio.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const src = audio.createBufferSource();
  src.buffer = buf;
  const lowpass = audio.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 500;
  const gain = audio.createGain();
  gain.gain.value = 0.9 * volume;
  src.connect(lowpass).connect(gain).connect(audio.destination);
  src.start();
}

const flash = new THREE.PointLight(0xffa040, 0, 30, 1.5);
scene.add(flash);
let shake = 0;

function explode(at, power = 1) {
  const reach = 7 * Math.sqrt(power);
  for (const { body } of items) {
    const d = body.position.vsub(at);
    const dist = d.length();
    if (dist > reach) continue;
    d.normalize();
    const k = body.mass * 14 * power / (dist + 0.6);
    body.wakeUp();
    body.applyImpulse(new CANNON.Vec3(d.x * k, d.y * k + body.mass * 6 * power * (1 - dist / reach), d.z * k));
  }
  const origin = new THREE.Vector3(at.x, at.y, at.z);
  burst(origin, Math.round(160 * power), { speed: 16 * Math.sqrt(power), up: 8, colors: ["#ff5a1f", "#ffc21a", "#2b2a28", "#ff8a3d"] });
  flash.position.set(at.x, at.y + 1, at.z);
  flash.intensity = Math.max(flash.intensity, 500 * power);
  shake = Math.max(shake, 0.7 * power);
  boom(power);
}

const dynamites = [];
const stickGeom = new THREE.CylinderGeometry(0.16, 0.16, 0.9, 16);
const stickMat = new THREE.MeshStandardMaterial({ color: 0xd8262c, roughness: 0.5 });
const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffd36b });
const sparkPos = new THREE.Vector3();

function dynamite() {
  ensureAudio();
  const group = new THREE.Group();
  const stick = new THREE.Mesh(stickGeom, stickMat);
  stick.castShadow = true;
  const spark = new THREE.Mesh(ballGeom, sparkMat);
  spark.position.y = 0.52;
  group.add(stick, spark);
  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Box(new CANNON.Vec3(0.16, 0.45, 0.16)),
    position: new CANNON.Vec3((Math.random() - 0.5) * 6, 9, 1.2),
    allowSleep: false,
  });
  body.angularVelocity.set(Math.random() * 6 - 3, 0, Math.random() * 6 - 3);
  dynamites.push({ item: addItem(group, body), spark, fuse: 2.4 });
}

function updateDynamite(dt) {
  for (let i = dynamites.length - 1; i >= 0; i--) {
    const d = dynamites[i];
    d.fuse -= dt;
    d.spark.scale.setScalar(0.05 + Math.random() * 0.09);
    if (Math.random() < 0.6) {
      d.spark.getWorldPosition(sparkPos);
      burst(sparkPos, 1, { speed: 3, up: 2, colors: ["#ffd36b", "#ff8a3d"], life: 0.35, scale: 0.4 });
    }
    if (d.fuse <= 0) {
      const at = d.item.body.position.clone();
      removeItem(d.item);
      dynamites.splice(i, 1);
      explode(at);
    }
  }
}

// tornado
const TORNADO_TIME = 9;
const TWISTER_POINTS = 1200;
const twisterPos = new Float32Array(TWISTER_POINTS * 3);
const twisterGeom = new THREE.BufferGeometry();
twisterGeom.setAttribute("position", new THREE.BufferAttribute(twisterPos, 3));
const twisterSeeds = Array.from({ length: TWISTER_POINTS }, () => ({
  h: Math.random(), a: Math.random() * Math.PI * 2, s: 0.6 + Math.random(),
}));
const twisterMat = new THREE.PointsMaterial({
  color: dark ? 0xbdb6a8 : 0x7d776c, size: 0.11, transparent: true, opacity: 0, depthWrite: false,
});
const twister = new THREE.Points(twisterGeom, twisterMat);
twister.frustumCulled = false;
scene.add(twister);
let tornado = null;
let tornadoSide = 1;

function startTornado() {
  tornadoSide *= -1;
  tornado = { t: 0, dir: tornadoSide };
}

function updateTornado(dt) {
  if (!tornado) return;
  tornado.t += dt;
  const p = tornado.t / TORNADO_TIME;
  if (p >= 1) {
    tornado = null;
    twisterMat.opacity = 0;
    return;
  }
  const cx = tornado.dir * (-11 + 22 * p);
  const cz = Math.sin(tornado.t * 1.3) * 1.2;
  twisterMat.opacity = Math.min(1, p * 6, (1 - p) * 6) * 0.85;

  twisterSeeds.forEach((s, i) => {
    s.a += dt * s.s * (7 - s.h * 4);
    s.h += dt * 0.22 * s.s;
    if (s.h > 1) s.h -= 1;
    const r = 0.25 + s.h * s.h * 4.2 + 0.25 * Math.sin(s.a * 3);
    twisterPos[i * 3] = cx + Math.cos(s.a) * r;
    twisterPos[i * 3 + 1] = s.h * 12;
    twisterPos[i * 3 + 2] = cz + Math.sin(s.a) * r;
  });
  twisterGeom.attributes.position.needsUpdate = true;

  for (const { body } of items) {
    const dx = body.position.x - cx;
    const dz = body.position.z - cz;
    const r = Math.hypot(dx, dz) || 0.001;
    if (r > 5 || body.position.y > 13) continue;
    const pull = (1 - r / 5) * body.mass;
    body.wakeUp();
    body.applyForce(new CANNON.Vec3(
      (-dz / r * 30 - dx / r * 14) * pull,
      26 * pull,
      (dx / r * 30 - dz / r * 14) * pull
    ));
  }
}

// ufo
const ufo = new THREE.Group();
const hull = new THREE.Mesh(ballGeom, new THREE.MeshStandardMaterial({ color: 0xb8bcc4, metalness: 0.8, roughness: 0.25 }));
hull.scale.set(1.7, 0.32, 1.7);
hull.castShadow = true;
const dome = new THREE.Mesh(
  new THREE.SphereGeometry(0.75, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0x7fe0ff, roughness: 0.05, transparent: true, opacity: 0.8 })
);
dome.position.y = 0.15;
const beamMat = new THREE.MeshBasicMaterial({
  color: 0x6dff8f, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide,
});
const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 1, 32, 1, true), beamMat);
ufo.add(hull, dome, beam);
const ufoLights = COLORS.concat(COLORS).map((color, i) => {
  const a = (i / 12) * Math.PI * 2;
  const light = new THREE.Mesh(ballGeom, new THREE.MeshBasicMaterial({ color }));
  light.scale.setScalar(0.09);
  light.position.set(Math.cos(a) * 1.45, -0.05, Math.sin(a) * 1.45);
  ufo.add(light);
  return light;
});
ufo.visible = false;
scene.add(ufo);
let ufoState = null;
let ufoSide = 1;

function startUfo() {
  ufoSide *= -1;
  const xs = [pick(letters), pick(letters)].map(l => THREE.MathUtils.clamp(l.body.position.x, -5, 5)).sort((a, b) => (a - b) * -ufoSide);
  // each key is where the saucer is headed, how long it takes, and whether the beam is on
  const keys = [
    { x: -16 * ufoSide, y: 10, beam: false, dur: 0 },
    { x: xs[0], y: 5.2, beam: false, dur: 2.2 },
    { x: xs[0], y: 5.2, beam: true, dur: 3.5 },
    { x: xs[1] - 2 * ufoSide, y: 5.6, beam: true, dur: 2.2 },
    { x: xs[1] - 2 * ufoSide, y: 5.6, beam: true, dur: 1.5 },
    { x: xs[1] - 2 * ufoSide, y: 6, beam: false, dur: 0.9 },
    { x: 16 * ufoSide, y: 11, beam: false, dur: 2.4 },
  ];
  ufoState = { t: 0, keys };
  ufo.visible = true;
}

function updateUfo(dt) {
  if (!ufoState) return;
  ufoState.t += dt;
  const k = ufoState.keys;
  let t = ufoState.t;
  let i = 1;
  while (i < k.length && t > k[i].dur) { t -= k[i].dur; i++; }
  if (i >= k.length) {
    ufoState = null;
    ufo.visible = false;
    beamMat.opacity = 0;
    return;
  }
  const a = k[i - 1], b = k[i];
  const p = t / b.dur;
  const e = p * p * (3 - 2 * p);
  const x = a.x + (b.x - a.x) * e;
  const y = a.y + (b.y - a.y) * e + Math.sin(ufoState.t * 3) * 0.12;
  ufo.position.set(x, y, 0.3);
  hull.rotation.y += dt * 2;
  ufoLights.forEach((light, j) => {
    light.visible = (Math.floor(ufoState.t * 8) + j) % 3 !== 0;
    const ang = (j / 12) * Math.PI * 2 + hull.rotation.y;
    light.position.set(Math.cos(ang) * 1.45, -0.05, Math.sin(ang) * 1.45);
  });
  beamMat.opacity += ((b.beam ? 0.3 : 0) - beamMat.opacity) * Math.min(1, dt * 8);
  beam.scale.set(1, y, 1);
  beam.position.y = -y / 2;
  if (!b.beam) return;

  const hoverY = y - 1.5;
  for (const { body } of items) {
    const dx = body.position.x - x;
    const dz = body.position.z - 0.3;
    if (Math.hypot(dx, dz) > 1.7 || body.position.y > y) continue;
    const m = body.mass;
    body.wakeUp();
    body.applyForce(new CANNON.Vec3(
      m * (-8 * dx - 2 * body.velocity.x),
      m * (-world.gravity.y + 5 * (hoverY - body.position.y) - 2.5 * body.velocity.y),
      m * (-8 * dz - 2 * body.velocity.z)
    ));
  }
}

// meteor shower
const meteors = [];
const meteorMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
let meteorTime = 0;
let meteorTimer = 0;

function startMeteors() {
  ensureAudio();
  meteorTime = 6;
}

function spawnMeteor() {
  const mesh = new THREE.Mesh(ballGeom, meteorMat);
  mesh.scale.setScalar(0.3);
  const target = new THREE.Vector3((Math.random() - 0.5) * 9, 0, (Math.random() - 0.5) * 2);
  mesh.position.set(target.x + 9, 20, target.z - 3);
  const vel = target.sub(mesh.position).normalize().multiplyScalar(24);
  scene.add(mesh);
  meteors.push({ mesh, vel });
}

function updateMeteors(dt) {
  if (meteorTime > 0) {
    meteorTime -= dt;
    meteorTimer -= dt;
    if (meteorTimer <= 0) {
      meteorTimer = 0.15 + Math.random() * 0.2;
      spawnMeteor();
    }
  }
  for (let i = meteors.length - 1; i >= 0; i--) {
    const { mesh, vel } = meteors[i];
    const p = mesh.position;
    p.addScaledVector(vel, dt);
    burst(p, 2, { speed: 1.5, up: 1, colors: ["#ffd36b", "#ff8a3d", "#ff5a1f"], life: 0.5, scale: 0.8, drag: 3 });
    const hit = p.y <= 0.35 || items.some(({ body }) => body.position.distanceTo(p) < 0.9);
    if (hit) {
      scene.remove(mesh);
      meteors.splice(i, 1);
      explode(new CANNON.Vec3(p.x, Math.max(p.y, 0.3), p.z), 0.4);
    }
  }
}

// secret disco, typed as D-A-V-I-D
const DISCO_TIME = 12;
const DISCO_BG = new THREE.Color(0x0b0a14);
const BG_COLOR = new THREE.Color(BG);
const discoLights = [0xff3df0, 0x3dd8ff, 0xfff23d].map(color => {
  const light = new THREE.SpotLight(color, 0, 40, 0.35, 0.5, 1);
  scene.add(light, light.target);
  return light;
});
let disco = 0;
let beat = 0;

function startDisco() {
  disco = DISCO_TIME;
}

function updateDisco(dt, time) {
  if (disco <= 0) return;
  disco = Math.max(0, disco - dt);
  const level = Math.min(1, (DISCO_TIME - disco) * 2, disco * 2);
  hemi.intensity = HEMI_INTENSITY * (1 - 0.85 * level);
  sun.intensity = SUN_INTENSITY * (1 - 0.85 * level);
  scene.background.lerpColors(BG_COLOR, DISCO_BG, level);
  scene.fog.color.copy(scene.background);
  document.body.classList.toggle("disco", level > 0.5 && !dark);
  discoLights.forEach((light, j) => {
    light.intensity = 600 * level;
    light.position.set(Math.cos(time * 1.2 + j * 2.1) * 6, 10, Math.sin(time * 1.2 + j * 2.1) * 6 + 3);
    light.target.position.set(Math.sin(time * 1.7 + j * 2) * 4, 0, Math.cos(time * 1.3 + j) * 1.5);
  });
  beat -= dt;
  if (beat <= 0 && level > 0.5) {
    beat = 0.47;
    for (const { body } of items) {
      if (body.position.y > 3) continue;
      body.wakeUp();
      body.applyImpulse(new CANNON.Vec3(0, body.mass * (2 + Math.random()), 0));
    }
  }
}

// gravity toggle
let moon = false;
function toggleMoon(e) {
  moon = !moon;
  world.gravity.set(0, moon ? -1.6 : -14, 0);
  e.currentTarget.setAttribute("aria-checked", moon);
  if (!moon) return;
  for (const { body } of items) {
    body.wakeUp();
    body.applyImpulse(new CANNON.Vec3(0, body.mass * (0.5 + Math.random() * 1.5), 0));
    body.angularVelocity.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  }
}

let wrecker = null;
let swingSide = -1;
const cableMat = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.6 });
const steelMat = new THREE.MeshStandardMaterial({ color: 0x2b2a28, metalness: 0.7, roughness: 0.35 });

function removeWreckingBall() {
  if (!wrecker) return;
  world.removeConstraint(wrecker.constraint);
  world.removeBody(wrecker.anchor);
  removeItem(wrecker.item);
  scene.remove(wrecker.cable);
  wrecker = null;
}

function wreckingBall() {
  removeWreckingBall();
  const pivot = new CANNON.Vec3(0, 11, 0);
  const length = 9.4;
  const angle = 1.35 * swingSide;
  swingSide *= -1;
  const r = 0.95;
  const anchor = new CANNON.Body({ type: CANNON.Body.STATIC, position: pivot });
  world.addBody(anchor);
  const body = new CANNON.Body({
    mass: 60,
    shape: new CANNON.Sphere(r),
    position: new CANNON.Vec3(pivot.x + Math.sin(angle) * length, pivot.y - Math.cos(angle) * length, 0),
    allowSleep: false,
  });
  const mesh = new THREE.Mesh(ballGeom, steelMat);
  mesh.scale.setScalar(r);
  const item = addItem(mesh, body);
  const constraint = new CANNON.DistanceConstraint(anchor, body, length);
  world.addConstraint(constraint);
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 8), cableMat);
  cable.castShadow = true;
  scene.add(cable);
  wrecker = { anchor, item, constraint, cable };
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
function updateCable() {
  if (!wrecker) return;
  tmpA.copy(wrecker.anchor.position);
  tmpB.copy(wrecker.item.body.position);
  const len = tmpA.distanceTo(tmpB);
  wrecker.cable.position.copy(tmpA).add(tmpB).multiplyScalar(0.5);
  wrecker.cable.scale.set(1, len, 1);
  wrecker.cable.quaternion.setFromUnitVectors(UP, tmpB.sub(tmpA).normalize());
}

// ---------- integrity meter ----------
const integrityEl = document.getElementById("integrity");
let lastIntegrity = 100;
function measureIntegrity() {
  const intact = letters.filter(({ body, home }) =>
    body.position.distanceTo(home) < 0.25 && 2 * Math.acos(Math.min(1, Math.abs(body.quaternion.w))) < 0.2
  ).length;
  const pct = Math.round((intact / letters.length) * 100);
  if (pct === lastIntegrity) return;
  if (pct === 0) confetti();
  lastIntegrity = pct;
  integrityEl.textContent = pct === 0 ? "0%. Nice work." : pct + "%";
}

// ---------- camera fit + parallax ----------
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  // back off far enough that the whole name fits the width
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  const hTan = Math.tan(halfFov) * camera.aspect;
  camDist = Math.max(13, 4.6 / hTan + 1);
  scene.fog = new THREE.Fog(BG, camDist + 6, camDist + 40);
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

const pointer = { x: 0, y: 0 };
const look = { x: 0, y: 0 };
addEventListener("pointermove", e => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = (e.clientY / innerHeight) * 2 - 1;
});

// ---------- input ----------
let down = null;
renderer.domElement.addEventListener("pointerdown", e => { down = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener("pointerup", e => {
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8) throwBall(e.clientX, e.clientY);
  down = null;
});

let typed = "";
addEventListener("keydown", e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.key.length !== 1) return;
  const ch = e.key.toUpperCase();
  if (!/[A-Z0-9!?&@#]/.test(ch)) return;
  dropLetter(ch);
  typed = (typed + ch).slice(-5);
  if (typed === "DAVID") startDisco();
});

document.getElementById("wrecking").addEventListener("click", wreckingBall);
document.getElementById("quake").addEventListener("click", earthquake);
document.getElementById("dynamite").addEventListener("click", dynamite);
document.getElementById("tornado").addEventListener("click", startTornado);
document.getElementById("moon").addEventListener("click", toggleMoon);
document.getElementById("ufo").addEventListener("click", startUfo);
document.getElementById("meteors").addEventListener("click", startMeteors);
document.getElementById("rebuild").addEventListener("click", rebuild);

// ---------- go ----------
await document.fonts.load('170px "Archivo Black"').catch(() => {});
buildName();

const clock = new THREE.Clock();
let frame = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  world.step(1 / 60, dt, 5);

  for (const { mesh, body } of items) {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  }
  updateCable();
  updateDynamite(dt);
  updateTornado(dt);
  updateQuake(dt);
  updateUfo(dt);
  updateMeteors(dt);
  updateDisco(dt, clock.elapsedTime);
  updateDebris(dt);
  flash.intensity *= 0.86;

  look.x += (pointer.x - look.x) * 0.04;
  look.y += (pointer.y - look.y) * 0.04;
  const a = look.x * 0.35;
  camera.position.set(Math.sin(a) * camDist, 3.6 + look.y * 1.5, Math.cos(a) * camDist);
  camera.lookAt(target);
  if (shake > 0.01) {
    camera.position.x += (Math.random() - 0.5) * shake;
    camera.position.y += (Math.random() - 0.5) * shake;
    shake *= 0.9;
  }

  if (++frame % 12 === 0) measureIntegrity();
  renderer.render(scene, camera);
});
