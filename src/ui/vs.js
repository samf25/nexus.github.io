import { regionSymbolKeys, symbolSpecForKey } from "../core/symbology.js";

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function easeInOutCubic(value) {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(start, end, t) {
  return Number(start) + (Number(end) - Number(start)) * clamp01(t);
}

function seededUnit(seed) {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function randomRange(seed, min, max) {
  return min + (max - min) * seededUnit(seed);
}

function keyframeValue(progress, keyframes) {
  const frames = Array.isArray(keyframes) ? keyframes : [];
  if (!frames.length) {
    return 0;
  }
  const t = clamp01(progress);
  if (t <= frames[0][0]) {
    return frames[0][1];
  }
  for (let index = 1; index < frames.length; index += 1) {
    const [stop, value] = frames[index];
    const [prevStop, prevValue] = frames[index - 1];
    if (t <= stop) {
      const span = Math.max(0.0001, stop - prevStop);
      return lerp(prevValue, value, (t - prevStop) / span);
    }
  }
  return frames[frames.length - 1][1];
}

function wrapHue(hue) {
  const value = Number(hue) || 0;
  return ((value % 360) + 360) % 360;
}

function lerpPoint(a, b, t) {
  return {
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  };
}

function cubicBezierPoint(p0, p1, p2, p3, t) {
  const oneMinus = 1 - t;
  const oneMinus2 = oneMinus * oneMinus;
  const oneMinus3 = oneMinus2 * oneMinus;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: p0.x * oneMinus3 + 3 * p1.x * oneMinus2 * t + 3 * p2.x * oneMinus * t2 + p3.x * t3,
    y: p0.y * oneMinus3 + 3 * p1.y * oneMinus2 * t + 3 * p2.y * oneMinus * t2 + p3.y * t3,
    z: p0.z * oneMinus3 + 3 * p1.z * oneMinus2 * t + 3 * p2.z * oneMinus * t2 + p3.z * t3,
  };
}

function sampleBezierCurve(p0, p1, p2, p3, count = 72) {
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const t = count <= 1 ? 0 : index / (count - 1);
    points.push(cubicBezierPoint(p0, p1, p2, p3, t));
  }
  return points;
}

function rotatePoint(point, rotY, rotX) {
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);

  const x1 = point.x * cosY - point.z * sinY;
  const z1 = point.x * sinY + point.z * cosY;
  const y1 = point.y;

  const y2 = y1 * cosX - z1 * sinX;
  const z2 = y1 * sinX + z1 * cosX;
  return { x: x1, y: y2, z: z2 };
}

function projectPoint(point, width, height, scale, depth) {
  const z = point.z + depth;
  const inv = z > 0.001 ? 1 / z : 1;
  return {
    x: width * 0.5 + point.x * scale * inv,
    y: height * 0.5 + point.y * scale * inv,
    visible: z > 0.2,
  };
}

const LEAF_TOP_Y = -2.12;
const LEAF_BOTTOM_Y = 1.98;
const LEAF_CORE_U = 0.56;
const LEAF_Z_OFFSET = -1.55;

function leafYForU(u) {
  return lerp(LEAF_TOP_Y, LEAF_BOTTOM_Y, clamp01(u));
}

function leafHalfWidth(u, scale = 1.34) {
  const t = clamp01(u);
  const bell = Math.pow(Math.sin(Math.PI * t), 0.8);
  const asymmetry = 0.62 + 0.58 * Math.pow(t, 0.92);
  const topPinch = 1 - 0.34 * Math.pow(1 - t, 1.6);
  return bell * asymmetry * topPinch * scale;
}

function leafSurfaceZ(u, v) {
  const t = clamp01(u);
  const side = Math.max(0, 1 - Math.abs(v));
  const centerLift = Math.pow(Math.sin(Math.PI * t), 1.12) * 0.23;
  const rib = centerLift * (0.3 + 0.7 * side);
  const slope = (t - LEAF_CORE_U) * 0.06;
  return LEAF_Z_OFFSET + rib + slope;
}

function leafPointForUV(u, v, options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const scale = Number.isFinite(Number(opts.scale)) ? Number(opts.scale) : 1;
  const edgeLift = Number.isFinite(Number(opts.edgeLift)) ? Number(opts.edgeLift) : 0;
  const zShift = Number.isFinite(Number(opts.zShift)) ? Number(opts.zShift) : 0;
  const t = clamp01(u);
  const vv = Number(v) || 0;
  const halfWidth = leafHalfWidth(t, 1.36 * scale);
  const x = halfWidth * vv;
  const y = leafYForU(t);
  const z = leafSurfaceZ(t, Math.max(-1, Math.min(1, vv))) + edgeLift + zShift - Math.max(0, Math.abs(vv) - 1) * 0.045;
  return { x, y, z };
}

function cubicBezierUvPoint(p0, p1, p2, p3, t) {
  const oneMinus = 1 - t;
  const oneMinus2 = oneMinus * oneMinus;
  const oneMinus3 = oneMinus2 * oneMinus;
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    u: p0.u * oneMinus3 + 3 * p1.u * oneMinus2 * t + 3 * p2.u * oneMinus * t2 + p3.u * t3,
    v: p0.v * oneMinus3 + 3 * p1.v * oneMinus2 * t + 3 * p2.v * oneMinus * t2 + p3.v * t3,
  };
}

function sampleLeafBezierByUv(p0, p1, p2, p3, count = 72, options = {}) {
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const t = count <= 1 ? 0 : index / (count - 1);
    const uv = cubicBezierUvPoint(p0, p1, p2, p3, t);
    points.push(leafPointForUV(uv.u, uv.v, options));
  }
  return points;
}

function buildLeafEdgeLine(side, count = 176, vScale = 1, edgeLift = 0) {
  const points = [];
  for (let index = 0; index < count; index += 1) {
    const u = count <= 1 ? 0 : index / (count - 1);
    points.push(leafPointForUV(u, side * vScale, { edgeLift }));
  }
  return points;
}

function buildLeafPerimeterLoop(vScale = 1.08, edgeLift = 0.05, sampleCount = 220) {
  const edgeCount = Math.max(12, Math.floor(sampleCount / 2));
  const left = buildLeafEdgeLine(-1, edgeCount, vScale, edgeLift);
  const right = buildLeafEdgeLine(1, edgeCount, vScale, edgeLift).reverse();
  return [...left, ...right];
}

function buildFlowLineFromCore(endU, endV, controlNear = 0.35, controlFar = 0.82, count = 104) {
  const start = { u: LEAF_CORE_U, v: 0 };
  const p1 = {
    u: lerp(LEAF_CORE_U, endU, 0.32),
    v: endV * controlNear,
  };
  const p2 = {
    u: lerp(LEAF_CORE_U, endU, 0.74),
    v: endV * controlFar,
  };
  const end = { u: endU, v: endV };
  return sampleLeafBezierByUv(start, p1, p2, end, count, { edgeLift: 0.01 });
}

function buildLeafGuideSet() {
  const leftEdge = buildLeafEdgeLine(-1, 188, 1, 0.008);
  const rightEdge = buildLeafEdgeLine(1, 188, 1, 0.008);
  const spine = sampleLeafBezierByUv(
    { u: 0, v: 0 },
    { u: 0.24, v: 0 },
    { u: 0.82, v: 0 },
    { u: 1, v: 0 },
    138,
    { edgeLift: 0.025 },
  );

  // Match the card motif count: 6 curved flow lines in the upper half, 4 in the lower half.
  const topFlowDefs = [
    { u: 0.08, v: 1, near: 0.26, far: 0.78 },
    { u: 0.16, v: 1, near: 0.34, far: 0.86 },
    { u: 0.26, v: 1, near: 0.43, far: 0.94 },
  ];
  const middleTopFlowDefs = [
    { u: 0.36, v: 1, near: 0.1, far: 0.24 },
    { u: 0.46, v: 1, near: 0.11, far: 0.26 },
  ];
  const middleBottomFlowDefs = [
    { u: 0.66, v: 1, near: 0.1, far: 0.24 },
    { u: 0.76, v: 1, near: 0.11, far: 0.26 },
  ];
  const bottomFlowDefs = [
    { u: 0.82, v: 1, near: 0.34, far: 0.82 },
    { u: 0.93, v: 1, near: 0.42, far: 0.93 },
  ];
  const topFlows = topFlowDefs.flatMap((def) => [
    buildFlowLineFromCore(def.u, -def.v, def.near, def.far, 112),
    buildFlowLineFromCore(def.u, def.v, def.near, def.far, 112),
  ]);
  const middleTopFlows = middleTopFlowDefs.flatMap((def) => [
    buildFlowLineFromCore(def.u, -def.v, def.near, def.far, 108),
    buildFlowLineFromCore(def.u, def.v, def.near, def.far, 108),
  ]);
  const middleBottomFlows = middleBottomFlowDefs.flatMap((def) => [
    buildFlowLineFromCore(def.u, -def.v, def.near, def.far, 108),
    buildFlowLineFromCore(def.u, def.v, def.near, def.far, 108),
  ]);
  const bottomFlows = bottomFlowDefs.flatMap((def) => [
    buildFlowLineFromCore(def.u, -def.v, def.near, def.far, 112),
    buildFlowLineFromCore(def.u, def.v, def.near, def.far, 112),
  ]);
  const bloomSourceLines = [
    ...topFlows,
    ...middleTopFlows,
    ...middleBottomFlows,
    ...bottomFlows,
  ];

  const perimeterLoopA = buildLeafPerimeterLoop(1.07, 0.06, 236);
  const perimeterLoopB = buildLeafPerimeterLoop(1.12, 0.085, 236);

  const sigilLines = [
    leftEdge,
    rightEdge,
    spine,
    ...topFlows,
    ...middleTopFlows,
    ...middleBottomFlows,
    ...bottomFlows,
    perimeterLoopA,
    perimeterLoopB,
  ];
  const core = leafPointForUV(LEAF_CORE_U, 0, { edgeLift: 0.04 });
  const centeredSigilLines = sigilLines.map((line) =>
    line.map((point) => ({
      x: point.x - core.x,
      y: point.y - core.y,
      z: point.z - core.z,
    })),
  );
  const centeredBloomLines = bloomSourceLines.map((line) =>
    line.map((point) => ({
      x: point.x - core.x,
      y: point.y - core.y,
      z: point.z - core.z,
    })),
  );
  const leafLines = [...centeredSigilLines];
  const leafCloud = leafLines.flatMap((line) => line);
  const centeredCore = { x: 0, y: 0, z: 0 };

  return {
    leafCloud,
    leafLines,
    bloomLines: centeredBloomLines,
    sigilLines: centeredSigilLines,
    core: centeredCore,
  };
}

