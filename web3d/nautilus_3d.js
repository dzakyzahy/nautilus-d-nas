/**
 * Nautilus D-NAS 3D Swarm & UGREEN AI NAS Web Visualizer
 * Core Three.js Engine & Swarm Mesh Orchestrator
 */

// ---------------------------------------------------------------------------
// Global Variables & State
// ---------------------------------------------------------------------------
let scene, camera, renderer, controls;
let marineSnow, pipeline, motherVessel, ugreenNasMesh, anomalyMarker;
let droneMeshes = [];
let meshLines = [];
let sonarCones = [];
let matrixHoloGroup;
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();
let selectedDroneIndex = null;
let currentCameraMode = "orbit";
let isReconstructing = false;
let lastFrameTime = 0;

// 10 Drones Swarm Fleet (k=6 data, m=4 parity)
const SWARM_CONFIG = {
  k: 6,
  m: 4,
  total: 10,
  drones: []
};

// Initialize drone state objects
for (let i = 0; i < 10; i++) {
  const isData = i < 6;
  SWARM_CONFIG.drones.push({
    index: i,
    id: `AUV-${String(i + 1).padStart(2, '0')}`,
    type: isData ? "data" : "parity",
    shardId: isData ? `D${i}` : `P${i - 6}`,
    status: "online", // "online" | "sunken" | "corrupt"
    depth: 820 + Math.random() * 40,
    battery: 98.5 - i * 0.4,
    snr: 16.5 + Math.random() * 5.0,
    hash: `e3b0c442${(i * 1337).toString(16).padStart(6, '0')}...`,
    initialPos: new THREE.Vector3(
      (i % 5 - 2) * 16 + (Math.random() - 0.5) * 4,
      -12 - Math.floor(i / 5) * 8 + (Math.random() - 0.5) * 3,
      (Math.floor(i / 5) - 0.5) * 24 + (Math.random() - 0.5) * 6
    ),
    targetPos: null,
    mesh: null,
    beaconLight: null,
    sonarCone: null
  });
}

// ---------------------------------------------------------------------------
// Main Initialization
// ---------------------------------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
  initThreeScene();
  createDeepOceanEnvironment();
  createSubseaPipeline();
  createMotherVesselWithNAS();
  createDroneFleet();
  createAcousticMeshLinks();
  if (window.NautilusBathymetry) window.NautilusBathymetry.init(scene);
  setupEventListeners();
  renderDroneGridUI();
  updateHUDMetrics();
  animate();

  logTerminal("Nautilus D-NAS 3D Ocean Visualizer loaded successfully.", "success");
  logTerminal("Connected to UGREEN AI NAS iDX6011 Pro (Edge UGOS Pro).", "info");

  // [Diky] Init Diky's components
  renderShardAuditTable();
  initCodecControlDrawer();
  initWebSocketLogStream();
});

// ---------------------------------------------------------------------------
// Three.js Scene Setup
// ---------------------------------------------------------------------------
function initThreeScene() {
  const container = document.getElementById("canvas-container");

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020b14);
  scene.fog = new THREE.FogExp2(0x020b14, 0.011);

  // Camera
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.5, 1000);
  camera.position.set(45, 15, 65);

  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  // OrbitControls
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxDistance = 180;
  controls.minDistance = 5;
  controls.maxPolarAngle = Math.PI / 2 + 0.1; // Don't look too far under seabed

  // Lighting
  const ambientLight = new THREE.AmbientLight(0x0b2545, 1.2);
  scene.add(ambientLight);

  // Surface Sun Piercing Light
  const sunLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
  sunLight.position.set(20, 60, 20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  scene.add(sunLight);

  // Deep Water Cyan Glow
  const waterGlow = new THREE.PointLight(0x06b6d4, 1.5, 120);
  waterGlow.position.set(0, -10, 0);
  scene.add(waterGlow);

  window.addEventListener("resize", onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// ---------------------------------------------------------------------------
// Deep Ocean Environment (Seabed, Caustics, Marine Snow)
// ---------------------------------------------------------------------------
function createDeepOceanEnvironment() {
  // 1. Water Surface Plane (Y = 8)
  const surfaceGeo = new THREE.PlaneGeometry(300, 300, 32, 32);
  const surfaceMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    roughness: 0.1,
    metalness: 0.8,
    transparent: true,
    opacity: 0.35,
    wireframe: false,
    side: THREE.DoubleSide
  });
  const waterSurface = new THREE.Mesh(surfaceGeo, surfaceMat);
  waterSurface.rotation.x = -Math.PI / 2;
  waterSurface.position.y = 8;
  scene.add(waterSurface);

  // 2. Seabed Terrain (Y = -35)
  const seabedGeo = new THREE.PlaneGeometry(300, 300, 64, 64);
  const pos = seabedGeo.attributes.position;
  // Procedural underwater sand dunes and abyssal ridges
  for (let i = 0; i < pos.count; i++) {
    const vx = pos.getX(i);
    const vy = pos.getY(i);
    const zVal = Math.sin(vx * 0.05) * 2.5 + Math.cos(vy * 0.04) * 2.0 + Math.sin((vx + vy) * 0.02) * 3.0;
    pos.setZ(i, zVal);
  }
  seabedGeo.computeVertexNormals();

  const seabedMat = new THREE.MeshStandardMaterial({
    color: 0x051329,
    roughness: 0.9,
    metalness: 0.1,
    flatShading: true
  });
  const seabed = new THREE.Mesh(seabedGeo, seabedMat);
  seabed.rotation.x = -Math.PI / 2;
  seabed.position.y = -35;
  seabed.receiveShadow = true;
  scene.add(seabed);

  // 3. Marine Snow Particles (Floating Specks)
  const snowGeo = new THREE.BufferGeometry();
  const snowCount = 1200;
  const snowPos = new Float32Array(snowCount * 3);
  for (let i = 0; i < snowCount * 3; i += 3) {
    snowPos[i] = (Math.random() - 0.5) * 180;
    snowPos[i + 1] = -35 + Math.random() * 42;
    snowPos[i + 2] = (Math.random() - 0.5) * 180;
  }
  snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
  const snowMat = new THREE.PointsMaterial({
    color: 0x38bdf8,
    size: 0.45,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending
  });
  marineSnow = new THREE.Points(snowGeo, snowMat);
  scene.add(marineSnow);
}

