/* =====================================================================
   Aqua Zero Heavens Arena - 3D Trophy Room & Tower Spire Diorama
   Luminara Digital

   Provides interactive 3D showcase elements:
     - 3D Championship Belts, Trophies, and Medals with PBR gold materials
     - Interactive 360-degree orbit drag inspection
     - 3D Heavens Tower Spire diorama with floor-to-floor camera travel
   ===================================================================== */

"use strict";

var Trophy3D = (function () {
  var trophyMesh = null;
  var currentRotationY = 0;
  var targetRotationY = 0;
  var isDragging = false;
  var lastPointerX = 0;

  /* -------------------------------------------------------------------
     Pure Math & Kinematics (testable in Node headless)
     ------------------------------------------------------------------- */
  function computeTrophyRotation(currentY, targetY, dt) {
    var damp = Math.min(1.0, dt * 8.0);
    return currentY + (targetY - currentY) * damp;
  }

  function computeTowerFloorElevation(floorNumber, maxFloors) {
    floorNumber = Math.max(1, Math.min(maxFloors || 100, floorNumber));
    var floorHeight = 1.4;
    return (floorNumber - 1) * floorHeight;
  }

  function computeTowerCameraFraming(currentFloor, targetFloor, t) {
    var fromY = computeTowerFloorElevation(currentFloor);
    var toY = computeTowerFloorElevation(targetFloor);
    var interpY = fromY + (toY - fromY) * Math.max(0, Math.min(1, t));
    return {
      camY: interpY + 4.5,
      camRadius: 18.0,
      lookAtY: interpY + 1.2,
    };
  }

  /* -------------------------------------------------------------------
     3D Geometry Builders
     ------------------------------------------------------------------- */
  function buildBeltGeometry(THREE) {
    if (!THREE) return null;
    var group = new THREE.Group();

    // 1. Leather Strap (curved arc)
    var strapGeo = new THREE.CylinderGeometry(4.2, 4.2, 1.8, 32, 1, true, -Math.PI / 3, (2 * Math.PI) / 3);
    var strapMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    var strapMesh = new THREE.Mesh(strapGeo, strapMat);
    group.add(strapMesh);

    // 2. Gold Centerplate
    var plateGeo = new THREE.BoxGeometry(2.4, 2.0, 0.18);
    var goldMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      roughness: 0.25,
      metalness: 0.85,
    });
    var plateMesh = new THREE.Mesh(plateGeo, goldMat);
    plateMesh.position.set(0, 0, 4.22);
    plateMesh.castShadow = true;
    group.add(plateMesh);

    // 3. Side Plates
    var sideGeo = new THREE.BoxGeometry(1.0, 1.2, 0.12);
    var sideL = new THREE.Mesh(sideGeo, goldMat);
    sideL.position.set(-2.0, 0, 3.8);
    sideL.rotation.y = Math.PI / 8;
    group.add(sideL);

    var sideR = new THREE.Mesh(sideGeo, goldMat);
    sideR.position.set(2.0, 0, 3.8);
    sideR.rotation.y = -Math.PI / 8;
    group.add(sideR);

    trophyMesh = group;
    return group;
  }

  function setMesh(mesh) {
    trophyMesh = mesh;
  }

  function onPointerDown(clientX) {
    isDragging = true;
    lastPointerX = clientX;
  }

  function onPointerMove(clientX) {
    if (!isDragging) return;
    var dx = clientX - lastPointerX;
    targetRotationY += dx * 0.01;
    lastPointerX = clientX;
  }

  function onPointerUp() {
    isDragging = false;
  }

  function step(dt) {
    currentRotationY = computeTrophyRotation(currentRotationY, targetRotationY, dt);
    if (!isDragging) {
      // Gentle idle spin
      targetRotationY += dt * 0.25;
    }
    if (trophyMesh) {
      trophyMesh.rotation.y = currentRotationY;
    }
  }

  return {
    computeTrophyRotation: computeTrophyRotation,
    computeTowerFloorElevation: computeTowerFloorElevation,
    computeTowerCameraFraming: computeTowerCameraFraming,
    buildBeltGeometry: buildBeltGeometry,
    setMesh: setMesh,
    getMesh: function () { return trophyMesh; },
    onPointerDown: onPointerDown,
    onPointerMove: onPointerMove,
    onPointerUp: onPointerUp,
    step: step,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Trophy3D;
}
