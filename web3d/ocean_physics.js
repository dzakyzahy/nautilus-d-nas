/**
 * Nautilus D-NAS — Subsea Ocean Hydrodynamics Physics Engine
 * Simulates deep-sea buoyancy equilibrium, hydrodynamic quadratic fluid drag,
 * hull-breach flooding mass shift, nose-down pitch torque, and terminal trench descent.
 */

(function () {
  const RHO_SEAWATER = 1025.0; // kg/m^3 (Deep ocean salinity)
  const GRAVITY = -9.81;       // m/s^2
  const SEABED_Y = -46.5;      // Seabed trench floor coordinate

  // Physics state per drone
  const physicsStates = new Map();

  function initDronePhysics(drone) {
    physicsStates.set(drone.index, {
      mass: 85.0,              // kg nominal
      volume: 0.0829,          // m^3 (neutral buoyancy displacement)
      velocity: new THREE.Vector3(0, 0, 0),
      angularVelocity: 0,      // pitch rate rad/s
      pitch: 0,                // radians
      targetY: drone.initialPos.y,
      isSinking: false,
      isReviving: false,
      restedOnSeabed: false
    });
  }

  function onSinkFault(droneIndex) {
    let state = physicsStates.get(droneIndex);
    if (!state) return;
    state.isSinking = true;
    state.isReviving = false;
    state.mass = 145.0; // Flooded battery compartment / hull breach
    state.restedOnSeabed = false;
  }

  function onRevive(droneIndex, targetY) {
    let state = physicsStates.get(droneIndex);
    if (!state) return;
    state.isSinking = false;
    state.isReviving = true;
    state.mass = 85.0; // Water purged via emergency compressed air ballast
    state.targetY = targetY;
    state.restedOnSeabed = false;
  }

  /**
   * Numerical fluid dynamics integration step.
   * Called every frame from Three.js animate() loop.
   */
  function updatePhysics(drones, dt, elapsedTime) {
    if (!drones || drones.length === 0) return;

    // Clamp dt to avoid physics explosion on background tab throttling
    const clampedDt = Math.min(Math.max(dt, 0.001), 0.05);

    drones.forEach((drone) => {
      if (!physicsStates.has(drone.index)) {
        initDronePhysics(drone);
      }

      const p = physicsStates.get(drone.index);
      const mesh = drone.mesh;
      if (!mesh) return;

      if (drone.status === "sunken") {
        if (!p.restedOnSeabed) {
          // Buoyancy force Fb = rho * V * g (upward)
          const Fb = RHO_SEAWATER * p.volume * Math.abs(GRAVITY);
          // Gravity weight Fg = m * g (downward)
          const Fg = p.mass * GRAVITY;
          // Net vertical force
          let FnetY = Fb + Fg; // Negative (sinking)

          // Fluid quadratic drag: Fd = 0.5 * Cd * rho * A * v^2
          const Cd = 0.25; // Drag coefficient
          const Area = 0.12; // Frontal area
          const dragY = -0.5 * Cd * RHO_SEAWATER * Area * p.velocity.y * Math.abs(p.velocity.y);

          // Acceleration
          const aY = (FnetY + dragY) / p.mass;
          p.velocity.y += aY * clampedDt;

          // Terminal descent velocity clamp (-3.4 m/s)
          p.velocity.y = Math.max(p.velocity.y, -4.5);

          // Update position
          mesh.position.y += p.velocity.y * clampedDt * 2.8;

          // Asymmetric nose-heavy ballast induces negative pitch torque (pitch-down)
          const targetPitch = -0.65; // ~ -37 degrees nose down
          p.pitch += (targetPitch - p.pitch) * (clampedDt * 2.5);
          mesh.rotation.z = p.pitch;

          // Seabed collision detection
          if (mesh.position.y <= SEABED_Y) {
            mesh.position.y = SEABED_Y;
            p.velocity.set(0, 0, 0);
            p.pitch = -0.08; // Settles flat on oceanic sediment
            mesh.rotation.z = p.pitch;
            p.restedOnSeabed = true;
          }
        }
      } else if (p.isReviving) {
        // Thrusters produce upward thrust overcoming gravity
        const dy = p.targetY - mesh.position.y;
        if (Math.abs(dy) > 0.1) {
          mesh.position.y += dy * clampedDt * 2.0;
          p.pitch += (0.15 - p.pitch) * (clampedDt * 3.0); // Nose up during ascent
          mesh.rotation.z = p.pitch;
        } else {
          mesh.position.y = p.targetY;
          p.isReviving = false;
          p.pitch = 0;
          mesh.rotation.z = 0;
        }
      } else {
        // Natural neutral buoyancy equilibrium: hover & gentle tidal currents
        const hoverOffsetY = Math.sin(elapsedTime * 1.4 + drone.index) * 0.5;
        const currentDriftX = Math.cos(elapsedTime * 0.8 + drone.index) * 0.15;

        mesh.position.y = drone.initialPos.y + hoverOffsetY;
        mesh.rotation.z = Math.sin(elapsedTime * 1.1 + drone.index) * 0.04;
        mesh.rotation.y = Math.sin(elapsedTime * 0.7 + drone.index) * 0.06;

        // Sonar beam pulse scale
        if (drone.sonarCone) {
          const pulse = 1.0 + Math.sin(elapsedTime * 3.5 + drone.index) * 0.12;
          drone.sonarCone.scale.set(pulse, pulse, pulse);
        }
      }
    });
  }

  // Expose Ocean Physics API
  window.NautilusOceanPhysics = {
    init: initDronePhysics,
    sink: onSinkFault,
    revive: onRevive,
    step: updatePhysics
  };
})();