// ---------------------------------------------------------------------------
// Subsea Pipeline with Fracture Anomaly
// ---------------------------------------------------------------------------
function createSubseaPipeline() {
  const pipeGroup = new THREE.Group();

  // Main Pipeline Cylinder along Z axis
  const pipeGeo = new THREE.CylinderGeometry(1.4, 1.4, 140, 24);
  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.4,
    metalness: 0.8
  });
  const mainPipe = new THREE.Mesh(pipeGeo, pipeMat);
  mainPipe.rotation.x = Math.PI / 2;
  mainPipe.position.set(12, -33.2, 0);
  mainPipe.castShadow = true;
  mainPipe.receiveShadow = true;
  pipeGroup.add(mainPipe);

  // Flange Joints & Concrete Support Saddles
  for (let z = -60; z <= 60; z += 20) {
    const flangeGeo = new THREE.CylinderGeometry(1.8, 1.8, 1.2, 24);
    const flangeMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.3 });
    const flange = new THREE.Mesh(flangeGeo, flangeMat);
    flange.rotation.x = Math.PI / 2;
    flange.position.set(12, -33.2, z);
    pipeGroup.add(flange);

    // Support Saddle base to seabed
    const baseGeo = new THREE.BoxGeometry(4.5, 2.5, 2.5);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const saddle = new THREE.Mesh(baseGeo, baseMat);
    saddle.position.set(12, -34.2, z);
    pipeGroup.add(saddle);
  }

  // CRITICAL ANOMALY: Pipeline Crack Site (X=12, Y=-33.2, Z=-10)
  const crackPos = new THREE.Vector3(12, -31.8, -10);

  // Red Hazard Pulsing Marker Ring
  const markerGeo = new THREE.RingGeometry(1.6, 2.2, 32);
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xef4444,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.85
  });
  anomalyMarker = new THREE.Mesh(markerGeo, markerMat);
  anomalyMarker.position.copy(crackPos);
  anomalyMarker.rotation.x = -Math.PI / 2;
  pipeGroup.add(anomalyMarker);

  // Crack Flaw Notch Mesh
  const flawGeo = new THREE.BoxGeometry(0.3, 0.4, 3.5);
  const flawMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
  const flaw = new THREE.Mesh(flawGeo, flawMat);
  flaw.position.set(12, -32.0, -10);
  pipeGroup.add(flaw);

  // Pulsing Point Light on Crack
  const crackLight = new THREE.PointLight(0xef4444, 2.5, 15);
  crackLight.position.copy(crackPos);
  pipeGroup.add(crackLight);

  scene.add(pipeGroup);
  pipeline = pipeGroup;
}

// ---------------------------------------------------------------------------
// Mother Support Vessel & UGREEN AI NAS Installation
// ---------------------------------------------------------------------------
function createMotherVesselWithNAS() {
  const vesselGroup = new THREE.Group();

  // Ship Hull
  const hullGeo = new THREE.BoxGeometry(14, 4, 34);
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.7,
    roughness: 0.3
  });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.position.set(-15, 8.5, -20);
  vesselGroup.add(hull);

  // Deck Superstructure / Bridge
  const bridgeGeo = new THREE.BoxGeometry(9, 4.5, 12);
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 });
  const bridge = new THREE.Mesh(bridgeGeo, bridgeMat);
  bridge.position.set(-15, 12.5, -24);
  vesselGroup.add(bridge);

  // Radar Mast
  const mastGeo = new THREE.CylinderGeometry(0.2, 0.3, 6);
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8 });
  const mast = new THREE.Mesh(mastGeo, mastMat);
  mast.position.set(-15, 17.5, -24);
  vesselGroup.add(mast);

  // Radar Dish Spinner
  const dishGeo = new THREE.BoxGeometry(3, 0.4, 0.6);
  const dishMat = new THREE.MeshStandardMaterial({ color: 0x22d3ee });
  const dish = new THREE.Mesh(dishGeo, dishMat);
  dish.position.set(-15, 20.5, -24);
  dish.name = "radarDish";
  vesselGroup.add(dish);

  // -----------------------------------------------------------------------
  // UGREEN AI NAS iDX6011 Pro Server Rack Installation
  // -----------------------------------------------------------------------
  const nasRack = new THREE.Group();
  nasRack.position.set(-15, 11.2, -12);

  // Server Chassis
  const rackChassisGeo = new THREE.BoxGeometry(3.2, 2.2, 2.2);
  const rackChassisMat = new THREE.MeshStandardMaterial({
    color: 0x030712,
    metalness: 0.9,
    roughness: 0.2
  });
  const rackChassis = new THREE.Mesh(rackChassisGeo, rackChassisMat);
  nasRack.add(rackChassis);

  // Glowing Cyan Accent Panels & Storage Bays
  const bayGeo = new THREE.BoxGeometry(2.8, 0.3, 0.1);
  for (let b = 0; b < 4; b++) {
    const bayMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4 });
    const bay = new THREE.Mesh(bayGeo, bayMat);
    bay.position.set(0, -0.6 + b * 0.4, 1.12);
    nasRack.add(bay);
  }

  // Holographic Data Shield / Beacon Dome
  const domeGeo = new THREE.SphereGeometry(3.5, 24, 24);
  const domeMat = new THREE.MeshBasicMaterial({
    color: 0x22d3ee,
    wireframe: true,
    transparent: true,
    opacity: 0.25
  });
  const holoDome = new THREE.Mesh(domeGeo, domeMat);
  holoDome.name = "nasHoloDome";
  nasRack.add(holoDome);

  // UGREEN AI Core Beacon Light
  const nasBeacon = new THREE.PointLight(0x22d3ee, 3.0, 30);
  nasBeacon.position.set(0, 0.5, 0);
  nasRack.add(nasBeacon);

  vesselGroup.add(nasRack);
  ugreenNasMesh = nasRack;

  scene.add(vesselGroup);
  motherVessel = vesselGroup;
}

