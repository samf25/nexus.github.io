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

function buildLeafPointCloud(countU = 36, countV = 24) {
  const points = [];
  for (let ui = 0; ui < countU; ui += 1) {
    const u = ui / (countU - 1);
    const y = (u - 0.52) * 3.15;
    const width = Math.pow(Math.sin(Math.PI * clamp01(u)), 0.88) * (1 - 0.34 * u);
    for (let vi = 0; vi < countV; vi += 1) {
      const v = (vi / (countV - 1)) * 2 - 1;
      const x = v * (1.25 * width);
      const spine = (1 - Math.abs(v)) * (0.12 + 0.08 * Math.sin(u * Math.PI * 2.6));
      const edgeCurl = 0.18 * (Math.abs(v) ** 1.55) * (u - 0.18);
      const z = spine - edgeCurl;
      points.push({ x, y, z });
    }
  }
  return points;
}

function buildLeafWireframeLines(countU = 26, countV = 18) {
  const lines = [];
  for (let ui = 0; ui < countU; ui += 1) {
    const line = [];
    const u = ui / (countU - 1);
    const y = (u - 0.52) * 3.2;
    const width = Math.pow(Math.sin(Math.PI * clamp01(u)), 0.92) * (1 - 0.34 * u);
    for (let vi = 0; vi < countV; vi += 1) {
      const v = (vi / (countV - 1)) * 2 - 1;
      const x = v * (1.28 * width);
      const rib = (1 - Math.abs(v)) * (0.11 + 0.07 * Math.sin(u * Math.PI * 2.2));
      const edgeCurl = 0.17 * (Math.abs(v) ** 1.48) * (u - 0.15);
      const z = rib - edgeCurl;
      line.push({ x, y, z });
    }
    lines.push(line);
  }
  for (let vi = 0; vi < countV; vi += 1) {
    const line = [];
    const v = (vi / (countV - 1)) * 2 - 1;
    for (let ui = 0; ui < countU; ui += 1) {
      const u = ui / (countU - 1);
      const y = (u - 0.52) * 3.2;
      const width = Math.pow(Math.sin(Math.PI * clamp01(u)), 0.92) * (1 - 0.34 * u);
      const x = v * (1.28 * width);
      const rib = (1 - Math.abs(v)) * (0.11 + 0.07 * Math.sin(u * Math.PI * 2.2));
      const edgeCurl = 0.17 * (Math.abs(v) ** 1.48) * (u - 0.15);
      const z = rib - edgeCurl;
      line.push({ x, y, z });
    }
    lines.push(line);
  }
  return lines;
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
    leafOffset: randomRange(seed + 53, 0, 1),
    trail,
  };
}