function sampleSvgPathPoints(pathData, minimumSamples = 48) {
  if (typeof document === "undefined") {
    return [];
  }
  const ns = "http://www.w3.org/2000/svg";
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", String(pathData || ""));
  if (typeof path.getTotalLength !== "function") {
    return [];
  }
  let totalLength = 0;
  try {
    totalLength = path.getTotalLength();
  } catch {
    return [];
  }
  if (!Number.isFinite(totalLength) || totalLength <= 0.01) {
    return [];
  }

  const samples = Math.max(minimumSamples, Math.ceil(totalLength * 1.35));
  const points = [];
  for (let index = 0; index <= samples; index += 1) {
    const at = totalLength * (index / samples);
    const point = path.getPointAtLength(at);
    points.push({
      x: (point.x - 12) / 6.8,
      y: (point.y - 12) / 6.8,
      z: 0,
    });
  }
  return points;
}

function pointDistance3d(a, b) {
  const dx = Number(a && a.x) - Number(b && b.x);
  const dy = Number(a && a.y) - Number(b && b.y);
  const dz = Number(a && a.z) - Number(b && b.z);
  return Math.hypot(dx, dy, dz);
}

function buildFlowPathFromSegments(segments) {
  const source = Array.isArray(segments) ? segments : [];
  const path = [];
  let previousEnd = null;
  for (const segment of source) {
    if (!Array.isArray(segment) || segment.length < 2) {
      continue;
    }
    if (!previousEnd) {
      path.push(...segment);
      previousEnd = segment[segment.length - 1];
      continue;
    }
    const first = segment[0];
    const gap = pointDistance3d(previousEnd, first);
    if (gap > 0.08) {
      const bridge = sampleBezierCurve(
        previousEnd,
        {
          x: lerp(previousEnd.x, first.x, 0.35),
          y: lerp(previousEnd.y, first.y, 0.35),
          z: lerp(previousEnd.z, first.z, 0.35) + 0.04,
        },
        {
          x: lerp(previousEnd.x, first.x, 0.7),
          y: lerp(previousEnd.y, first.y, 0.7),
          z: lerp(previousEnd.z, first.z, 0.7) + 0.04,
        },
        first,
        Math.max(8, Math.min(28, Math.floor(gap * 42))),
      );
      path.push(...bridge.slice(1));
    }
    path.push(...segment.slice(1));
    previousEnd = segment[segment.length - 1];
  }
  return path;
}

function pathPointAt(path, progress, loop = false) {
  const source = Array.isArray(path) && path.length ? path : [{ x: 0, y: 0, z: 0 }];
  if (source.length === 1) {
    return source[0];
  }
  let t = Number(progress) || 0;
  if (loop) {
    t = ((t % 1) + 1) % 1;
  } else {
    t = clamp01(t);
  }
  const scaled = t * (source.length - 1);
  const index = Math.floor(scaled);
  const frac = scaled - index;
  const a = source[Math.min(index, source.length - 1)] || source[0];
  const b = source[Math.min(index + 1, source.length - 1)] || source[source.length - 1];
  return lerpPoint(a, b, frac);
}

const TRACER_FLOW_MODES = Object.freeze(["orbit", "lemniscate", "spiral", "rose"]);

function buildSymbolTraceLibrary() {
  const keys = regionSymbolKeys().filter((key) => key !== "final-arc");
  const library = [];
  for (const key of keys) {
    const spec = symbolSpecForKey(key);
    if (!spec || !Array.isArray(spec.paths)) {
      continue;
    }
    const segments = spec.paths
      .map((pathData) => sampleSvgPathPoints(pathData, 36))
      .filter((segment) => segment.length > 2);
    if (!segments.length) {
      continue;
    }
    const totalSteps = segments.reduce((sum, segment) => sum + Math.max(1, segment.length - 1), 0);
    const flowPath = buildFlowPathFromSegments(segments);
    library.push({
      key,
      label: String(spec.label || key),
      segments,
      totalSteps,
      flowPath,
    });
  }
  return library;
}

function createSymbolTracer(controller, elapsedSec) {
  const library = controller.symbolLibrary;
  if (!Array.isArray(library) || !library.length) {
    return null;
  }
  controller.traceSeed += 1;
  const seed = controller.traceSeed * 61 + 13;
  const symbolIndex = Math.floor(randomRange(seed + 3, 0, library.length));
  const symbol = library[symbolIndex] || library[0];
  const orbitRadius = randomRange(seed + 7, 4.8, 8.8);
  const orbitAngle = randomRange(seed + 11, 0, Math.PI * 2);
  const anchorHeight = randomRange(seed + 17, -2.9, 2.9);
  const anchorDepth = randomRange(seed + 19, -2.2, 2.8);
  const complexity = Math.max(0.9, Number(symbol.totalSteps || 0) / 135);
  const flowMode = TRACER_FLOW_MODES[symbolIndex % TRACER_FLOW_MODES.length] || "orbit";
  const symbolScale = randomRange(seed + 47, 0.72, 1.16);
  const decayLineCount = Math.floor(randomRange(seed + 89, 20, 34));
  const decayTrailLength = Math.floor(randomRange(seed + 97, 24, 42));

  return {
    seed,
    symbol,
    startedAtSec: elapsedSec,
    flyDurationSec: randomRange(seed + 23, 1.2, 2.1),
    traceLoops: 2,
    traceDurationSec: Math.min(11.2, randomRange(seed + 29, 2.9, 4.7) * complexity * 2),
    holdDurationSec: randomRange(seed + 31, 0.7, 1.1),
    decayDurationSec: randomRange(seed + 37, 8.8, 12.6),
    funnelDurationSec: randomRange(seed + 41, 3.6, 5.4),
    holdLoopRate: randomRange(seed + 43, 0.28, 0.46),
    anchor: {
      x: Math.cos(orbitAngle) * orbitRadius,
      y: anchorHeight,
      z: Math.sin(orbitAngle) * orbitRadius * 0.68 + anchorDepth,
    },
    scale: symbolScale,
    rotationOffset: randomRange(seed + 53, 0, Math.PI * 2),
    spinRate: randomRange(seed + 59, -0.3, 0.3),
    phase: randomRange(seed + 61, 0, Math.PI * 2),
    depthWobble: randomRange(seed + 67, 0.035, 0.15),
    flowMode,
    flowRate: randomRange(seed + 71, 0.72, 1.36),
    flowAmplitude: randomRange(seed + 73, 0.12, 0.28),
    pathSway: randomRange(seed + 79, 0.02, 0.075),
    scalePulse: randomRange(seed + 83, 0.01, 0.035),
    decayLineCount,
    decayTrailLength,
    decayChaosScale: randomRange(seed + 101, 0.045, 0.09) * symbolScale,
    decayOrbitScale: randomRange(seed + 103, 0.16, 0.31) * symbolScale,
    decayField: null,
    flowPath: Array.isArray(symbol.flowPath) && symbol.flowPath.length
      ? symbol.flowPath
      : (Array.isArray(symbol.segments[0]) && symbol.segments[0].length ? symbol.segments[0] : [{ x: 0, y: 0, z: 0 }]),
    trail: [],
  };
}