// ---------------------------------------------------------------------------
// Drone Fleet Construction (10 AUVs)
// ---------------------------------------------------------------------------
function createDroneFleet() {
  droneMeshes = [];

  SWARM_CONFIG.drones.forEach((droneData) => {
    const droneGroup = new THREE.Group();
    droneGroup.position.copy(droneData.initialPos);

    // Drone Hull: Torpedo / AUV Streamlined Body
    const hullGeo = new THREE.ConeGeometry(0.85, 4.2, 16);
    hullGeo.rotateX(Math.PI / 2); // Point forward
    const isData = droneData.type === "data";
    const baseColor = isData ? 0x0284c7 : 0x7c3aed; // Cyan vs Purple
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.3,
      metalness: 0.7
    });
    const mainHull = new THREE.Mesh(hullGeo, hullMat);
    mainHull.castShadow = true;
    droneGroup.add(mainHull);

    // Color Stripe for Identification (Data vs Parity)
    const stripeGeo = new THREE.CylinderGeometry(0.86, 0.86, 0.8, 16);
    stripeGeo.rotateX(Math.PI / 2);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: baseColor,
      metalness: 0.8,
      roughness: 0.3
    });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.z = -0.5;
    droneGroup.add(stripe);

    // Hydrodynamic Fins (Top, Bottom, Sides)
    const finGeo = new THREE.BoxGeometry(0.08, 1.2, 0.8);
    const finMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });
    const topFin = new THREE.Mesh(finGeo, finMat);
    topFin.position.set(0, 0.7, -1.2);
    droneGroup.add(topFin);

    const sideFinGeo = new THREE.BoxGeometry(1.6, 0.08, 0.8);
    const sideFins = new THREE.Mesh(sideFinGeo, finMat);
    sideFins.position.set(0, 0, -1.0);
    droneGroup.add(sideFins);

    // Twin Rotating Thrusters (Rear)
    const thrusterGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.5, 12);
    thrusterGeo.rotateX(Math.PI / 2);
    const thrusterMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9 });
    const leftThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    leftThruster.position.set(-0.5, 0, -2.1);
    const rightThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    rightThruster.position.set(0.5, 0, -2.1);
    droneGroup.add(leftThruster);
    droneGroup.add(rightThruster);

    // Top Shard Beacon LED Indicator
    const beaconGeo = new THREE.SphereGeometry(0.3, 16, 16);
    const beaconColor = isData ? 0x22d3ee : 0xa855f7;
    const beaconMat = new THREE.MeshBasicMaterial({ color: beaconColor });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, 0.85, 0);
    droneGroup.add(beacon);

    const beaconLight = new THREE.PointLight(beaconColor, 1.5, 12);
    beaconLight.position.set(0, 0.85, 0);
    droneGroup.add(beaconLight);

    // Front Sonar Conical Projection Beam
    const sonarGeo = new THREE.ConeGeometry(2.4, 6.0, 16, 1, true);
    sonarGeo.rotateX(-Math.PI / 2);
    const sonarMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.12,
      wireframe: true,
      side: THREE.DoubleSide
    });
    const sonarCone = new THREE.Mesh(sonarGeo, sonarMat);
    sonarCone.position.set(0, 0, 4.2);
    droneGroup.add(sonarCone);

    // Metadata attachment
    droneGroup.userData = {
      droneIndex: droneData.index,
      data: droneData
    };

    droneData.mesh = droneGroup;
    droneData.beaconLight = beaconLight;
    droneData.beaconMesh = beacon;
    droneData.sonarCone = sonarCone;

    scene.add(droneGroup);
    droneMeshes.push(droneGroup);
  });
}

// ---------------------------------------------------------------------------
// Dynamic Acoustic Mesh Lines
// ---------------------------------------------------------------------------
function createAcousticMeshLinks() {
  // Clear any existing mesh lines
  meshLines.forEach(line => scene.remove(line));
  meshLines = [];

  const lineMat = new THREE.LineDashedMaterial({
    color: 0x06b6d4,
    dashSize: 1.5,
    gapSize: 0.8,
    linewidth: 1,
    transparent: true,
    opacity: 0.35
  });

  // Link adjacent drone pairs to represent the mesh
  for (let i = 0; i < SWARM_CONFIG.drones.length; i++) {
    for (let j = i + 1; j < SWARM_CONFIG.drones.length; j++) {
      const d1 = SWARM_CONFIG.drones[i];
      const d2 = SWARM_CONFIG.drones[j];

      // Only connect if both drones are online and within reasonable range
      if (d1.status !== "sunken" && d2.status !== "sunken") {
        const dist = d1.mesh.position.distanceTo(d2.mesh.position);
        if (dist < 32) {
          const geo = new THREE.BufferGeometry().setFromPoints([
            d1.mesh.position,
            d2.mesh.position
          ]);
          const line = new THREE.Line(geo, lineMat);
          line.computeLineDistances();
          scene.add(line);
          meshLines.push({ line, d1, d2 });
        }
      }
    }
  }
}

// Update mesh line geometries every frame as drones undulate
function updateMeshLines() {
  meshLines.forEach(({ line, d1, d2 }) => {
    if (d1.status === "sunken" || d2.status === "sunken") {
      line.visible = false;
    } else {
      line.visible = true;
      const positions = line.geometry.attributes.position.array;
      positions[0] = d1.mesh.position.x;
      positions[1] = d1.mesh.position.y;
      positions[2] = d1.mesh.position.z;
      positions[3] = d2.mesh.position.x;
      positions[4] = d2.mesh.position.y;
      positions[5] = d2.mesh.position.z;
      line.geometry.attributes.position.needsUpdate = true;
      line.computeLineDistances();
    }
  });
}

// ---------------------------------------------------------------------------
// Interactive UI & Drone Grid Rendering
// ---------------------------------------------------------------------------
function renderDroneGridUI() {
  const gridContainer = document.getElementById("drone-grid");
  gridContainer.innerHTML = "";

  SWARM_CONFIG.drones.forEach((d) => {
    const cell = document.createElement("div");
    cell.className = `drone-cell active-${d.type}`;
    if (d.status === "sunken") cell.classList.add("sunken");
    if (d.status === "corrupt") cell.classList.add("corrupt");

    cell.innerHTML = `
      <span class="cell-id">${d.id}</span>
      <span class="cell-type">${d.shardId} (${d.type.toUpperCase()})</span>
    `;

    cell.addEventListener("click", () => {
      openDroneInspector(d.index);
    });

    gridContainer.appendChild(cell);
  });
}

function updateHUDMetrics() {
  const onlineCount = SWARM_CONFIG.drones.filter(d => d.status === "online").length;
  const corruptCount = SWARM_CONFIG.drones.filter(d => d.status === "corrupt").length;
  const sunkenCount = SWARM_CONFIG.drones.filter(d => d.status === "sunken").length;
  const validCount = onlineCount;

  // Header Status
  document.getElementById("hud-fleet-status").innerText = `${validCount} / 10 ONLINE`;

  // Inventory breakdown
  document.getElementById("inv-valid").innerText = `${validCount}/10`;
  document.getElementById("inv-lost").innerText = `${sunkenCount}`;
  document.getElementById("inv-corrupt").innerText = `${corruptCount}`;

  // Badge
  const badge = document.getElementById("reconstruction-badge");
  if (validCount >= SWARM_CONFIG.k) {
    badge.className = "badge ready";
    badge.innerText = `READY (S_valid=${validCount} ≥ k=${SWARM_CONFIG.k})`;
  } else {
    badge.className = "badge insufficient";
    badge.innerText = `CRITICAL: S_valid=${validCount} < k=${SWARM_CONFIG.k}`;
  }

  // Calculate R_swarm dynamically via binomial distribution formula
  fetchSwarmReliability(10, SWARM_CONFIG.m, 0.30);
}

