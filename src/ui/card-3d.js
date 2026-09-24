/* =====================================================================
   Aqua Zero Heavens Arena - Tangible 3D Combat Cards & Foil Shaders
   Luminara Digital

   Brings physical 3D card combat to the arena:
     - 3D Fan layout with ergonomic radial curvature
     - 6-DOF hover physics (elevation, camera-facing tilt, and dynamic drop shadow)
     - Custom GLSL Holographic Foil Shader for Mastered & Infused cards
     - Play animation: card flips forward, arcs into the center ring, and
       dissolves upon technique impact
   ===================================================================== */

"use strict";

var Card3D = (function () {
  var CARD_WIDTH = 2.4;
  var CARD_HEIGHT = 3.6;
  var CARD_DEPTH = 0.04;

  /* -------------------------------------------------------------------
     Pure Math & Kinematics (testable in Node headless)
     ------------------------------------------------------------------- */
  function computeCardFanTransform(index, totalCards, hoveredIndex, playedProgress) {
    if (totalCards <= 0) return { x: 0, y: 0, z: 0, rotZ: 0, rotX: 0, scale: 1 };

    var center = (totalCards - 1) / 2;
    var offsetFromCenter = index - center;

    // Base fan arc
    var angleStep = Math.min(0.08, 0.35 / Math.max(1, totalCards));
    var rotZ = -offsetFromCenter * angleStep;
    var spacingX = Math.min(1.8, 8.0 / Math.max(1, totalCards));
    var x = offsetFromCenter * spacingX;
    var y = -4.2 - Math.abs(offsetFromCenter) * 0.15;
    var z = -offsetFromCenter * 0.05;
    var rotX = 0.18;
    var scale = 1.0;

    // Hover physics
    if (index === hoveredIndex) {
      y += 1.1;
      z += 0.8;
      rotZ *= 0.3;
      rotX = -0.05;
      scale = 1.12;
    }

    // Play launch animation (playedProgress: 0.0 to 1.0)
    if (typeof playedProgress === "number" && playedProgress > 0) {
      var t = Math.max(0, Math.min(1, playedProgress));
      x = x * (1 - t);
      y = y * (1 - t) + (2.5 * Math.sin(t * Math.PI));
      z = z * (1 - t) + (8.0 * t);
      rotX = rotX * (1 - t) + (Math.PI * 2 * t);
      scale = 1.12 * (1 - t * 0.35);
    }

    return {
      x: x,
      y: y,
      z: z,
      rotX: rotX,
      rotY: 0,
      rotZ: rotZ,
      scale: scale,
    };
  }

  function computeFoilIridescence(normalZ, viewZ) {
    // Dot product approximation for view-angle iridescence
    var dot = Math.abs(normalZ * viewZ);
    var hue = (1.0 - dot) * 360;
    return {
      hue: hue,
      intensity: Math.pow(1.0 - dot, 1.5),
    };
  }

  /* -------------------------------------------------------------------
     Shader & Material Generation
     ------------------------------------------------------------------- */
  function createFoilMaterial(THREE, baseTexture, isMastered, isInfused) {
    if (!THREE) return null;

    if (!isMastered && !isInfused) {
      return new THREE.MeshStandardMaterial({
        map: baseTexture,
        roughness: 0.4,
        metalness: 0.15,
      });
    }

    // Custom ShaderMaterial for Holographic Iridescence
    var uniforms = {
      baseTexture: { value: baseTexture },
      foilTint: { value: new THREE.Color(isInfused ? 0xe6392f : 0xf59e0b) },
      time: { value: 0 },
      isMastered: { value: isMastered ? 1.0 : 0.0 },
      isInfused: { value: isInfused ? 1.0 : 0.0 },
    };

    var vertexShader = [
      "varying vec2 vUv;",
      "varying vec3 vNormal;",
      "varying vec3 vViewPosition;",
      "void main() {",
      "  vUv = uv;",
      "  vNormal = normalize(normalMatrix * normal);",
      "  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);",
      "  vViewPosition = -mvPosition.xyz;",
      "  gl_Position = projectionMatrix * mvPosition;",
      "}"
    ].join("\n");

    var fragmentShader = [
      "uniform sampler2D baseTexture;",
      "uniform vec3 foilTint;",
      "uniform float time;",
      "uniform float isMastered;",
      "uniform float isInfused;",
      "varying vec2 vUv;",
      "varying vec3 vNormal;",
      "varying vec3 vViewPosition;",
      "void main() {",
      "  vec4 tex = texture2D(baseTexture, vUv);",
      "  vec3 normal = normalize(vNormal);",
      "  vec3 viewDir = normalize(vViewPosition);",
      "  float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 2.2);",
      "  vec3 rainbow = 0.5 + 0.5 * cos(vec3(0.0, 2.0, 4.0) + (fresnel * 6.28 + vUv.x * 2.0 + time * 0.5));",
      "  vec3 foilColor = mix(rainbow, foilTint, 0.45);",
      "  vec3 finalRgb = tex.rgb + foilColor * fresnel * 0.75;",
      "  gl_FragColor = vec4(finalRgb, tex.a);",
      "}"
    ].join("\n");

    return new THREE.ShaderMaterial({
      uniforms: uniforms,
      vertexShader: vertexShader,
      fragmentShader: fragmentShader,
      transparent: true,
    });
  }

  function createCardMesh(THREE, frontMat, backMat) {
    if (!THREE) return null;
    var cardGeo = new THREE.BoxGeometry(CARD_WIDTH, CARD_HEIGHT, CARD_DEPTH);
    var edgeMat = new THREE.MeshStandardMaterial({ color: 0x1a1d26, metalness: 0.8, roughness: 0.2 });

    // Materials order: +X, -X, +Y, -Y, +Z (Front), -Z (Back)
    var materials = [
      edgeMat, edgeMat, edgeMat, edgeMat,
      frontMat, backMat || edgeMat,
    ];

    var mesh = new THREE.Mesh(cardGeo, materials);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /* -------------------------------------------------------------------
     3D Card Hand Synchronization & Animation
     ------------------------------------------------------------------- */
  var handGroup = null;
  var cardMeshes = [];
  var DISC_COLORS = {
    BOXING: 0xef4444,
    KICKBOXING: 0xf59e0b,
    MUAY_THAI: 0xe6392f,
    JUDO: 0x38bdf8,
    WRESTLING: 0x10b981,
    BJJ: 0xa855f7,
    KARATE: 0xec4899,
    MMA: 0x22d3ee,
  };

  function initHand(THREE, scene) {
    if (!THREE || !scene || handGroup) return;
    handGroup = new THREE.Group();
    // Positioned in lower foreground relative to arena
    handGroup.position.set(0, -3.2, 13.5);
    cardMeshes = [];

    for (var i = 0; i < 6; i++) {
      var faceMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.35,
        metalness: 0.3,
      });
      var card = createCardMesh(THREE, faceMat);
      card.visible = false;
      handGroup.add(card);
      cardMeshes.push(card);
    }
    scene.add(handGroup);
  }

  function syncHand(THREE, scene, techs, selectedIdx, hoveredIdx, isExecuting, execProg) {
    if (!THREE || !scene) return;
    if (!handGroup) initHand(THREE, scene);
    if (!techs || !techs.length) {
      if (handGroup) handGroup.visible = false;
      return;
    }
    handGroup.visible = true;
    var count = Math.min(6, techs.length);

    for (var i = 0; i < cardMeshes.length; i++) {
      var mesh = cardMeshes[i];
      if (i < count) {
        mesh.visible = true;
        var tq = techs[i];
        var isPlayed = (isExecuting && i === selectedIdx);
        var prog = isPlayed ? (execProg || 0) : 0;
        var activeHover = isExecuting ? -1 : (hoveredIdx >= 0 ? hoveredIdx : selectedIdx);
        var tf = computeCardFanTransform(i, count, activeHover, prog);

        mesh.position.x = tf.x;
        mesh.position.y = tf.y;
        mesh.position.z = tf.z;
        mesh.rotation.x = tf.rotX;
        mesh.rotation.y = tf.rotY;
        mesh.rotation.z = tf.rotZ;
        mesh.scale.set(tf.scale, tf.scale, tf.scale);

        // Update face color by discipline
        if (mesh.material && mesh.material[4] && tq) {
          var isM = false;
          if (typeof SAVE !== "undefined" && typeof discMasteryLevel === "function" && tq.disc) {
            isM = discMasteryLevel(SAVE, tq.disc) >= 5;
          }
          var discCol = isM ? 0xf59e0b : (DISC_COLORS[tq.disc] || 0x38bdf8);
          if (mesh.material[4].color) {
            mesh.material[4].color.setHex(discCol);
          }
        }
      } else {
        mesh.visible = false;
      }
    }
  }

  function hideHand() {
    if (handGroup) handGroup.visible = false;
  }

  function getHandGroup() {
    return handGroup;
  }

  return {
    computeCardFanTransform: computeCardFanTransform,
    computeFoilIridescence: computeFoilIridescence,
    createFoilMaterial: createFoilMaterial,
    createCardMesh: createCardMesh,
    initHand: initHand,
    syncHand: syncHand,
    hideHand: hideHand,
    getHandGroup: getHandGroup,
    CARD_WIDTH: CARD_WIDTH,
    CARD_HEIGHT: CARD_HEIGHT,
    CARD_DEPTH: CARD_DEPTH,
  };
})();

if (typeof module !== "undefined" && module.exports) {
  module.exports = Card3D;
}