function createTracerDecayField(tracer, decayStartElapsedSec, funnelCenterPoint) {
  const funnelCenter = {
    x: Number(funnelCenterPoint && funnelCenterPoint.x) || 0,
    y: Number(funnelCenterPoint && funnelCenterPoint.y) || 0,
    z: Number(funnelCenterPoint && funnelCenterPoint.z) || 0,
  };
  const orbitCenter = { ...funnelCenter };
  const lineCount = Math.max(6, Math.floor(Number(tracer.decayLineCount) || 12));
  const trailLength = Math.max(10, Math.floor(Number(tracer.decayTrailLength) || 24));
  const sourceSegments = Array.isArray(tracer.symbol && tracer.symbol.segments)
    ? tracer.symbol.segments.filter((segment) => Array.isArray(segment) && segment.length > 1)
    : [];
  const flowPath = Array.isArray(tracer.flowPath) && tracer.flowPath.length > 1
    ? tracer.flowPath
    : [];
  const resolvedLineCount = Math.max(lineCount, sourceSegments.length || 0);
  const sphereRadius = randomRange(Number(tracer.seed) * 139 + 5, 5.3, 7.1) * (0.9 + Number(tracer.scale || 1) * 0.34);
  const spherePulseAmp = randomRange(Number(tracer.seed) * 151 + 15, 0.03, 0.085);
  const spherePulseRate = randomRange(Number(tracer.seed) * 157 + 17, 0.32, 0.74);
  const spherePulsePhase = randomRange(Number(tracer.seed) * 163 + 19, 0, Math.PI * 2);
  const morphDuration = randomRange(Number(tracer.seed) * 149 + 9, 0.24, 0.36);
  const lines = [];

  for (let index = 0; index < resolvedLineCount; index += 1) {
    const seed = (Number(tracer.seed) || 1) * 127 + index * 53;
    const localTrail = [];
    if (index < sourceSegments.length) {
      const segment = sourceSegments[index];
      for (let pointIndex = 0; pointIndex < trailLength; pointIndex += 1) {
        const t = trailLength <= 1 ? 0 : pointIndex / (trailLength - 1);
        localTrail.push(pathPointAt(segment, t, false));
      }
    } else if (flowPath.length) {
      const start = randomRange(seed + 5, 0, 1);
      const span = randomRange(seed + 7, 0.18, 0.44);
      for (let pointIndex = 0; pointIndex < trailLength; pointIndex += 1) {
        const t = trailLength <= 1 ? start : start + (pointIndex / (trailLength - 1)) * span;
        localTrail.push(pathPointAt(flowPath, t, true));
      }
    } else {
      const symbolProgress = randomRange(seed + 5, 0, 1);
      const local = symbolLocalPointAtProgress(tracer, symbolProgress, true);
      for (let pointIndex = 0; pointIndex < trailLength; pointIndex += 1) {
        localTrail.push(local);
      }
    }

    const initialTrail = localTrail.map((localPoint, pointIndex) => {
      const phase = trailLength <= 1 ? 0 : pointIndex / (trailLength - 1);
      return symbolLocalToWorld(localPoint, tracer, decayStartElapsedSec, phase);
    });
    const spawn = initialTrail[0] || orbitCenter;

    lines.push({
      phase: randomRange(seed + 11, 0, Math.PI * 2),
      width: randomRange(seed + 31, 1.12, 2.2),
      spinDirection: randomRange(seed + 37, 0, 1) > 0.5 ? 1 : -1,
      theta: randomRange(seed + 41, 0, Math.PI * 2),
      thetaRate: randomRange(seed + 47, 0.62, 1.46),
      phiRate: randomRange(seed + 49, 0.38, 0.98),
      orbitPattern: "lat",
      phiBase: 0,
      phiAmp: randomRange(seed + 53, 0.22, 0.64),
      thetaSwing: randomRange(seed + 57, 0.18, 1.02),
      timeLag: randomRange(seed + 59, 0.34, 0.9),
      morphOffset: randomRange(seed + 73, -0.08, 0.1),
      funnelOffset: randomRange(seed + 79, 0, 0.52),
      funnelSpan: randomRange(seed + 83, 0.28, 0.62),
      funnelPhase: randomRange(seed + 89, 0, Math.PI * 2),
      funnelTurnOffset: randomRange(seed + 97, -0.62, 0.62),
      funnelSkewX: randomRange(seed + 101, 0.82, 1.18),
      funnelSkewY: randomRange(seed + 103, 0.72, 1.22),
      funnelSkewZ: randomRange(seed + 107, 0.64, 1.24),
      trail: initialTrail,
      startTrail: initialTrail.map((point) => ({ x: point.x, y: point.y, z: point.z })),
      head: spawn,
    });

    const line = lines[lines.length - 1];
    const phiBands = [-0.84, -0.56, -0.32, -0.12, -0.12, -0.04, 0.03, 0.08, 0.08, 0.15, 0.28, 0.54];
    if (randomRange(seed + 109, 0, 1) < 0.78) {
      const bandIndex = Math.floor(randomRange(seed + 111, 0, phiBands.length));
      line.phiBase = (phiBands[Math.min(bandIndex, phiBands.length - 1)] || 0) + randomRange(seed + 113, -0.08, 0.08);
    } else {
      line.phiBase = randomRange(seed + 113, -1.12, 1.12);
    }

    const patternRoll = randomRange(seed + 117, 0, 1);
    if (patternRoll < 0.26) {
      line.orbitPattern = "mer";
      line.phiAmp = randomRange(seed + 119, 0.9, 1.26);
      line.thetaSwing = randomRange(seed + 121, 0.65, 1.35);
      line.thetaRate = randomRange(seed + 123, 0.48, 0.94);
      line.phiRate = randomRange(seed + 127, 0.72, 1.22);
    } else if (patternRoll < 0.58) {
      line.orbitPattern = "diag";
      line.phiAmp = randomRange(seed + 129, 0.52, 0.94);
      line.thetaSwing = randomRange(seed + 131, 0.28, 0.82);
      line.thetaRate = randomRange(seed + 137, 0.72, 1.36);
      line.phiRate = randomRange(seed + 139, 0.54, 1.08);
    } else {
      line.orbitPattern = "lat";
      line.phiAmp = randomRange(seed + 149, 0.22, 0.46);
      line.thetaSwing = randomRange(seed + 151, 0.14, 0.42);
      line.thetaRate = randomRange(seed + 157, 0.78, 1.48);
      line.phiRate = randomRange(seed + 163, 0.32, 0.86);
    }
  }

  return {
    orbitCenter,
    funnelCenter,
    sphereRadius,
    spherePulseAmp,
    spherePulseRate,
    spherePulsePhase,
    morphDuration,
    colorState: {
      baseHue: randomRange(Number(tracer.seed) * 59 + 7, 202, 214),
      baseSat: randomRange(Number(tracer.seed) * 61 + 11, 10, 20),
      baseLight: randomRange(Number(tracer.seed) * 67 + 13, 87, 93),
      direction: randomRange(Number(tracer.seed) * 71 + 17, 0, 1) > 0.5 ? 1 : -1,
      driftArc: randomRange(Number(tracer.seed) * 73 + 19, 44, 132),
      hueSwingA: randomRange(Number(tracer.seed) * 79 + 23, 26, 58),
      hueSwingB: randomRange(Number(tracer.seed) * 83 + 29, 12, 34),
      hueRateA: randomRange(Number(tracer.seed) * 89 + 31, 0.65, 1.55),
      hueRateB: randomRange(Number(tracer.seed) * 97 + 37, 0.35, 1.05),
      satSwing: randomRange(Number(tracer.seed) * 101 + 41, 18, 32),
      lightSwing: randomRange(Number(tracer.seed) * 103 + 43, 10, 22),
      satRate: randomRange(Number(tracer.seed) * 107 + 47, 0.62, 1.44),
      lightRate: randomRange(Number(tracer.seed) * 109 + 53, 0.74, 1.62),
      phaseA: randomRange(Number(tracer.seed) * 113 + 59, 0, Math.PI * 2),
      phaseB: randomRange(Number(tracer.seed) * 127 + 61, 0, Math.PI * 2),
      phaseC: randomRange(Number(tracer.seed) * 131 + 67, 0, Math.PI * 2),
      phaseD: randomRange(Number(tracer.seed) * 137 + 71, 0, Math.PI * 2),
    },
    lines,
  };
}

function tracerDecaySetColor(field, elapsedSec, decayProgress, funnelProgress) {
  const state = field && field.colorState ? field.colorState : {
    baseHue: 208,
    baseSat: 14,
    baseLight: 90,
    direction: 1,
    driftArc: 80,
    hueSwingA: 40,
    hueSwingB: 22,
    hueRateA: 1.0,
    hueRateB: 0.6,
    satSwing: 24,
    lightSwing: 16,
    satRate: 1.0,
    lightRate: 1.1,
    phaseA: 0,
    phaseB: 0,
    phaseC: 0,
    phaseD: 0,
  };

  const depart = easeInOutCubic(clamp01(decayProgress / 0.3));
  const returnToBlue = easeInOutCubic(funnelProgress);
  const wanderMix = depart * (1 - returnToBlue);
  const direction = Number(state.direction) >= 0 ? 1 : -1;
  const arc = direction * Number(state.driftArc || 0) * wanderMix;
  const waveA = Math.sin(elapsedSec * Number(state.hueRateA || 0) + Number(state.phaseA || 0)) * Number(state.hueSwingA || 0);
  const waveB = Math.sin(elapsedSec * Number(state.hueRateB || 0) + Number(state.phaseB || 0)) * Number(state.hueSwingB || 0);
  const hue = wrapHue(Number(state.baseHue || 208) + (arc + waveA + waveB) * wanderMix);
  const satWave = Math.sin(elapsedSec * Number(state.satRate || 0) + Number(state.phaseC || 0)) * Number(state.satSwing || 0);
  const lightWave = Math.sin(elapsedSec * Number(state.lightRate || 0) + Number(state.phaseD || 0)) * Number(state.lightSwing || 0);
  const sat = Math.max(8, Math.min(100, Number(state.baseSat || 14) + (28 + satWave) * wanderMix));
  const light = Math.max(34, Math.min(96, Number(state.baseLight || 90) - (14 + lightWave * 0.5) * wanderMix + returnToBlue * 3));

  return {
    hue,
    sat,
    light,
  };
}

function tracerSphereOrbitPoint(line, orbitCenter, sphereRadius, timeSec) {
  const center = orbitCenter || { x: 0, y: 0, z: 0 };
  const direction = Number(line && line.spinDirection) >= 0 ? 1 : -1;
  const thetaBase = Number(line && line.theta) + direction * timeSec * Number(line && line.thetaRate);
  const phiBase = Number(line && line.phiBase);
  const pattern = line && line.orbitPattern ? String(line.orbitPattern) : "lat";
  let theta = thetaBase;
  let phi = phiBase;

  if (pattern === "mer") {
    theta = Number(line && line.theta) + Math.sin(timeSec * Number(line && line.thetaRate) * 0.66 + Number(line && line.phase)) * Number(line && line.thetaSwing);
    phi = phiBase + Math.sin(timeSec * Number(line && line.phiRate) + Number(line && line.phase)) * Number(line && line.phiAmp);
  } else if (pattern === "diag") {
    theta = thetaBase + Math.sin(timeSec * Number(line && line.phiRate) * 0.58 + Number(line && line.phase) * 0.7) * Number(line && line.thetaSwing);
    phi = phiBase
      + Math.sin(timeSec * Number(line && line.phiRate) + Number(line && line.phase)) * Number(line && line.phiAmp)
      + Math.cos(timeSec * Number(line && line.thetaRate) * 0.36 + Number(line && line.phase) * 0.4) * 0.24;
  } else {
    theta = thetaBase;
    phi = phiBase + Math.sin(timeSec * Number(line && line.phiRate) + Number(line && line.phase)) * Number(line && line.phiAmp);
  }

  phi = Math.max(-1.35, Math.min(1.35, phi));
  const radius = Math.max(0.18, Number(sphereRadius || 1));
  const cosPhi = Math.cos(phi);
  return {
    x: center.x + Math.cos(theta) * cosPhi * radius,
    y: center.y + Math.sin(phi) * radius,
    z: center.z + Math.sin(theta) * cosPhi * radius,
  };
}