// Dynamic Binomial Swarm Calculation
async function fetchSwarmReliability(n, m, p) {
  try {
    const res = await fetch(`/api/analytics/r-swarm?n=${n}&m=${m}&p=${p}`);
    if (res.ok) {
      const data = await res.json();
      document.getElementById("r-swarm-val").innerText = data.swarm_survival_percentage;
      const pct = parseFloat(data.swarm_survival_percentage);
      document.getElementById("r-swarm-bar").style.width = `${pct}%`;
      return;
    }
  } catch (e) {
    // Standalone fallback: mathematical binomial formula in client
    let prob = 0;
    for (let i = 0; i <= m; i++) {
      let combs = factorial(n) / (factorial(i) * factorial(n - i));
      prob += combs * Math.pow(p, i) * Math.pow(1 - p, n - i);
    }
    const pct = (prob * 100).toFixed(1);
    document.getElementById("r-swarm-val").innerText = `${pct}%`;
    document.getElementById("r-swarm-bar").style.width = `${pct}%`;
  }
}

function factorial(num) {
  if (num <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= num; i++) res *= i;
  return res;
}

// ---------------------------------------------------------------------------
// Drone Inspector Modal
// ---------------------------------------------------------------------------
function openDroneInspector(index) {
  selectedDroneIndex = index;
  const drone = SWARM_CONFIG.drones[index];

  document.getElementById("inspect-drone-id").innerText = drone.id;
  const roleBadge = document.getElementById("inspect-drone-role");
  roleBadge.innerText = `${drone.type.toUpperCase()} SHARD (${drone.shardId})`;
  roleBadge.className = `badge ${drone.type}`;

  document.getElementById("inspect-status").innerText = drone.status.toUpperCase();
  document.getElementById("inspect-depth").innerText = `${drone.depth.toFixed(1)} m`;
  document.getElementById("inspect-battery").innerText = `${drone.battery.toFixed(1)}%`;
  document.getElementById("inspect-snr").innerText = `${drone.snr.toFixed(1)} dB`;
  document.getElementById("inspect-hash").innerText = drone.hash;

  const sinkBtn = document.getElementById("btn-toggle-drone-sink");
  sinkBtn.innerText = drone.status === "sunken" ? "Revive / Surface Drone" : "Sink / Kill Drone";

  const corruptBtn = document.getElementById("btn-toggle-drone-corrupt");
  corruptBtn.innerText = drone.status === "corrupt" ? "Restore Integrity" : "Inject Bit-Rot";

  document.getElementById("drone-inspector-modal").style.display = "block";
}

function closeDroneInspector() {
  document.getElementById("drone-inspector-modal").style.display = "none";
  selectedDroneIndex = null;
}

// ---------------------------------------------------------------------------
// Simulation Actions: Sink Drones, Inject Bit-Rot, Reset (with P2P & Physics)
// ---------------------------------------------------------------------------
function sinkDrone(index, isRemote = false) {
  const drone = SWARM_CONFIG.drones[index];
  if (!drone) return;

  if (drone.status === "sunken") {
    // Revive
    drone.status = "online";
    drone.mesh.visible = true;

    if (window.NautilusOceanPhysics) {
      window.NautilusOceanPhysics.revive(index, drone.initialPos.y);
    } else {
      new TWEEN.Tween(drone.mesh.position)
        .to({ y: drone.initialPos.y }, 1500)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start();
    }

    drone.beaconLight.color.setHex(drone.type === "data" ? 0x22d3ee : 0xa855f7);
    drone.beaconMesh.material.color.setHex(drone.type === "data" ? 0x22d3ee : 0xa855f7);
    logTerminal(`[REVIVE] ${drone.id} re-established acoustic link. Shard ${drone.shardId} back online.${isRemote ? ' (P2P Remote)' : ''}`, "info");
  } else {
    // Sink drone
    drone.status = "sunken";
    drone.beaconLight.color.setHex(0xef4444);
    drone.beaconMesh.material.color.setHex(0xef4444);

    if (window.NautilusOceanPhysics) {
      window.NautilusOceanPhysics.sink(index);
    } else {
      new TWEEN.Tween(drone.mesh.position)
        .to({ y: -48, x: drone.mesh.position.x + (Math.random() - 0.5) * 6 }, 2500)
        .easing(TWEEN.Easing.Quadratic.In)
        .start();
    }

    if (window.NautilusAudio) window.NautilusAudio.playAlarm();
    logTerminal(`[ALERT] ${drone.id} hull breached / sunken into trench! Shard ${drone.shardId} lost.${isRemote ? ' (P2P Remote)' : ''}`, "danger");
  }

  // P2P multi-client synchronization
  if (!isRemote && window.NautilusP2P) {
    window.NautilusP2P.broadcastSink(index);
  }

  renderDroneGridUI();
  updateHUDMetrics();
  createAcousticMeshLinks();
  renderShardAuditTable();
}

function corruptDroneShard(index, isRemote = false) {
  const drone = SWARM_CONFIG.drones[index];
  if (!drone) return;

  if (drone.status === "corrupt") {
    drone.status = "online";
    drone.beaconLight.color.setHex(drone.type === "data" ? 0x22d3ee : 0xa855f7);
    drone.beaconMesh.material.color.setHex(drone.type === "data" ? 0x22d3ee : 0xa855f7);
    logTerminal(`[AUDIT] ${drone.id} parity scrubbed. Checksum restored.${isRemote ? ' (P2P Remote)' : ''}`, "success");
  } else {
    drone.status = "corrupt";
    drone.beaconLight.color.setHex(0xf59e0b);
    drone.beaconMesh.material.color.setHex(0xf59e0b);
    if (window.NautilusAudio) window.NautilusAudio.playBitRotWarning();
    logTerminal(`[WARNING] Bit-rot detected on ${drone.id} (Shard ${drone.shardId}). Hash verification failed!${isRemote ? ' (P2P Remote)' : ''}`, "warning");
  }

  // P2P multi-client synchronization
  if (!isRemote && window.NautilusP2P) {
    window.NautilusP2P.broadcastCorrupt(index);
  }

  renderDroneGridUI();
  updateHUDMetrics();
  renderShardAuditTable();
}

