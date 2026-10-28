/**
 * Nautilus D-NAS — Subsea Bathymetric Sonar Point Cloud Engine
 * Generates a high-density 3D depth-colormap point cloud for subsea pipeline inspection.
 * Multibeam echosounder false-color visualization:
 * - Abyssal Seabed (-35m to -33m): Deep Cyan / Navy Blue
 * - Pipeline Elevation (-33m to -31.8m): Emerald Green / Chartreuse
 * - Crack Hazard Anomaly Zone: Glowing Crimson Red with pulsing scan animation
 */

(function () {
  let pointCloud = null;
  let pointGeometry = null;
  let pointMaterial = null;
  let originalPositions = null;
  let originalColors = null;
  let isScanning = false;

  const ANOMALY_CENTER = new THREE.Vector3(12, -31.8, -10);
  const ANOMALY_RADIUS = 5.2;

  function init(targetScene) {
    if (pointCloud || !targetScene || typeof THREE === "undefined") return;

    const xMin = -12, xMax = 36, xStep = 0.9;
    const zMin = -65, zMax = 45, zStep = 0.9;

    const positions = [];
    const colors = [];

    const deepBlue = new THREE.Color(0x0284c7);
    const midCyan = new THREE.Color(0x06b6d4);
    const pipeGreen = new THREE.Color(0x10b981);
    const pipeYellow = new THREE.Color(0xeab308);
    const hazardRed = new THREE.Color(0xef4444);
    const hazardOrange = new THREE.Color(0xf97316);

    for (let x = xMin; x <= xMax; x += xStep) {
      for (let z = zMin; z <= zMax; z += zStep) {
        // 1. Base Seabed Topography
        let y = -35 + Math.sin(x * 0.05) * 2.5 + Math.cos(z * 0.04) * 2.0 + Math.sin((x + z) * 0.02) * 2.5;

        // 2. Pipeline Geometry Influence (Pipeline centered at X=12, Y=-33.2, Radius 1.4)
        const dx = Math.abs(x - 12);
        if (dx < 1.45) {
          const pipeH = -33.2 + Math.sqrt(Math.max(0, 1.45 * 1.45 - dx * dx));
          y = Math.max(y, pipeH);
        }

        // 3. Saddle Support Flanges (every 20m along Z from -60 to 60)
        const nearestFlange = Math.round(z / 20) * 20;
        if (Math.abs(z - nearestFlange) < 0.9 && dx < 1.85) {
          y = Math.max(y, -32.4);
        }

        // 4. Anomaly Fracture Pit at (12, -10)
        const distToAnomaly = Math.hypot(x - ANOMALY_CENTER.x, z - ANOMALY_CENTER.z);
        if (distToAnomaly < 1.8) {
          y -= 0.6; // crack depression
        }

        positions.push(x, y, z);

        // 5. False-Color Bathymetric Depth Map
        const c = new THREE.Color();
        if (distToAnomaly < ANOMALY_RADIUS) {
          // Anomaly Hazard Hotspot (Red / Orange gradient)
          const hazardT = 1.0 - (distToAnomaly / ANOMALY_RADIUS);
          c.lerpColors(hazardOrange, hazardRed, hazardT);
        } else if (dx < 1.8) {
          // Pipeline Surface (Emerald Green to Yellow)
          const elevT = THREE.MathUtils.clamp((y - (-33.2)) / 1.5, 0, 1);
          c.lerpColors(pipeGreen, pipeYellow, elevT);
        } else {
          // Seabed Depth Gradient (Deep Blue to Cyan)
          const depthT = THREE.MathUtils.clamp((y - (-37.5)) / 5.0, 0, 1);
          c.lerpColors(deepBlue, midCyan, depthT);
        }

        colors.push(c.r, c.g, c.b);
      }
    }

    pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    pointGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));

    originalPositions = new Float32Array(positions);
    originalColors = new Float32Array(colors);

    pointMaterial = new THREE.PointsMaterial({
      size: 0.52,
      vertexColors: true,
      transparent: true,
      opacity: 0.35, // Idle baseline survey visibility
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    pointCloud = new THREE.Points(pointGeometry, pointMaterial);
    pointCloud.name = "bathymetricPointCloud";
    targetScene.add(pointCloud);

    console.log(`[NautilusBathymetry] Point cloud initialized: ${positions.length / 3} survey sounding points.`);
  }

  function triggerScan(duration = 2400) {
    if (!pointCloud || isScanning) return;
    isScanning = true;

    // Pulse opacity during active acoustic sweep
    new TWEEN.Tween(pointMaterial)
      .to({ opacity: 0.95 }, duration * 0.4)
      .easing(TWEEN.Easing.Quadratic.Out)
      .onComplete(() => {
        new TWEEN.Tween(pointMaterial)
          .to({ opacity: 0.70 }, duration * 0.6)
          .easing(TWEEN.Easing.Quadratic.In)
          .onComplete(() => {
            isScanning = false;
          })
          .start();
      })
      .start();

    // Animate wave scan pulse propagating across point cloud
    const posAttr = pointGeometry.attributes.position;
    const colAttr = pointGeometry.attributes.color;
    const count = posAttr.count;

    const scanData = { sweepProgress: -65.0 };

    new TWEEN.Tween(scanData)
      .to({ sweepProgress: 45.0 }, duration)
      .easing(TWEEN.Easing.Cubic.Out)
      .onUpdate(() => {
        const sweepZ = scanData.sweepProgress;
        for (let i = 0; i < count; i++) {
          const z = originalPositions[i * 3 + 2];
          const distZ = Math.abs(z - sweepZ);

          if (distZ < 7.0) {
            // Brighten wave crest
            const glow = (1.0 - distZ / 7.0) * 0.6;
            colAttr.array[i * 3] = Math.min(1.0, originalColors[i * 3] + glow);
            colAttr.array[i * 3 + 1] = Math.min(1.0, originalColors[i * 3 + 1] + glow);
            colAttr.array[i * 3 + 2] = Math.min(1.0, originalColors[i * 3 + 2] + glow);
          } else {
            colAttr.array[i * 3] = originalColors[i * 3];
            colAttr.array[i * 3 + 1] = originalColors[i * 3 + 1];
            colAttr.array[i * 3 + 2] = originalColors[i * 3 + 2];
          }
        }
        colAttr.needsUpdate = true;
      })
      .onComplete(() => {
        // Reset colors
        for (let i = 0; i < colAttr.array.length; i++) {
          colAttr.array[i] = originalColors[i];
        }
        colAttr.needsUpdate = true;
      })
      .start();
  }

  function reset() {
    if (pointMaterial) {
      pointMaterial.opacity = 0.35;
    }
  }

  function toggleVisibility() {
    if (pointCloud) {
      pointCloud.visible = !pointCloud.visible;
      return pointCloud.visible;
    }
    return false;
  }

  window.NautilusBathymetry = {
    init,
    triggerScan,
    reset,
    toggleVisibility
  };
})();