function updateTracerDecayField(tracer, dt, elapsedSec, decayProgress, funnelProgress) {
  const field = tracer.decayField;
  if (!field || !Array.isArray(field.lines) || !field.lines.length) {
    return;
  }

  const orbitCenter = field.orbitCenter || { x: 0, y: 0, z: 0 };
  const funnelCenter = field.funnelCenter || orbitCenter;
  const sphereBaseRadius = Math.max(0.36, Number(field.sphereRadius) || 2.8);
  const spherePulse = 1 + Math.sin(elapsedSec * Number(field.spherePulseRate || 0) + Number(field.spherePulsePhase || 0)) * Number(field.spherePulseAmp || 0);
  const sphereRadius = sphereBaseRadius * spherePulse;
  const morphDuration = clamp01(Number(field.morphDuration) || 0.3);
  const stepScale = Math.min(1.65, Math.max(0.62, (Number(dt) || 0.016) / 0.016));
  const globalMorph = easeInOutCubic(clamp01(decayProgress / Math.max(0.12, morphDuration)));

  for (let index = 0; index < field.lines.length; index += 1) {
    const line = field.lines[index];
    const lineMorph = easeInOutCubic(clamp01(globalMorph + Number(line.morphOffset || 0)));
    const lineFunnelStart = clamp01(Number(line.funnelOffset) || 0);
    const lineFunnelSpan = Math.max(0.08, Math.min(1 - lineFunnelStart + 0.001, Number(line.funnelSpan) || 0.36));
    const linePull = easeInOutCubic(clamp01((funnelProgress - lineFunnelStart) / lineFunnelSpan));
    const startTrail = Array.isArray(line.startTrail) ? line.startTrail : [];
    const existingTrail = Array.isArray(line.trail) ? line.trail : [];
    const trailLength = Math.max(startTrail.length, existingTrail.length, 2);
    const trail = Array.isArray(line.trail) && line.trail.length
      ? [...line.trail]
      : Array.from({ length: trailLength }, (_, pointIndex) =>
        startTrail[Math.min(pointIndex, Math.max(0, startTrail.length - 1))] || orbitCenter,
      );

    let orbitHead = tracerSphereOrbitPoint(line, orbitCenter, sphereRadius, elapsedSec);
    if (linePull > 0.0001) {
      const pull = linePull;
      const transferCenter = lerpPoint(orbitCenter, funnelCenter, pull * 0.84);
      const spiralAngle =
        elapsedSec * Number(line.thetaRate || 1) * 2.24
        + Number(line.phase || 0)
        + Number(line.funnelTurnOffset || 0)
        + pull * Math.PI * 2.9;
      const spiralRadius = sphereRadius * (1 - pull) * (0.54 + 0.16 * Math.sin(elapsedSec * 0.7 + Number(line.phase || 0)));
      const funnelHead = {
        x: transferCenter.x + Math.cos(spiralAngle + Number(line.funnelPhase || 0)) * spiralRadius * 0.42 * Number(line.funnelSkewX || 1),
        y: transferCenter.y + Math.sin(spiralAngle * 1.08 + Number(line.funnelPhase || 0) * 0.8) * spiralRadius * 0.36 * Number(line.funnelSkewY || 1),
        z: transferCenter.z + Math.sin(spiralAngle * 0.74 + Number(line.funnelPhase || 0) * 0.42) * spiralRadius * 0.24 * Number(line.funnelSkewZ || 1),
      };
      orbitHead = lerpPoint(orbitHead, funnelHead, pull);
      orbitHead = lerpPoint(orbitHead, funnelCenter, Math.pow(pull, 1.36));
    }

    const startHead = startTrail.length ? startTrail[0] : orbitHead;
    const targetHead = lerpPoint(startHead, orbitHead, lineMorph);
    const previousHead = trail[0] || targetHead;
    const followGain = Math.min(1, (0.45 + stepScale * 0.38) / (1 + Number(line.timeLag || 0.5) * 0.28));
    const nextHead = lerpPoint(previousHead, targetHead, followGain);

    trail.unshift(nextHead);
    while (trail.length < trailLength) {
      trail.push(trail[trail.length - 1] || nextHead);
    }
    if (trail.length > trailLength) {
      trail.length = trailLength;
    }

    if (lineMorph < 0.999 && startTrail.length) {
      for (let pointIndex = 0; pointIndex < trail.length; pointIndex += 1) {
        const startPoint = startTrail[Math.min(pointIndex, startTrail.length - 1)] || nextHead;
        trail[pointIndex] = lerpPoint(startPoint, trail[pointIndex], lineMorph);
      }
    }

    line.trail = trail;
    line.head = nextHead;
  }
}