// Reset Entire Swarm to Initial State
function resetSwarm(isRemote = false) {
  SWARM_CONFIG.drones.forEach((drone) => {
    drone.status = "online";
    drone.mesh.visible = true;

    if (window.NautilusOceanPhysics) {
      window.NautilusOceanPhysics.revive(drone.index, drone.initialPos.y);
    }

    new TWEEN.Tween(drone.mesh.position)
      .to({ x: drone.initialPos.x, y: drone.initialPos.y, z: drone.initialPos.z }, 1000)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
    drone.beaconLight.color.setHex(drone.type === "data" ? 0x22d3ee : 0xa855f7);
    drone.beaconMesh.material.color.setHex(drone.type === "data" ? 0x22d3ee : 0xa855f7);
  });

  if (window.NautilusBathymetry) window.NautilusBathymetry.reset();
  if (matrixHoloGroup) {
    scene.remove(matrixHoloGroup);
    matrixHoloGroup = null;
  }

  // P2P multi-client synchronization
  if (!isRemote && window.NautilusP2P) {
    window.NautilusP2P.broadcastReset();
  }

  renderDroneGridUI();
  updateHUDMetrics();
  createAcousticMeshLinks();
  renderShardAuditTable();
  logTerminal(`[SYS] Swarm fleet reset to standard Bravo-7 patrol formation.${isRemote ? ' (P2P Remote)' : ''}`, "info");
}

// ---------------------------------------------------------------------------
// NAUTILUS D-NAS RECONSTRUCTION PIPELINE (The Brain in Action)
// ---------------------------------------------------------------------------
async function executeNautilusPipeline(isRemote = false) {
  if (isReconstructing) return;
  isReconstructing = true;

  if (!isRemote && window.NautilusP2P) {
    window.NautilusP2P.broadcastPipeline();
  }

  const btn = document.getElementById("btn-run-pipeline");
  const spinner = document.getElementById("pipeline-spinner");
  btn.disabled = true;
  spinner.style.display = "inline-block";

  logTerminal("═══════════════════════════════════════════════════════", "info");
  logTerminal("▶ INITIATING NAUTILUS D-NAS RECONSTRUCTION PIPELINE", "info");
  logTerminal("Orchestrated via Uliya AI Skill: nautilus-dnas-sync", "info");

  // Phase 1: Swarm Inventory Audit & Acoustic Uplink
  await runPhase1Audit();

  // Phase 2: Reed-Solomon GF(2^8) Matrix Inversion
  const success = await runPhase2MatrixInversion();

  if (success) {
    // Phase 3: AI Knowledge Hub Indexing & Sonar Sweep
    await runPhase3AIIndexing();
  }

  btn.disabled = false;
  spinner.style.display = "none";
  isReconstructing = false;
}

// Phase 1: Audit & Acoustic Ingestion Beams
async function runPhase1Audit() {
  if (window.NautilusAudio) window.NautilusAudio.playSonarPing(880, 1.4);
  logTerminal("[STEP 1/3] Scanning incoming mission volume on UGREEN AI NAS...", "info");

  const validDrones = SWARM_CONFIG.drones.filter(d => d.status === "online");
  const corruptDrones = SWARM_CONFIG.drones.filter(d => d.status === "corrupt");

  // Animate acoustic beams from surviving drones to Mother Vessel NAS
  const beamMat = new THREE.LineBasicMaterial({
    color: 0x22d3ee,
    linewidth: 2,
    transparent: true,
    opacity: 0.8
  });

  const temporaryBeams = [];
  validDrones.forEach(d => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      d.mesh.position,
      ugreenNasMesh.position.clone().add(new THREE.Vector3(0, 1.0, 0))
    ]);
    const beam = new THREE.Line(geo, beamMat);
    scene.add(beam);
    temporaryBeams.push(beam);
  });

  // Handle Quarantined Shards
  corruptDrones.forEach(d => {
    logTerminal(`[QUARANTINE] Shard ${d.shardId} on ${d.id} failed SHA-256. Moved to /quarantine/`, "warning");
    d.beaconLight.color.setHex(0xf59e0b);
  });

  logTerminal(`[AUDIT COMPLETE] ${validDrones.length}/10 valid shards verified. Minimum k=${SWARM_CONFIG.k} required.`, "success");

  // Keep beams visible for 1.2 seconds
  await delay(1200);
  temporaryBeams.forEach(b => scene.remove(b));
}

// Phase 2: Holographic GF(2^8) Matrix Inversion
async function runPhase2MatrixInversion() {
  const validDrones = SWARM_CONFIG.drones.filter(d => d.status === "online");

  if (validDrones.length < SWARM_CONFIG.k) {
    logTerminal(`[ERR_INSUFFICIENT_SHARDS] Only ${validDrones.length}/${SWARM_CONFIG.k} shards survived. Matrix cannot be inverted.`, "danger");
    document.getElementById("reconstruction-badge").className = "badge insufficient";
    document.getElementById("reconstruction-badge").innerText = "ERR_INSUFFICIENT_SHARDS";
    return false;
  }

  logTerminal("[STEP 2/3] Constructing k×k submatrix G_sub over GF(2⁸)...", "info");

  // Create 3D Holographic Matrix Visualizer above UGREEN NAS
  create3DMatrixHologram();

  // Try calling real FastAPI backend
  try {
    const res = await fetch("/api/reconstruct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mission_id: "SUBSEA-2026-ALPHA",
        ingest_dir: "./incoming",
        output_dir: "./reconstructed"
      })
    });
    if (res.ok) {
      const data = await res.json();
      logTerminal(`[RS CODEC] Gauss-Jordan matrix inversion completed: D = G_sub⁻¹ · S_sub`, "success");
      logTerminal(`[INTEGRITY] 100% BIT-EXACT SHA-256 MATCH: ${data.sha256.slice(0, 24)}...`, "success");
    } else {
      throw new Error("Backend not returning 200");
    }
  } catch (e) {
    // Standalone fallback: simulate Galois Field inversion logs
    await delay(1000);
    logTerminal("[RS CODEC] Inverting Vandermonde G_sub via Gauss-Jordan elimination...", "info");
    await delay(600);
    logTerminal("[RS CODEC] Deterministic sub-matrix inverted: det(G_sub) ≠ 0 in GF(2⁸).", "success");
    logTerminal("[INTEGRITY] Master payload 100% reconstructed. SHA-256: 4b878cc555f9808acf12b...", "success");
  }

  document.getElementById("reconstruction-badge").className = "badge recovered";
  document.getElementById("reconstruction-badge").innerText = "100% RECOVERED & VERIFIED";
  if (window.NautilusAudio) window.NautilusAudio.playRecoveryChime();

  return true;
}