function updateRibbon(ribbon, dt, elapsed, settle, leafCloud, leafLines, ribbonIndex) {
  const sigma = 10;
  const rho = 28;
  const beta = 8 / 3;
  const vortex = clamp01((elapsed - 1.2) / 8.5);
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
  const pulse = Math.sin(elapsed * 0.85 + ribbon.phase) * 0.45;
  const swirlX = Math.cos(elapsed * 0.7 + ribbon.phase) * (1.8 + pulse) * spiral;
  const swirlY = Math.sin(elapsed * 0.7 + ribbon.phase * 1.3) * (1.35 + pulse) * spiral;
  const swirlZ = Math.sin(elapsed * 0.45 + ribbon.phase * 1.7) * 0.9 * spiral;
  let head = {
    x: attractX * vortex + swirlX,
    y: attractY * vortex + swirlY,
    z: attractZ * vortex + swirlZ,
  };

  if (settle > 0) {
    const line = leafLines[ribbon.leafLineIndex] || [];
    let target = leafCloud[(ribbonIndex * 17) % leafCloud.length];
    if (line.length) {
      const travel = (elapsed * 0.18 + ribbon.leafOffset) % 1;
      const idx = Math.floor(travel * line.length) % line.length;
      target = line[idx];
    }
    const s = easeInOutCubic(settle);
    head = {
      x: head.x * (1 - s) + target.x * s,
      y: head.y * (1 - s) + target.y * s,
      z: head.z * (1 - s) + target.z * s,
    };
  }

  ribbon.trail.unshift(head);
  ribbon.trail.pop();
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
  const settle = clamp01((elapsed - controller.settleStartSec) / controller.settleDurationSec);
  const settleEase = easeInOutCubic(settle);
  const dt = Math.min(0.035, Math.max(0.008, controller.lastNow ? (now - controller.lastNow) / 1000 : 0.016));
  controller.lastNow = now;

  ctx.clearRect(0, 0, width, height);
  const fade = lerp(0.14, 0.08, settleEase);
  ctx.fillStyle = `rgba(2, 6, 16, ${fade})`;
  ctx.fillRect(0, 0, width, height);

  const rotY = now * 0.00024;
  const rotX = 0.44 + Math.sin(now * 0.00023) * 0.09;
  const globalScale = Math.min(width, height) * 0.66;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < controller.ribbons.length; i += 1) {
    const ribbon = controller.ribbons[i];
    updateRibbon(ribbon, dt, elapsed, settle, controller.leafCloud, controller.leafLines, i);
    const autumnHue = 18 + ((ribbon.seed || 0) % 15);
    const hue = lerp(ribbon.hue, autumnHue, settleEase);
    const saturation = lerp(95, 62, settleEase);
    const lightness = lerp(74, 46, settleEase);
    const lineAlpha = lerp(0.15, 0.32, settleEase);
    ctx.strokeStyle = `hsla(${hue.toFixed(1)}, ${saturation.toFixed(1)}%, ${lightness.toFixed(1)}%, ${lineAlpha.toFixed(3)})`;
    ctx.lineWidth = lerp(2.0, 2.6, settleEase);
    ctx.beginPath();
    let moved = false;
    for (let j = 0; j < ribbon.trail.length; j += 1) {
      const point = rotatePoint(ribbon.trail[j], rotY, rotX);
      const projected = projectPoint(point, width, height, globalScale, 8.2);
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

  const coreGlow = lerp(0.24, 0.45, settleEase);
  const glowRadius = Math.min(width, height) * (0.07 + settleEase * 0.07);
  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.5, 0, width * 0.5, height * 0.5, glowRadius);
  const centerHue = lerp(205, 22, settleEase);
  const centerSat = lerp(92, 70, settleEase);
  const centerLight = lerp(80, 55, settleEase);
  const midHue = lerp(198, 16, settleEase);
  const midSat = lerp(80, 64, settleEase);
  const midLight = lerp(66, 34, settleEase);
  gradient.addColorStop(0, `hsla(${centerHue.toFixed(1)}, ${centerSat.toFixed(1)}%, ${centerLight.toFixed(1)}%, ${coreGlow.toFixed(3)})`);
  gradient.addColorStop(0.55, `hsla(${midHue.toFixed(1)}, ${midSat.toFixed(1)}%, ${midLight.toFixed(1)}%, ${(coreGlow * 0.62).toFixed(3)})`);
  gradient.addColorStop(1, "rgba(12, 21, 45, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(width * 0.5, height * 0.5, glowRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  controller.caption.textContent = "The End";

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

  const leafCloud = buildLeafPointCloud(40, 26);
  const leafLines = buildLeafWireframeLines(30, 20);
  const ribbons = Array.from({ length: 88 }, (_, index) => createRibbon(index, 96));
  for (let index = 0; index < ribbons.length; index += 1) {
    ribbons[index].leafLineIndex = index % leafLines.length;
  }

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
    ribbons,
    startedAt: performance.now(),
    width: canvas.width,
    height: canvas.height,
    settleStartSec: 15,
    settleDurationSec: 13.5,
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