function drawTracerDecayField(
  ctx,
  tracer,
  elapsedSec,
  rotY,
  rotX,
  width,
  height,
  globalScale,
  depth,
  palette,
  decayProgress,
  funnelProgress,
) {
  const field = tracer.decayField;
  if (!field || !Array.isArray(field.lines) || !field.lines.length) {
    return;
  }

  const reveal = easeInOutCubic(decayProgress);
  const funnelEase = easeInOutCubic(funnelProgress);
  const energy = (0.4 + 0.6 * reveal) * (1 - funnelEase * 0.68);
  if (energy <= 0.001) {
    return;
  }
  const setColor = tracerDecaySetColor(field, elapsedSec, decayProgress, funnelProgress);
  const hueValue = setColor.hue.toFixed(1);
  const satValue = setColor.sat.toFixed(1);
  const lightValue = setColor.light.toFixed(1);
  const glowLightValue = Math.min(97, setColor.light + 10).toFixed(1);
  for (let index = 0; index < field.lines.length; index += 1) {
    const line = field.lines[index];
    const trail = line.trail;
    if (!Array.isArray(trail) || trail.length < 2) {
      continue;
    }

    const coreWidth = Math.max(0.72, line.width * (1 - funnelEase * 0.24));
    const glowWidth = coreWidth * 1.9;
    for (let pointIndex = 1; pointIndex < trail.length; pointIndex += 1) {
      const a = projectPoint(rotatePoint(trail[pointIndex - 1], rotY, rotX), width, height, globalScale, depth);
      const b = projectPoint(rotatePoint(trail[pointIndex], rotY, rotX), width, height, globalScale, depth);
      if ((!a || !a.visible) && (!b || !b.visible)) {
        continue;
      }

      const t = (pointIndex - 0.5) / Math.max(1, trail.length - 1);
      const headEnergy = 1 - t;
      const carrier = 0.5 + 0.5 * Math.sin(elapsedSec * 1.2 + line.phase + t * 2.8);
      const alpha = energy * (0.16 + headEnergy * 0.62) * (0.55 + 0.45 * carrier);

      ctx.strokeStyle = `hsla(${hueValue}, ${satValue}%, ${glowLightValue}%, ${(alpha * 0.58).toFixed(3)})`;
      ctx.lineWidth = glowWidth;
      ctx.beginPath();
      if (a && a.visible) {
        ctx.moveTo(a.x, a.y);
      } else {
        ctx.moveTo(b.x, b.y);
      }
      if (b && b.visible) {
        ctx.lineTo(b.x, b.y);
      } else {
        ctx.lineTo(a.x, a.y);
      }
      ctx.stroke();

      ctx.strokeStyle = `hsla(${hueValue}, ${satValue}%, ${lightValue}%, ${alpha.toFixed(3)})`;
      ctx.lineWidth = coreWidth;
      ctx.beginPath();
      if (a && a.visible) {
        ctx.moveTo(a.x, a.y);
      } else {
        ctx.moveTo(b.x, b.y);
      }
      if (b && b.visible) {
        ctx.lineTo(b.x, b.y);
      } else {
        ctx.lineTo(a.x, a.y);
      }
      ctx.stroke();
    }
  }

  const centerProjected = projectPoint(rotatePoint(field.funnelCenter || field.orbitCenter, rotY, rotX), width, height, globalScale, depth);
  if (centerProjected.visible) {
    const centerRadius = Math.max(6, Math.min(width, height) * (0.008 + energy * 0.006));
    const centerGlow = ctx.createRadialGradient(
      centerProjected.x,
      centerProjected.y,
      0,
      centerProjected.x,
      centerProjected.y,
      centerRadius,
    );
    centerGlow.addColorStop(0, `hsla(${hueValue}, ${satValue}%, ${glowLightValue}%, ${(0.45 * energy).toFixed(3)})`);
    centerGlow.addColorStop(1, "rgba(120, 190, 255, 0)");
    ctx.fillStyle = centerGlow;
    ctx.beginPath();
    ctx.arc(centerProjected.x, centerProjected.y, centerRadius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function tracerAnchorOffset(tracer, elapsedSec) {
  const t = elapsedSec * tracer.flowRate + tracer.phase;
  const amp = tracer.flowAmplitude;
  if (tracer.flowMode === "lemniscate") {
    return {
      x: amp * Math.sin(t),
      y: amp * 0.62 * Math.sin(t) * Math.cos(t),
      z: amp * 0.32 * Math.cos(t * 1.35),
    };
  }
  if (tracer.flowMode === "spiral") {
    const radius = amp * (0.6 + 0.4 * Math.sin(t * 0.5 + tracer.phase));
    return {
      x: radius * Math.cos(t * 1.24),
      y: radius * 0.72 * Math.sin(t * 1.11),
      z: amp * 0.3 * Math.sin(t * 0.84),
    };
  }
  if (tracer.flowMode === "rose") {
    const petals = Math.cos(t * 2.1);
    return {
      x: amp * petals * Math.cos(t),
      y: amp * 0.68 * petals * Math.sin(t),
      z: amp * 0.26 * Math.sin(t * 1.63),
    };
  }
  return {
    x: amp * Math.cos(t),
    y: amp * 0.64 * Math.sin(t * 1.18),
    z: amp * 0.3 * Math.sin(t * 0.92),
  };
}

function tracerAnchorPoint(tracer, elapsedSec) {
  const offset = tracerAnchorOffset(tracer, elapsedSec);
  return {
    x: tracer.anchor.x + offset.x,
    y: tracer.anchor.y + offset.y,
    z: tracer.anchor.z + offset.z,
  };
}

function symbolLocalToWorld(localPoint, tracer, elapsedSec, phaseProgress = 0) {
  const anchor = tracerAnchorPoint(tracer, elapsedSec);
  const angle = tracer.rotationOffset + tracer.spinRate * elapsedSec;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const breathing = 1 + Math.sin(elapsedSec * 1.8 + phaseProgress * Math.PI * 2 + tracer.phase) * tracer.scalePulse;
  const sx = localPoint.x * tracer.scale * breathing;
  const sy = localPoint.y * tracer.scale * breathing;
  const x = sx * cos - sy * sin;
  const y = sx * sin + sy * cos;
  const sway = Math.sin(elapsedSec * 2.25 + phaseProgress * 11 + tracer.phase) * tracer.pathSway;
  const zWobble = Math.sin((localPoint.x + localPoint.y) * 1.25 + elapsedSec + tracer.phase) * tracer.depthWobble;
  return {
    x: anchor.x + x + Math.cos(angle + Math.PI * 0.5) * sway,
    y: anchor.y + y + Math.sin(angle + Math.PI * 0.5) * sway * 0.85,
    z: anchor.z + zWobble,
  };
}

function symbolHeadPoint(tracer, progress, elapsedSec, loop = false) {
  const phase = loop ? ((Number(progress) % 1) + 1) % 1 : clamp01(progress);
  const local = symbolLocalPointAtProgress(tracer, phase, loop);
  return symbolLocalToWorld(local, tracer, elapsedSec, phase);
}

function symbolLocalPointAtProgress(tracer, progress, loop = false) {
  const symbol = tracer && tracer.symbol;
  const sourceSegments = Array.isArray(symbol && symbol.segments) ? symbol.segments : [];
  const segments = sourceSegments.filter((segment) => Array.isArray(segment) && segment.length > 1);
  if (!segments.length) {
    return { x: 0, y: 0, z: 0 };
  }

  const computedTotalSteps = segments.reduce((sum, segment) => sum + Math.max(1, segment.length - 1), 0);
  const totalSteps = Math.max(1, Number(symbol.totalSteps) || computedTotalSteps);

  let t = Number(progress) || 0;
  if (loop) {
    t = ((t % 1) + 1) % 1;
  } else {
    t = clamp01(t);
  }

  let remaining = t * totalSteps;
  for (const segment of segments) {
    const segmentSteps = Math.max(1, segment.length - 1);
    if (remaining <= segmentSteps) {
      const local = clamp01(remaining / segmentSteps) * (segment.length - 1);
      const index = Math.floor(local);
      const frac = local - index;
      const a = segment[Math.min(index, segment.length - 1)] || segment[0];
      const b = segment[Math.min(index + 1, segment.length - 1)] || segment[segment.length - 1];
      return lerpPoint(a, b, frac);
    }
    remaining -= segmentSteps;
  }

  const lastSegment = segments[segments.length - 1];
  return lastSegment[lastSegment.length - 1];
}

function drawSymbolProgress(ctx, tracer, progress, elapsedSec, rotY, rotX, width, height, globalScale, depth) {
  const totalSteps = Math.max(1, Number(tracer.symbol.totalSteps) || 1);
  let remaining = clamp01(progress) * totalSteps;
  let walked = 0;
  for (const segment of tracer.symbol.segments) {
    if (!Array.isArray(segment) || segment.length < 2) {
      continue;
    }
    const segmentSteps = Math.max(1, segment.length - 1);
    if (remaining <= 0) {
      break;
    }

    const segmentTravel = Math.min(segmentSteps, remaining);
    const scaled = (segmentTravel / segmentSteps) * (segment.length - 1);
    const fullIndex = Math.floor(scaled);
    const frac = scaled - fullIndex;
    const maxIndex = segment.length - 1;

    ctx.beginPath();
    let moved = false;

    const cappedFullIndex = Math.min(fullIndex, maxIndex);
    for (let index = 0; index <= cappedFullIndex; index += 1) {
      const localPoint = segment[index] || segment[maxIndex];
      const phase = (walked + Math.min(index, segmentSteps)) / totalSteps;
      const worldPoint = symbolLocalToWorld(localPoint, tracer, elapsedSec, phase);
      const projected = projectPoint(rotatePoint(worldPoint, rotY, rotX), width, height, globalScale, depth);
      if (!projected.visible) {
        continue;
      }
      if (!moved) {
        ctx.moveTo(projected.x, projected.y);
        moved = true;
      } else {
        ctx.lineTo(projected.x, projected.y);
      }
    }

    if (frac > 0 && fullIndex < maxIndex) {
      const a = segment[fullIndex] || segment[maxIndex];
      const b = segment[fullIndex + 1] || segment[maxIndex];
      const localPoint = lerpPoint(a, b, frac);
      const phase = (walked + fullIndex + frac) / totalSteps;
      const worldPoint = symbolLocalToWorld(localPoint, tracer, elapsedSec, phase);
      const projected = projectPoint(rotatePoint(worldPoint, rotY, rotX), width, height, globalScale, depth);
      if (projected.visible) {
        if (!moved) {
          ctx.moveTo(projected.x, projected.y);
          moved = true;
        } else {
          ctx.lineTo(projected.x, projected.y);
        }
      }
    }

    if (moved) {
      ctx.stroke();
    }
    walked += segmentSteps;
    remaining -= segmentSteps;
  }
}

function drawSymbolTracer(controller, tracer, elapsedSec, dt, rotY, rotX, width, height, globalScale, depth, palette) {
  const { ctx, leafCore } = controller;
  const age = elapsedSec - tracer.startedAtSec;
  const traceLoops = Math.max(1, Number(tracer.traceLoops) || 1);
  const flyEnd = tracer.flyDurationSec;
  const trailFadeOutSec = Math.max(0.3, Math.min(0.72, (Number(tracer.traceDurationSec) || 1) * 0.16));
  const traceEnd = flyEnd + tracer.traceDurationSec;
  const holdEnd = traceEnd + tracer.holdDurationSec;
  const decayEnd = holdEnd + tracer.decayDurationSec;
  const vanishEnd = decayEnd + tracer.funnelDurationSec;
  if (age >= vanishEnd) {
    return false;
  }

  let drawProgress = 0;
  let completedTraceLoops = 0;
  let trailAlpha = 1;
  let symbolAlpha = 0;
  let head = null;
  let decayProgress = 0;
  let funnelProgress = 0;
  const inDecayPhase = age >= holdEnd;

  if (age < flyEnd) {
    const flyProgress = clamp01(age / flyEnd);
    const s = easeInOutCubic(flyProgress);
    const target = symbolHeadPoint(tracer, 0, elapsedSec, false);
    const spiralRadius = s * (1 - s) * (1.9 + 0.35 * Math.sin(elapsedSec * 6.2 + tracer.phase));
    const spinAngle = elapsedSec * 7.6 + tracer.phase;
    head = {
      x: lerp(leafCore.x, target.x, s) + Math.cos(spinAngle) * spiralRadius,
      y: lerp(leafCore.y, target.y, s) + Math.sin(spinAngle * 1.22) * spiralRadius * 0.9,
      z: lerp(leafCore.z, target.z, s) + Math.sin(spinAngle * 0.74) * spiralRadius * 0.33,
    };
    trailAlpha = 0.9;
  } else if (age < traceEnd) {
    const tracePhase = easeInOutCubic((age - flyEnd) / tracer.traceDurationSec) * traceLoops;
    completedTraceLoops = Math.floor(tracePhase);
    drawProgress = tracePhase - completedTraceLoops;
    head = symbolHeadPoint(tracer, tracePhase, elapsedSec, true);
    trailAlpha = 0.78;
    symbolAlpha = 0.58 + 0.38 * Math.min(1, tracePhase / traceLoops);
  } else if (age < holdEnd) {
    completedTraceLoops = traceLoops;
    drawProgress = 1;
    const holdPhase = traceLoops + (age - traceEnd) * tracer.holdLoopRate;
    head = symbolHeadPoint(tracer, holdPhase, elapsedSec, true);
    const holdPulse = 0.5 + 0.5 * Math.sin((age - traceEnd) * 2.4 + tracer.phase);
    trailAlpha = 0.5;
    symbolAlpha = 0.78 + holdPulse * 0.08;
  } else {
    completedTraceLoops = traceLoops;
    drawProgress = 1;
    decayProgress = clamp01((age - holdEnd) / Math.max(0.001, tracer.decayDurationSec));
    funnelProgress = clamp01((age - decayEnd) / Math.max(0.001, tracer.funnelDurationSec));
    if (!tracer.decayField) {
      tracer.decayField = createTracerDecayField(tracer, tracer.startedAtSec + holdEnd, leafCore);
    }
    updateTracerDecayField(tracer, dt, elapsedSec, decayProgress, funnelProgress);
    const fade = easeInOutCubic(clamp01((decayProgress - 0.01) / 0.2));
    symbolAlpha = 0.8 * (1 - fade) * (1 - funnelProgress * 0.55);
    trailAlpha = 0;
    head = null;
  }

  const trailFadeProgress = age <= flyEnd ? 0 : clamp01((age - flyEnd) / trailFadeOutSec);
  if (age < flyEnd) {
    tracer.trail.unshift(head);
    if (tracer.trail.length > 132) {
      tracer.trail.pop();
    }
    tracer.tailFadeStartLength = tracer.trail.length;
  } else if (trailFadeProgress < 1 && head) {
    tracer.trail.unshift(head);
    const startLength = Math.max(2, Math.min(132, Number(tracer.tailFadeStartLength) || tracer.trail.length));
    const shrink = easeInOutCubic(trailFadeProgress);
    const maxTrailLength = Math.max(2, Math.floor(lerp(startLength, 2, shrink)));
    while (tracer.trail.length > maxTrailLength) {
      tracer.trail.pop();
    }
  } else if (tracer.trail.length) {
    tracer.trail = [];
    tracer.tailFadeStartLength = 0;
  }
  const showTrail = tracer.trail.length > 1;

  const hueJitter = Math.sin(tracer.phase * 2.3) * 6;
  const decayHueDrift = inDecayPhase ? Math.sin(elapsedSec * 0.52 + tracer.phase) * 18 : 0;
  const traceHue = palette.traceHue + hueJitter + decayHueDrift;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  if (showTrail) {
    const trailFade = age <= flyEnd ? 1 : 1 - easeInOutCubic(trailFadeProgress);
    const segmentCount = tracer.trail.length - 1;
    for (let index = 0; index < segmentCount; index += 1) {
      const a = projectPoint(rotatePoint(tracer.trail[index], rotY, rotX), width, height, globalScale, depth);
      const b = projectPoint(rotatePoint(tracer.trail[index + 1], rotY, rotX), width, height, globalScale, depth);
      if ((!a || !a.visible) && (!b || !b.visible)) {
        continue;
      }

      const t = (index + 0.5) / Math.max(1, segmentCount);
      const tailGradient = 1 - t * 0.72;
      const segmentAlpha = 0.78 * trailAlpha * trailFade * tailGradient;
      if (segmentAlpha <= 0.0015) {
        continue;
      }

      ctx.strokeStyle = `hsla(${traceHue.toFixed(1)}, ${palette.traceSat.toFixed(1)}%, ${palette.traceLight.toFixed(1)}%, ${segmentAlpha.toFixed(3)})`;
      ctx.lineWidth = lerp(2.25, 0.95, t);
      ctx.beginPath();
      if (a && a.visible) {
        ctx.moveTo(a.x, a.y);
      } else {
        ctx.moveTo(b.x, b.y);
      }
      if (b && b.visible) {
        ctx.lineTo(b.x, b.y);
      } else {
        ctx.lineTo(a.x, a.y);
      }
      ctx.stroke();
    }
  }

  if (age >= flyEnd && symbolAlpha > 0.001) {
    const visibleAlpha = Math.min(1, symbolAlpha);
    if (completedTraceLoops > 0) {
      ctx.strokeStyle = `hsla(${traceHue.toFixed(1)}, ${palette.traceSat.toFixed(1)}%, ${(palette.traceLight + 5).toFixed(1)}%, ${(visibleAlpha * 0.56).toFixed(3)})`;
      ctx.lineWidth = 1.3;
      drawSymbolProgress(ctx, tracer, 1, elapsedSec, rotY, rotX, width, height, globalScale, depth);
    }
    ctx.strokeStyle = `hsla(${traceHue.toFixed(1)}, ${palette.traceSat.toFixed(1)}%, ${(palette.traceLight + 9).toFixed(1)}%, ${visibleAlpha.toFixed(3)})`;
    ctx.lineWidth = 1.5;
    drawSymbolProgress(ctx, tracer, drawProgress, elapsedSec, rotY, rotX, width, height, globalScale, depth);
  }

  if (inDecayPhase && tracer.decayField) {
    drawTracerDecayField(
      ctx,
      tracer,
      elapsedSec,
      rotY,
      rotX,
      width,
      height,
      globalScale,
      depth,
      palette,
      decayProgress,
      funnelProgress,
    );
  }

  if (head && !inDecayPhase) {
    const headProjected = projectPoint(rotatePoint(head, rotY, rotX), width, height, globalScale, depth);
    if (headProjected.visible) {
      const glowRadius = Math.max(7, Math.min(width, height) * 0.0125);
      const glow = ctx.createRadialGradient(
        headProjected.x,
        headProjected.y,
        0,
        headProjected.x,
        headProjected.y,
        glowRadius,
      );
      const glowAlpha = Math.min(1, showTrail ? trailAlpha * 0.92 : symbolAlpha * 0.82);
      glow.addColorStop(0, `hsla(${traceHue.toFixed(1)}, 95%, 90%, ${glowAlpha.toFixed(3)})`);
      glow.addColorStop(0.55, `hsla(${traceHue.toFixed(1)}, 92%, 76%, ${(glowAlpha * 0.52).toFixed(3)})`);
      glow.addColorStop(1, "rgba(120, 190, 255, 0)");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(headProjected.x, headProjected.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
  return true;
}

function convergencePalette(progress) {
  const t = clamp01(progress);
  return {
    backgroundHue: keyframeValue(t, [[0, 210], [0.42, 155], [0.72, 22], [1, 210]]),
    backgroundSat: keyframeValue(t, [[0, 72], [0.42, 58], [0.72, 40], [1, 68]]),
    backgroundLight: keyframeValue(t, [[0, 18], [0.42, 15], [0.72, 10], [1, 17]]),
    ribbonHue: keyframeValue(t, [[0, 205], [0.42, 146], [0.72, 18], [1, 206]]),
    ribbonSat: keyframeValue(t, [[0, 95], [0.42, 80], [0.72, 63], [1, 87]]),
    ribbonLight: keyframeValue(t, [[0, 74], [0.42, 58], [0.72, 44], [1, 81]]),
    ribbonAlpha: keyframeValue(t, [[0, 0.15], [0.42, 0.23], [0.72, 0.34], [1, 0.31]]),
    sigilHue: keyframeValue(t, [[0, 208], [0.42, 152], [0.72, 20], [1, 208]]),
    sigilSat: keyframeValue(t, [[0, 92], [0.42, 74], [0.72, 66], [1, 92]]),
    sigilLight: keyframeValue(t, [[0, 82], [0.42, 62], [0.72, 50], [1, 87]]),
    coreHue: keyframeValue(t, [[0, 206], [0.42, 150], [0.72, 18], [1, 207]]),
    coreSat: keyframeValue(t, [[0, 96], [0.42, 76], [0.72, 66], [1, 94]]),
    coreLight: keyframeValue(t, [[0, 88], [0.42, 66], [0.72, 52], [1, 92]]),
    midHue: keyframeValue(t, [[0, 199], [0.42, 140], [0.72, 16], [1, 201]]),
    midSat: keyframeValue(t, [[0, 84], [0.42, 70], [0.72, 58], [1, 80]]),
    midLight: keyframeValue(t, [[0, 71], [0.42, 50], [0.72, 34], [1, 75]]),
    traceHue: keyframeValue(t, [[0, 205], [0.42, 150], [0.72, 20], [1, 206]]),
    traceSat: keyframeValue(t, [[0, 92], [0.42, 75], [0.72, 66], [1, 89]]),
    traceLight: keyframeValue(t, [[0, 80], [0.42, 60], [0.72, 48], [1, 84]]),
  };
}

function createRibbon(index, trailLength) {
  const seed = index * 97 + 17;
  const side = Math.floor(randomRange(seed + 11, 0, 4));
  const edgeSpread = randomRange(seed + 19, -1.25, 1.25);
  const depthJitter = randomRange(seed + 23, -1.1, 1.1);
  let x = 0;
  let y = 0;
  if (side === 0) {
    x = -20;
    y = edgeSpread * 7;
  } else if (side === 1) {
    x = 20;
    y = edgeSpread * 7;
  } else if (side === 2) {
    y = -12;
    x = edgeSpread * 11;
  } else {
    y = 12;
    x = edgeSpread * 11;
  }
  const z = depthJitter;
  const trail = Array.from({ length: trailLength }, () => ({ x, y, z }));
  const entryTarget = {
    x: randomRange(seed + 59, -4.4, 4.4),
    y: randomRange(seed + 61, -3.2, 3.2),
    z: randomRange(seed + 67, -1.5, 1.5),
  };
  const inwardX = side === 0 ? 1 : side === 1 ? -1 : 0;
  const inwardY = side === 2 ? 1 : side === 3 ? -1 : 0;
  const tangentX = side === 0 || side === 1 ? 0 : 1;
  const tangentY = side === 0 || side === 1 ? 1 : 0;
  const entryControlA = {
    x: x + inwardX * randomRange(seed + 79, 6.2, 10.4) + tangentX * randomRange(seed + 83, -5.2, 5.2),
    y: y + inwardY * randomRange(seed + 89, 5.2, 8.8) + tangentY * randomRange(seed + 97, -4.8, 4.8),
    z: z + randomRange(seed + 101, -0.95, 0.95),
  };
  const entryControlB = {
    x: lerp(x, entryTarget.x, 0.74) + tangentX * randomRange(seed + 103, -3.2, 3.2) + inwardX * randomRange(seed + 107, 0.8, 2.6),
    y: lerp(y, entryTarget.y, 0.74) + tangentY * randomRange(seed + 109, -3, 3) + inwardY * randomRange(seed + 113, 0.6, 2.3),
    z: lerp(z, entryTarget.z, 0.74) + randomRange(seed + 127, -0.55, 0.85),
  };
  return {
    hue: randomRange(seed + 31, 175, 235),
    seed,
    phase: randomRange(seed + 37, 0, Math.PI * 2),
    lorenz: {
      x: randomRange(seed + 41, -12, 12),
      y: randomRange(seed + 43, -8, 8),
      z: randomRange(seed + 47, 8, 30),
    },
    leafLineIndex: 0,
    bloomLineIndex: 0,
    leafOffset: randomRange(seed + 53, 0, 1),
    entryStart: { x, y, z },
    entryTarget,
    entryControlA,
    entryControlB,
    entryDelaySec: randomRange(seed + 71, 0, 0.55),
    entryDurationSec: randomRange(seed + 73, 1.65, 2.45),
    trail,
  };
}

function updateRibbon(ribbon, dt, elapsed, phaseState, leafCore, leafCloud, leafLines, bloomLines, ribbonIndex) {
  const phase = phaseState && typeof phaseState === "object" ? phaseState : {};
  const settle = clamp01(Number(phase.settle) || 0);
  const collapseIn = clamp01(Number(phase.collapseIn) || 0);
  const holdIn = clamp01(Number(phase.holdIn) || 0);
  const bloomOut = clamp01(Number(phase.bloomOut) || 0);

  const entryDelay = Math.max(0, Number(ribbon.entryDelaySec) || 0);
  const entryDuration = Math.max(0.001, Number(ribbon.entryDurationSec) || 0.001);
  const entryProgress = clamp01((elapsed - entryDelay) / entryDuration);
  if (entryProgress < 1) {
    const e = easeInOutCubic(entryProgress);
    const start = ribbon.entryStart || { x: 0, y: 0, z: 0 };
    const target = ribbon.entryTarget || { x: 0, y: 0, z: 0 };
    const controlA = ribbon.entryControlA || lerpPoint(start, target, 0.36);
    const controlB = ribbon.entryControlB || lerpPoint(start, target, 0.74);
    const base = cubicBezierPoint(start, controlA, controlB, target, e);
    const arc = Math.sin(e * Math.PI);
    const drift = Math.pow(1 - e, 0.65);
    const head = {
      x: base.x + Math.cos(elapsed * 2.2 + ribbon.phase * 1.13) * arc * 0.36 + Math.sin(elapsed * 0.93 + ribbon.phase * 0.67) * drift * 0.22,
      y: base.y + Math.sin(elapsed * 2.45 + ribbon.phase * 0.91) * arc * 0.3 + Math.cos(elapsed * 1.21 + ribbon.phase * 1.4) * drift * 0.17,
      z: base.z + Math.sin(elapsed * 1.68 + ribbon.phase * 0.73) * arc * 0.18,
    };
    ribbon.trail.unshift(head);
    ribbon.trail.pop();
    return;
  }

  const phaseElapsed = elapsed - entryDelay - entryDuration;
  const sigma = 10;
  const rho = 28;
  const beta = 8 / 3;
  const vortex = clamp01((phaseElapsed - 1.2) / 8.5);
  const vigor = 0.75 + (1 - settle) * 0.9;

  const lx = ribbon.lorenz.x;
  const ly = ribbon.lorenz.y;
  const lz = ribbon.lorenz.z;
  const dx = sigma * (ly - lx);
  const dy = lx * (rho - lz) - ly;
  const dz = lx * ly - beta * lz;
  ribbon.lorenz.x += dx * dt * vigor * 0.23;
  ribbon.lorenz.y += dy * dt * vigor * 0.23;
  ribbon.lorenz.z += dz * dt * vigor * 0.23;

  const attractX = ribbon.lorenz.x * 0.16;
  const attractY = ribbon.lorenz.y * 0.11;
  const attractZ = (ribbon.lorenz.z - 22) * 0.1;
  const spiral = 1 - settle;
  const pulse = Math.sin(phaseElapsed * 0.85 + ribbon.phase) * 0.45;
  const swirlX = Math.cos(phaseElapsed * 0.7 + ribbon.phase) * (1.8 + pulse) * spiral;
  const swirlY = Math.sin(phaseElapsed * 0.7 + ribbon.phase * 1.3) * (1.35 + pulse) * spiral;
  const swirlZ = Math.sin(phaseElapsed * 0.45 + ribbon.phase * 1.7) * 0.9 * spiral;
  let head = {
    x: attractX * vortex + swirlX,
    y: attractY * vortex + swirlY,
    z: attractZ * vortex + swirlZ,
  };

  if (settle > 0) {
    const line = leafLines[ribbon.leafLineIndex] || [];
    const bloomLine = bloomLines[ribbon.bloomLineIndex] || line;
    let target = leafCloud[(ribbonIndex * 17) % leafCloud.length];
    if (line.length) {
      const idx = Math.floor(clamp01(ribbon.leafOffset) * Math.max(0, line.length - 1));
      target = line[idx] || line[line.length - 1] || target;
    }

    const centerPulse = (1 - bloomOut) * 0.12;
    const centerTarget = {
      x: leafCore.x + Math.cos(elapsed * 1.9 + ribbon.phase) * centerPulse * (0.4 + 0.6 * (1 - holdIn)),
      y: leafCore.y + Math.sin(elapsed * 2.1 + ribbon.phase * 1.3) * centerPulse * 0.78 * (0.4 + 0.6 * (1 - holdIn)),
      z: leafCore.z + Math.sin(elapsed * 1.35 + ribbon.phase * 0.7) * centerPulse * 0.42,
    };

    if (collapseIn > 0) {
      const c = easeInOutCubic(collapseIn);
      head = lerpPoint(head, centerTarget, c);
    }
    if (holdIn > 0 && bloomOut <= 0) {
      const h = easeInOutCubic(holdIn);
      head = lerpPoint(head, centerTarget, 0.88 + h * 0.12);
    }
    if (bloomOut > 0) {
      const b = easeInOutCubic(bloomOut);
      if (bloomLine.length) {
        const bloomTargetIdx = Math.floor((0.86 + clamp01(ribbon.leafOffset) * 0.14) * Math.max(0, bloomLine.length - 1));
        const bloomIdx = Math.max(0, Math.min(bloomTargetIdx, Math.floor(bloomTargetIdx * b)));
        const bloomHead = bloomLine[bloomIdx] || centerTarget;
        head = bloomHead;
      } else {
        head = lerpPoint(centerTarget, target, b);
      }
    }
  }

  ribbon.trail.unshift(head);
  ribbon.trail.pop();
}

function lineCoreFlowMeta(line, corePoint) {
  const source = Array.isArray(line) ? line : [];
  if (source.length < 2) {
    return {
      centerProgress: 0,
      outwardSign: 1,
    };
  }

  const core = corePoint || { x: 0, y: 0, z: 0 };
  let nearestIndex = 0;
  let nearestDistanceSq = Number.POSITIVE_INFINITY;
  for (let index = 0; index < source.length; index += 1) {
    const point = source[index];
    const dx = (Number(point && point.x) || 0) - (Number(core.x) || 0);
    const dy = (Number(point && point.y) || 0) - (Number(core.y) || 0);
    const dz = (Number(point && point.z) || 0) - (Number(core.z) || 0);
    const distanceSq = dx * dx + dy * dy + dz * dz;
    if (distanceSq < nearestDistanceSq) {
      nearestDistanceSq = distanceSq;
      nearestIndex = index;
    }
  }

  const startPoint = source[0];
  const endPoint = source[source.length - 1];
  const startDistanceSq =
    Math.pow((Number(startPoint && startPoint.x) || 0) - (Number(core.x) || 0), 2)
    + Math.pow((Number(startPoint && startPoint.y) || 0) - (Number(core.y) || 0), 2)
    + Math.pow((Number(startPoint && startPoint.z) || 0) - (Number(core.z) || 0), 2);
  const endDistanceSq =
    Math.pow((Number(endPoint && endPoint.x) || 0) - (Number(core.x) || 0), 2)
    + Math.pow((Number(endPoint && endPoint.y) || 0) - (Number(core.y) || 0), 2)
    + Math.pow((Number(endPoint && endPoint.z) || 0) - (Number(core.z) || 0), 2);

  return {
    centerProgress: nearestIndex / Math.max(1, source.length - 1),
    outwardSign: endDistanceSq >= startDistanceSq ? 1 : -1,
  };
}

function strokeProjectedLineSpan(
  ctx,
  line,
  flowMeta,
  flowLoop,
  elapsedSec,
  flowSpeed,
  linePhase,
  flowEnergy,
  rotY,
  rotX,
  width,
  height,
  globalScale,
  depth,
  palette,
  baseWidth,
) {
  const source = Array.isArray(line) ? line : [];
  if (source.length < 2 || flowEnergy <= 0) {
    return;
  }

  const projected = new Array(source.length);
  for (let index = 0; index < source.length; index += 1) {
    projected[index] = projectPoint(rotatePoint(source[index], rotY, rotX), width, height, globalScale, depth);
  }

  const directionSign = Number(flowMeta && flowMeta.outwardSign) < 0 ? -1 : 1;
  const centerProgress = clamp01(Number(flowMeta && flowMeta.centerProgress));
  const waveCount = flowLoop ? 3.1 : 2.55;
  const primaryPhase = ((elapsedSec * flowSpeed + linePhase) % 1 + 1) % 1;
  const secondaryPhase = ((elapsedSec * (flowSpeed * 0.62) + linePhase * 1.37 + 0.19) % 1 + 1) % 1;
  const hue = palette.coreHue.toFixed(1);
  const sat = Math.min(100, palette.coreSat + 8).toFixed(1);
  const glowLight = (palette.coreLight + 17).toFixed(1);
  const coreLight = (palette.coreLight + 26).toFixed(1);

  for (let index = 1; index < source.length; index += 1) {
    const a = projected[index - 1];
    const b = projected[index];
    if ((!a || !a.visible) && (!b || !b.visible)) {
      continue;
    }

    const tMid = (index - 0.5) / Math.max(1, source.length - 1);
    let outward = tMid;
    if (!flowLoop) {
      if (directionSign >= 0) {
        const range = Math.max(0.001, 1 - centerProgress);
        outward = (tMid - centerProgress) / range;
      } else {
        const range = Math.max(0.001, centerProgress);
        outward = (centerProgress - tMid) / range;
      }
      if (outward < 0 || outward > 1) {
        continue;
      }
      outward = clamp01(outward);
    }

    const wavePos = outward * waveCount;
    const primaryCarrier = 0.5 + 0.5 * Math.sin((wavePos - primaryPhase) * Math.PI * 2);
    const secondaryCarrier = 0.5 + 0.5 * Math.sin((wavePos * 0.61 - secondaryPhase) * Math.PI * 2);
    const ridge = Math.pow(primaryCarrier, 2.45) * (0.74 + 0.26 * secondaryCarrier);
    const sustain = 0.26 + 0.74 * ridge;
    const glowAlpha = (flowLoop ? 0.14 : 0.18) * flowEnergy * sustain;
    const coreAlpha = (flowLoop ? 0.22 : 0.28) * flowEnergy * (0.2 + 0.8 * ridge);

    ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${glowLight}%, ${(glowAlpha * 0.62).toFixed(3)})`;
    ctx.lineWidth = baseWidth * 1.95;
    ctx.beginPath();
    if (a && a.visible) {
      ctx.moveTo(a.x, a.y);
    } else {
      ctx.moveTo(b.x, b.y);
    }
    if (b && b.visible) {
      ctx.lineTo(b.x, b.y);
    } else {
      ctx.lineTo(a.x, a.y);
    }
    ctx.stroke();

    ctx.strokeStyle = `hsla(${hue}, ${sat}%, ${coreLight}%, ${coreAlpha.toFixed(3)})`;
    ctx.lineWidth = baseWidth;
    ctx.beginPath();
    if (a && a.visible) {
      ctx.moveTo(a.x, a.y);
    } else {
      ctx.moveTo(b.x, b.y);
    }
    if (b && b.visible) {
      ctx.lineTo(b.x, b.y);
    } else {
      ctx.lineTo(a.x, a.y);
    }
    ctx.stroke();
  }
}

function drawLeafSigil(controller, elapsedSec, settleEase, revealProgress, rotY, rotX, width, height, globalScale, depth, palette) {
  if (revealProgress <= 0) {
    return;
  }
  const { ctx, sigilLines, leafCore } = controller;
  const revealEase = easeInOutCubic(revealProgress);
  const pulse = 0.5 + 0.5 * Math.sin(elapsedSec * 1.16);
  const flowEnergy = revealEase * (0.44 + 0.56 * settleEase);
  const flowSpeedBase = lerp(0.18, 0.31, settleEase);
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let index = 0; index < sigilLines.length; index += 1) {
    const line = sigilLines[index];
    if (!Array.isArray(line) || line.length < 2) {
      continue;
    }
    const isEdge = index < 2;
    const isSpine = index === 2;
    const isPerimeterLoop = index >= sigilLines.length - 2;
    ctx.beginPath();
    let moved = false;
    for (let pointIndex = 0; pointIndex < line.length; pointIndex += 1) {
      const projected = projectPoint(rotatePoint(line[pointIndex], rotY, rotX), width, height, globalScale, depth);
      if (!projected.visible) {
        continue;
      }
      if (!moved) {
        ctx.moveTo(projected.x, projected.y);
        moved = true;
      } else {
        ctx.lineTo(projected.x, projected.y);
      }
    }
    if (!moved) {
      continue;
    }
    const baseAlpha = isPerimeterLoop
      ? 0.33 + 0.1 * pulse
      : isEdge || isSpine
        ? 0.4
        : 0.3 + 0.06 * settleEase;
    const lineAlpha = baseAlpha * revealEase;
    const lightBoost = isPerimeterLoop ? 6 : isEdge || isSpine ? 10 : 3;
    ctx.strokeStyle = `hsla(${palette.sigilHue.toFixed(1)}, ${palette.sigilSat.toFixed(1)}%, ${(palette.sigilLight + lightBoost).toFixed(1)}%, ${lineAlpha.toFixed(3)})`;
    ctx.lineWidth = isPerimeterLoop ? 1.95 : isEdge || isSpine ? 1.85 : 1.35;
    ctx.stroke();

    if (flowEnergy > 0.04 && line.length > 3) {
      const flowLoop = isPerimeterLoop;
      const flowMeta = lineCoreFlowMeta(line, leafCore);
      const flowSpeed = flowSpeedBase + (index % 7) * 0.01 + (flowLoop ? 0.055 : 0);
      const linePhase = index * 0.071 + (flowLoop ? 0.21 : 0);
      const flowWidth = flowLoop ? 1.52 : isEdge || isSpine ? 1.44 : 1.32;
      strokeProjectedLineSpan(
        ctx,
        line,
        flowMeta,
        flowLoop,
        elapsedSec,
        flowSpeed,
        linePhase,
        flowEnergy,
        rotY,
        rotX,
        width,
        height,
        globalScale,
        depth,
        palette,
        flowWidth,
      );
    }
  }

  const coreProjected = projectPoint(rotatePoint(leafCore, rotY, rotX), width, height, globalScale, depth);
  if (coreProjected.visible) {
    const coreRadius = Math.min(width, height) * lerp(0.016, 0.024, settleEase) * revealEase;
    const coreGlow = ctx.createRadialGradient(
      coreProjected.x,
      coreProjected.y,
      0,
      coreProjected.x,
      coreProjected.y,
      coreRadius,
    );
    coreGlow.addColorStop(0, `hsla(${palette.coreHue.toFixed(1)}, ${Math.min(100, palette.coreSat + 4).toFixed(1)}%, ${(palette.coreLight + 10).toFixed(1)}%, ${(0.94 * revealEase).toFixed(3)})`);
    coreGlow.addColorStop(0.42, `hsla(${palette.coreHue.toFixed(1)}, ${palette.coreSat.toFixed(1)}%, ${palette.coreLight.toFixed(1)}%, ${(0.62 * revealEase).toFixed(3)})`);
    coreGlow.addColorStop(1, "rgba(120, 198, 255, 0)");
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(coreProjected.x, coreProjected.y, coreRadius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

let victoryController = null;

function stopController() {
  if (!victoryController) {
    return;
  }
  if (victoryController.rafId) {
    window.cancelAnimationFrame(victoryController.rafId);
  }
  if (victoryController.onResize) {
    window.removeEventListener("resize", victoryController.onResize);
  }
  if (victoryController.root && victoryController.root.classList) {
    victoryController.root.classList.remove("victory-mode");
  }
  victoryController = null;
}

function draw(controller, now) {
  const { canvas, ctx } = controller;
  const width = Number(controller.width || canvas.width || 1);
  const height = Number(controller.height || canvas.height || 1);
  const elapsed = (now - controller.startedAt) / 1000;
  const colorProgress = clamp01(elapsed / controller.colorDurationSec);
  const settle = clamp01((elapsed - controller.settleStartSec) / controller.settleDurationSec);
  const settlePhases = {
    settle,
    collapseIn: clamp01((settle - controller.collapseStart) / Math.max(0.001, controller.collapseEnd - controller.collapseStart)),
    holdIn: clamp01((settle - controller.collapseEnd) / Math.max(0.001, controller.bloomStart - controller.collapseEnd)),
    bloomOut: clamp01((settle - controller.bloomStart) / Math.max(0.001, 1 - controller.bloomStart)),
  };
  const settleEase = easeInOutCubic(settle);
  const leafReveal = settlePhases.bloomOut;
  const leafReady = leafReveal >= 0.999;
  const palette = convergencePalette(colorProgress);
  const dt = Math.min(0.035, Math.max(0.008, controller.lastNow ? (now - controller.lastNow) / 1000 : 0.016));
  controller.lastNow = now;

  ctx.clearRect(0, 0, width, height);
  const backdrop = ctx.createRadialGradient(
    width * 0.5,
    height * 0.44,
    0,
    width * 0.5,
    height * 0.52,
    Math.max(width, height) * 0.82,
  );
  backdrop.addColorStop(
    0,
    `hsla(${palette.backgroundHue.toFixed(1)}, ${palette.backgroundSat.toFixed(1)}%, ${palette.backgroundLight.toFixed(1)}%, 0.32)`,
  );
  backdrop.addColorStop(0.52, "rgba(4, 10, 24, 0.42)");
  backdrop.addColorStop(1, "rgba(1, 2, 8, 0.95)");
  ctx.fillStyle = backdrop;
  ctx.fillRect(0, 0, width, height);
  const fade = lerp(0.13, 0.07, settleEase);
  ctx.fillStyle = `rgba(2, 6, 16, ${fade})`;
  ctx.fillRect(0, 0, width, height);

  const rotY = now * 0.00021;
  const rotX = 0.39 + Math.sin(now * 0.00016) * 0.04;
  const globalScale = Math.min(width, height) * 0.48;
  const projectionDepth = 11;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < controller.ribbons.length; i += 1) {
    const ribbon = controller.ribbons[i];
    updateRibbon(
      ribbon,
      dt,
      elapsed,
      settlePhases,
      controller.leafCore,
      controller.leafCloud,
      controller.leafLines,
      controller.bloomLines,
      i,
    );
    const hueShift = Math.sin(elapsed * 0.55 + ribbon.phase) * 8 + ((ribbon.seed || 0) % 7 - 3) * 1.5;
    const hue = palette.ribbonHue + hueShift;
    const saturation = palette.ribbonSat;
    const lightness = palette.ribbonLight;
    const lineAlpha = palette.ribbonAlpha;
    ctx.strokeStyle = `hsla(${hue.toFixed(1)}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%, ${lineAlpha.toFixed(3)})`;
    ctx.lineWidth = lerp(2.0, 2.6, settleEase);
    ctx.beginPath();
    let moved = false;
    for (let j = 0; j < ribbon.trail.length; j += 1) {
      const point = rotatePoint(ribbon.trail[j], rotY, rotX);
      const projected = projectPoint(point, width, height, globalScale, projectionDepth);
      if (!projected.visible) {
        continue;
      }
      if (!moved) {
        ctx.moveTo(projected.x, projected.y);
        moved = true;
      } else {
        ctx.lineTo(projected.x, projected.y);
      }
    }
    if (moved) {
      ctx.stroke();
    }
  }

  drawLeafSigil(
    controller,
    elapsed,
    settleEase,
    leafReveal,
    rotY,
    rotX,
    width,
    height,
    globalScale,
    projectionDepth,
    palette,
  );

  if (!leafReady) {
    controller.symbolTracers = [];
    controller.tracerGateOpened = false;
  } else {
    if (!controller.tracerGateOpened) {
      controller.tracerGateOpened = true;
      const firstDelaySeed = controller.traceSeed * 19 + elapsed * 7;
      controller.nextTracerAtSec = elapsed + randomRange(firstDelaySeed, 0.42, 1.25);
    }

    if (controller.symbolLibrary.length && elapsed >= controller.nextTracerAtSec) {
      if (controller.symbolTracers.length < 5) {
        const tracer = createSymbolTracer(controller, elapsed);
        if (tracer) {
          controller.symbolTracers.push(tracer);
        }
      }
      const delaySeed = controller.traceSeed * 29 + elapsed * 11;
      controller.nextTracerAtSec = elapsed + randomRange(delaySeed, 2.3, 4.9);
    }

    const activeTracers = [];
    for (let index = 0; index < controller.symbolTracers.length; index += 1) {
      const tracer = controller.symbolTracers[index];
      const keep = drawSymbolTracer(
        controller,
        tracer,
        elapsed,
        dt,
        rotY,
        rotX,
        width,
        height,
        globalScale,
        projectionDepth,
        palette,
      );
      if (keep) {
        activeTracers.push(tracer);
      }
    }
    controller.symbolTracers = activeTracers;
  }

  const centerFocusBoost = settlePhases.holdIn * (1 - settlePhases.bloomOut);
  const coreGlow = lerp(0.24, 0.5, settleEase) + centerFocusBoost * 0.34;
  const glowRadius = Math.min(width, height) * (0.07 + settleEase * 0.07 + centerFocusBoost * 0.018);
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, glowRadius);
  const centerHue = palette.coreHue;
  const centerSat = palette.coreSat;
  const centerLight = palette.coreLight;
  const midHue = palette.midHue;
  const midSat = palette.midSat;
  const midLight = palette.midLight;
  gradient.addColorStop(0, `hsla(${centerHue.toFixed(1)}, ${centerSat.toFixed(1)}%, ${centerLight.toFixed(1)}%, ${coreGlow.toFixed(3)})`);
  gradient.addColorStop(0.55, `hsla(${midHue.toFixed(1)}, ${midSat.toFixed(1)}%, ${midLight.toFixed(1)}%, ${(coreGlow * 0.62).toFixed(3)})`);
  gradient.addColorStop(1, "rgba(12, 24, 52, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(width * 0.5, height * 0.5, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  controller.caption.textContent = "Five Years Down. One Hundred and Fifty-Two to Go";

  controller.rafId = window.requestAnimationFrame((nextNow) => draw(controller, nextNow));
}

export function mountVictoryScreen(root) {
  if (!root) {
    return;
  }
  if (victoryController && victoryController.root === root) {
    return;
  }

  stopController();

  root.classList.add("victory-mode");
  root.innerHTML = `
    <section class="victory-screen" aria-label="Final Victory Screen">
      <canvas class="victory-canvas" data-victory-canvas></canvas>
      <div class="victory-overlay">
        <h1>Convergence</h1>
        <p data-victory-caption>The End</p>
      </div>
    </section>
  `;

  const canvas = root.querySelector("[data-victory-canvas]");
  const caption = root.querySelector("[data-victory-caption]");
  if (!(canvas instanceof HTMLCanvasElement) || !(caption instanceof HTMLElement)) {
    return;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const leafGuides = buildLeafGuideSet();
  const leafCloud = leafGuides.leafCloud;
  const leafLines = leafGuides.leafLines;
  const bloomLines = leafGuides.bloomLines;
  const sigilLines = leafGuides.sigilLines;
  const leafCore = leafGuides.core;
  const ribbons = Array.from({ length: 88 }, (_, index) => createRibbon(index, 96));
  for (let index = 0; index < ribbons.length; index += 1) {
    ribbons[index].leafLineIndex = index % leafLines.length;
    ribbons[index].bloomLineIndex = index % Math.max(1, bloomLines.length);
  }
  const symbolLibrary = buildSymbolTraceLibrary();

  const resize = () => {
    const ratio = window.devicePixelRatio || 1;
    const bounds = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.floor(bounds.width * ratio));
    canvas.height = Math.max(1, Math.floor(bounds.height * ratio));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (victoryController) {
      victoryController.width = canvas.width;
      victoryController.height = canvas.height;
    }
  };

  victoryController = {
    root,
    canvas,
    ctx,
    caption,
    leafCloud,
    leafLines,
    bloomLines,
    sigilLines,
    leafCore,
    ribbons,
    symbolLibrary,
    symbolTracers: [],
    nextTracerAtSec: 0,
    tracerGateOpened: false,
    traceSeed: 11,
    startedAt: performance.now(),
    width: canvas.width,
    height: canvas.height,
    settleStartSec: 15,
    settleDurationSec: 13.5,
    collapseStart: 0.72,
    collapseEnd: 0.84,
    bloomStart: 0.9,
    colorDurationSec: 28.5,
    lastNow: 0,
    rafId: 0,
    onResize: resize,
  };

  window.addEventListener("resize", resize);
  resize();
  victoryController.rafId = window.requestAnimationFrame((now) => draw(victoryController, now));
}

export function unmountVictoryScreen() {
  stopController();
}