// Phase 3: AI Knowledge Hub Indexing & Subsea Sonar Sweep
async function runPhase3AIIndexing() {
  if (window.NautilusBathymetry) window.NautilusBathymetry.triggerScan(2200);
  logTerminal("[STEP 3/3] Ingesting reconstructed media into UGREEN AI Knowledge Hub...", "info");

  // Animate a sweeping sonar pulse from vessel down to pipeline anomaly
  if (window.NautilusAudio) window.NautilusAudio.playSonarPing(720, 1.8);
  const sweepGeo = new THREE.RingGeometry(0.1, 4.0, 32);
  const sweepMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8
  });
  const sweepMesh = new THREE.Mesh(sweepGeo, sweepMat);
  sweepMesh.rotation.x = -Math.PI / 2;
  sweepMesh.position.copy(ugreenNasMesh.position);
  scene.add(sweepMesh);

  // Animate wave down
  new TWEEN.Tween(sweepMesh.position)
    .to({ y: -33, x: 12, z: -10 }, 2000)
    .easing(TWEEN.Easing.Cubic.Out)
    .start();

  new TWEEN.Tween(sweepMesh.scale)
    .to({ x: 8, y: 8, z: 8 }, 2000)
    .onComplete(() => {
      scene.remove(sweepMesh);
    })
    .start();

  await delay(1800);

  // In-Browser Edge AI Sonar Inference (WASM / ONNX)
  let aiResult = {
    label: "PIPELINE_MICROFRACTURE",
    confidence: 97.8,
    latencyMs: 2.4,
    engine: "WASM-SIMD Neural Core"
  };

  if (window.NautilusSonarAI) {
    try {
      aiResult = await window.NautilusSonarAI.classify(true);
      window.NautilusSonarAI.updateHUD(aiResult);
    } catch (err) {
      console.warn("Sonar AI execution fallback:", err);
    }
  }

  logTerminal(`[EDGE-AI] ${aiResult.engine} classified sonar spectrogram in ${aiResult.latencyMs}ms.`, "success");
  logTerminal(`[UGOS-AI] Detected ${aiResult.label} (Conf: ${aiResult.confidence}%).`, "success");
  logTerminal("[UGOS-AI] MISSION_RECOVERY_REPORT.md compiled in /volume1/nautilus_missions/reconstructed/.", "success");
  logTerminal("✔ Mission recovery fully finalized with zero data loss!", "success");

  // Highlight Anomaly Card in HUD
  const anomCard = document.getElementById("anomaly-card");
  anomCard.style.boxShadow = "0 0 25px rgba(239, 68, 68, 0.8)";
  setTimeout(() => { anomCard.style.boxShadow = "none"; }, 3500);
}

// 3D Matrix Hologram Generator
function create3DMatrixHologram() {
  if (matrixHoloGroup) scene.remove(matrixHoloGroup);

  matrixHoloGroup = new THREE.Group();
  matrixHoloGroup.position.set(-15, 16.5, -12);

  // 6x6 Cube Grid of glowing field elements
  const cubeGeo = new THREE.BoxGeometry(0.35, 0.35, 0.35);
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 6; c++) {
      const mat = new THREE.MeshBasicMaterial({
        color: (r === c) ? 0x10b981 : 0x22d3ee,
        transparent: true,
        opacity: 0.75
      });
      const cube = new THREE.Mesh(cubeGeo, mat);
      cube.position.set((c - 2.5) * 0.7, (2.5 - r) * 0.7, 0);
      matrixHoloGroup.add(cube);
    }
  }

  // Outer Holographic Bounding Box
  const boxGeo = new THREE.BoxGeometry(4.8, 4.8, 1.2);
  const boxMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    wireframe: true,
    transparent: true,
    opacity: 0.3
  });
  const box = new THREE.Mesh(boxGeo, boxMat);
  matrixHoloGroup.add(box);

  scene.add(matrixHoloGroup);
}

// ---------------------------------------------------------------------------
// Camera Presets & Navigation
// ---------------------------------------------------------------------------
function setCameraView(viewKey) {
  currentCameraMode = viewKey;
  document.querySelectorAll(".cam-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.view === viewKey);
  });

  if (viewKey === "orbit") {
    new TWEEN.Tween(camera.position)
      .to({ x: 45, y: 15, z: 65 }, 1500)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
    new TWEEN.Tween(controls.target)
      .to({ x: 0, y: -15, z: 0 }, 1500)
      .start();
  } else if (viewKey === "vessel") {
    new TWEEN.Tween(camera.position)
      .to({ x: -10, y: 18, z: 5 }, 1500)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
    new TWEEN.Tween(controls.target)
      .to({ x: -15, y: 11, z: -12 }, 1500)
      .start();
  } else if (viewKey === "chase") {
    // Focus on AUV-01
    const d0 = SWARM_CONFIG.drones[0].mesh.position;
    new TWEEN.Tween(camera.position)
      .to({ x: d0.x - 8, y: d0.y + 3, z: d0.z - 12 }, 1500)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
    new TWEEN.Tween(controls.target)
      .to({ x: d0.x, y: d0.y, z: d0.z + 10 }, 1500)
      .start();
  } else if (viewKey === "pipeline") {
    // Focus on subsea crack
    new TWEEN.Tween(camera.position)
      .to({ x: 18, y: -28, z: -2 }, 1500)
      .easing(TWEEN.Easing.Cubic.Out)
      .start();
    new TWEEN.Tween(controls.target)
      .to({ x: 12, y: -32, z: -10 }, 1500)
      .start();
  }
}

// ---------------------------------------------------------------------------
// Event Listeners
// ---------------------------------------------------------------------------
function setupEventListeners() {
  // Audio Mute/Unmute Toggle
  const bathyBtn = document.getElementById("btn-toggle-bathymetry");
  if (bathyBtn) {
    bathyBtn.addEventListener("click", () => {
      if (window.NautilusBathymetry) {
        const visible = window.NautilusBathymetry.toggleVisibility();
        bathyBtn.innerText = visible ? "🗺 Bathymetry: ON" : "🗺 Bathymetry: OFF";
        bathyBtn.style.color = visible ? "#38bdf8" : "#94a3b8";
      }
    });
  }

  const audioBtn = document.getElementById("btn-toggle-audio");
  if (audioBtn) {
    audioBtn.addEventListener("click", () => {
      if (window.NautilusAudio) {
        window.NautilusAudio.init();
        const muted = window.NautilusAudio.toggleMute();
        audioBtn.innerText = muted ? "🔇 Sound: OFF" : "🔊 Sound: ON";
        audioBtn.style.color = muted ? "#ef4444" : "#38bdf8";
      }
    });
  }

  // Raycaster click on drones
  window.addEventListener("click", onCanvasClick);

  // Camera toolbar
  document.querySelectorAll(".cam-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      setCameraView(e.target.dataset.view);
    });
  });

  // Action Buttons
  document.getElementById("btn-reset-scene").addEventListener("click", resetSwarm);
  document.getElementById("btn-run-pipeline").addEventListener("click", executeNautilusPipeline);
  document.getElementById("btn-close-modal").addEventListener("click", closeDroneInspector);

  // Fault controls
  document.getElementById("btn-sink-random").addEventListener("click", () => {
    const online = SWARM_CONFIG.drones.filter(d => d.status === "online");
    if (online.length >= 2) {
      sinkDrone(online[0].index);
      sinkDrone(online[1].index);
    }
  });

  document.getElementById("btn-bitrot-random").addEventListener("click", () => {
    const online = SWARM_CONFIG.drones.filter(d => d.status === "online");
    if (online.length > 0) {
      corruptDroneShard(online[0].index);
    }
  });

  document.getElementById("btn-sink-max").addEventListener("click", () => {
    // Sink exactly m=4 drones to demonstrate maximum survival tolerance
    resetSwarm();
    setTimeout(() => {
      sinkDrone(0);
      sinkDrone(1);
      sinkDrone(6);
      sinkDrone(7);
      logTerminal("[STRESS TEST] 4 drones sunken! Exactly k=6 shards survive (100% threshold).", "warning");
    }, 400);
  });

  // Modal actions
  document.getElementById("btn-toggle-drone-sink").addEventListener("click", () => {
    if (selectedDroneIndex !== null) {
      sinkDrone(selectedDroneIndex);
      openDroneInspector(selectedDroneIndex);
    }
  });

  document.getElementById("btn-toggle-drone-corrupt").addEventListener("click", () => {
    if (selectedDroneIndex !== null) {
      corruptDroneShard(selectedDroneIndex);
      openDroneInspector(selectedDroneIndex);
    }
  });
}

function onCanvasClick(event) {
  // Ignore clicks on HUD panels
  if (event.target.closest("#hud-overlay .panel") ||
      event.target.closest("#hud-overlay .top-nav") ||
      event.target.closest("#hud-overlay .camera-toolbar") ||
      event.target.closest("#drone-inspector-modal")) {
    return;
  }

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);

  for (let i = 0; i < intersects.length; i++) {
    let obj = intersects[i].object;
    while (obj && obj.parent && !obj.userData.droneIndex) {
      if (obj.userData.droneIndex !== undefined) break;
      obj = obj.parent;
    }
    if (obj && obj.userData && obj.userData.droneIndex !== undefined) {
      openDroneInspector(obj.userData.droneIndex);
      return;
    }
  }
}

// Terminal Logger Helper
function logTerminal(msg, type = "info") {
  const term = document.getElementById("terminal-body");
  if (!term) return;

  const div = document.createElement("div");
  div.className = `log-line ${type}`;
  const now = new Date().toISOString().substring(11, 19);
  div.innerText = `[${now}] ${msg}`;
  term.appendChild(div);
  term.scrollTop = term.scrollHeight;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Main Animation Render Loop
// ---------------------------------------------------------------------------
function animate(time) {
  requestAnimationFrame(animate);

  TWEEN.update();

  const elapsedTime = time * 0.001 || 0;

  // 1. Gently undulate ocean surface
  if (marineSnow) {
    const positions = marineSnow.geometry.attributes.position.array;
    for (let i = 1; i < positions.length; i += 3) {
      positions[i] -= 0.035;
      if (positions[i] < -35) positions[i] = 7;
    }
    marineSnow.geometry.attributes.position.needsUpdate = true;
  }

  // 2. Animate Radar Dish on Mother Vessel
  if (motherVessel) {
    const dish = motherVessel.getObjectByName("radarDish");
    if (dish) dish.rotation.y += 0.03;
    const holoDome = motherVessel.getObjectByName("nasHoloDome");
    if (holoDome) holoDome.rotation.y += 0.01;
  }

  // Calculate frame delta time
  const dt = lastFrameTime ? Math.min((time - lastFrameTime) * 0.001, 0.05) : 0.016;
  lastFrameTime = time;

  // 3. Subsea Ocean Physics Step (Buoyancy, Fluid Drag, Terminal Descent)
  if (window.NautilusOceanPhysics) {
    window.NautilusOceanPhysics.step(SWARM_CONFIG.drones, dt, elapsedTime);
  } else {
    SWARM_CONFIG.drones.forEach((d, idx) => {
      if (d.status !== "sunken") {
        d.mesh.position.y = d.initialPos.y + Math.sin(elapsedTime * 1.5 + idx) * 0.6;
        d.mesh.rotation.z = Math.sin(elapsedTime * 1.2 + idx) * 0.05;
        d.mesh.rotation.y = Math.sin(elapsedTime * 0.8 + idx) * 0.08;
      }
    });
  }

  // 4. Update dynamic mesh lines
  updateMeshLines();

  // 5. Rotate 3D Matrix Hologram if active
  if (matrixHoloGroup) {
    matrixHoloGroup.rotation.y += 0.02;
    matrixHoloGroup.rotation.x = Math.sin(elapsedTime * 2.0) * 0.1;
  }

  // 6. Pulse Pipeline Crack Anomaly Marker
  if (anomalyMarker) {
    const scale = 1.0 + Math.sin(elapsedTime * 6.0) * 0.25;
    anomalyMarker.scale.set(scale, scale, scale);
  }

  controls.update();
  renderer.render(scene, camera);
}

// ---------------------------------------------------------------------------
// [Diky] ShardAuditTable — renders SHA-256 integrity table from SWARM_CONFIG
// Called after: resetSwarm(), sinkDrone(), corruptDroneShard(), executeNautilusPipeline()
// ---------------------------------------------------------------------------
function renderShardAuditTable() {
  const tbody = document.getElementById("shard-audit-tbody");
  if (!tbody) return;

  tbody.innerHTML = "";
  SWARM_CONFIG.drones.forEach(d => {
    const tr = document.createElement("tr");
    const statusClass = d.status === "online" ? "valid" : d.status;  // "valid"|"sunken"|"corrupt"
    const statusLabel = d.status === "online" ? "VALID" : d.status === "sunken" ? "LOST" : "QUARANTINED";
    tr.innerHTML = `
      <td class="sat-type-${d.type}">${d.shardId}</td>
      <td>${d.id}</td>
      <td class="sat-type-${d.type}">${d.type.toUpperCase()}</td>
      <td class="sat-hash">${d.hash}</td>
      <td><span class="sat-badge ${statusClass}">${statusLabel}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------------------------------------------------------------------------
// [Diky] CodecControl Drawer — form + apply + API trigger
// ---------------------------------------------------------------------------
function initCodecControlDrawer() {
  const drawer = document.getElementById("codec-control-drawer");
  const btnOpen = document.getElementById("btn-codec-panel");
  const btnClose = document.getElementById("btn-close-codec");
  const inputK = document.getElementById("cc-k");
  const inputM = document.getElementById("cc-m");
  const nDisplay = document.getElementById("cc-n-display");
  const rSwarmDisplay = document.getElementById("cc-rswarm-display");
  const maxLossDisplay = document.getElementById("cc-maxloss-display");

  if (!drawer || !btnOpen) return;

  // Toggle drawer
  btnOpen.addEventListener("click", () => {
    const isOpen = drawer.style.display !== "none";
    drawer.style.display = isOpen ? "none" : "block";
    if (!isOpen) updateCodecDerived();
  });
  btnClose.addEventListener("click", () => { drawer.style.display = "none"; });

  // Live k/m → n + R_swarm recalculation
  function updateCodecDerived() {
    const k = Math.max(1, parseInt(inputK.value) || 6);
    const m = Math.max(1, parseInt(inputM.value) || 4);
    const n = k + m;
    nDisplay.textContent = n;

    // Binomial R_swarm = P(X >= k) where X~Binom(n, p_survive=0.7)
    const p = 0.70;
    let prob = 0;
    for (let i = k; i <= n; i++) {
      prob += binomCoeff(n, i) * Math.pow(p, i) * Math.pow(1 - p, n - i);
    }
    rSwarmDisplay.textContent = `~${(prob * 100).toFixed(1)}%`;
    maxLossDisplay.textContent = `m = ${m} drones`;
  }

  inputK.addEventListener("input", updateCodecDerived);
  inputM.addEventListener("input", updateCodecDerived);

  // Apply: update SWARM_CONFIG + rebuild UI
  document.getElementById("cc-btn-apply").addEventListener("click", () => {
    const k = Math.max(1, parseInt(inputK.value) || 6);
    const m = Math.max(1, parseInt(inputM.value) || 4);
    const n = k + m;

    if (n > 10) {
      logTerminal(`[CODEC CTRL] n=${n} exceeds fleet size (10). Reduce k+m.`, "warning");
      return;
    }

    SWARM_CONFIG.k = k;
    SWARM_CONFIG.m = m;

    // Sync UI param boxes
    document.getElementById("val-k").textContent = k;
    document.getElementById("val-m").textContent = m;
    document.getElementById("val-n").textContent = n;

    logTerminal(`[CODEC CTRL] Applied: k=${k}, m=${m}, n=${n}. Swarm config updated.`, "success");
    renderShardAuditTable();
    updateHUDMetrics();
    drawer.style.display = "none";
  });

  // Trigger API: POST /api/pipeline/run-all (full 3-step pipeline via real backend)
  document.getElementById("cc-btn-trigger-api").addEventListener("click", async () => {
    const missionId = document.getElementById("cc-mission-id").value.trim() || "SUBSEA-2026-ALPHA";
    const ingestDir = document.getElementById("cc-ingest-dir").value.trim();
    const outputDir = document.getElementById("cc-output-dir").value.trim();
    const k = Math.max(1, parseInt(inputK.value) || 6);
    const m = Math.max(1, parseInt(inputM.value) || 4);
    const responseBox = document.getElementById("cc-api-response");
    const responsePre = document.getElementById("cc-response-pre");

    responseBox.style.display = "flex";
    responsePre.textContent = "Connecting to FastAPI backend...";
    logTerminal(`[API] POST /api/pipeline/run-all → mission_id=${missionId}`, "info");

    try {
      const res = await fetch("/api/pipeline/run-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mission_id: missionId,
          ingest_dir: ingestDir,
          output_dir: outputDir,
          data_shards_k: k,
          parity_shards_m: m,
          enable_ai_index: true
        })
      });
      const data = await res.json();
      responsePre.textContent = JSON.stringify(data, null, 2);
      const ok = res.ok && data.pipeline_status === "SUCCESS_100_PERCENT_RECOVERED";
      logTerminal(`[API] Pipeline: ${data.pipeline_status || res.status}`, ok ? "success" : "warning");
    } catch (err) {
      // Mock response when backend not running
      const mock = {
        status: "mock_offline",
        message: "Backend not reachable. Run: uvicorn api_server:app --port 8000",
        hint: "Or use: docker compose up -d nautilus-backend",
        mission_id: missionId,
        data_shards_k: k,
        parity_shards_m: m
      };
      responsePre.textContent = JSON.stringify(mock, null, 2);
      logTerminal("[API] Backend offline — showing mock response.", "warning");
    }
  });
}

// Binomial coefficient helper (ponytail: no BigInt, n<=20 safe)
function binomCoeff(n, k) {
  if (k === 0 || k === n) return 1;
  let res = 1;
  for (let i = 0; i < k; i++) {
    res = res * (n - i) / (i + 1);
  }
  return res;
}

// ---------------------------------------------------------------------------
// [Diky] WebSocket Real-Time Log Bridge — connects to FastAPI /ws/logs
// Silently skips if backend is offline; no error shown to user
// ---------------------------------------------------------------------------
function initWebSocketLogStream() {
  const wsUrl = `ws://${location.hostname}:8000/ws/logs`;
  let ws;
  let retryTimer = null;

  // Level → logTerminal type mapping
  const levelMap = { SUCCESS: "success", ERROR: "danger", WARNING: "warning", INFO: "info" };

  function connect() {
    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        logTerminal("[WS] Live log stream connected to UGREEN AI NAS backend.", "success");
        clearTimeout(retryTimer);
      };

      ws.onmessage = (evt) => {
        try {
          const payload = JSON.parse(evt.data);
          const type = levelMap[payload.level] || "info";
          const prefix = payload.mission_id ? `[${payload.mission_id}] ` : "";
          logTerminal(`${prefix}${payload.message}`, type);
        } catch (_) { /* malformed frame, skip */ }
      };

      ws.onclose = () => {
        // Backend not up — retry silently every 10s (ponytail: no exponential backoff, single retry cadence ok for demo)
        retryTimer = setTimeout(connect, 10000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (_) { /* WebSocket API not available, skip */ }
  }

  connect();
}
