function normalizeToken(value) {
  return String(value == null ? "" : value)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function parseFractionToken(token) {
  if (!token.includes("/")) {
    return null;
  }
  const [left, right] = token.split("/");
  if (!left || !right) {
    return null;
  }
  const numerator = Number(left);
  const denominator = Number(right);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) {
    return null;
  }
  return numerator / denominator;
}

export function parseNumericAnswer(value) {
  const token = normalizeToken(value);
  if (!token) {
    return NaN;
  }

  const fraction = parseFractionToken(token);
  if (Number.isFinite(fraction)) {
    return fraction;
  }

  const numeric = Number(token);
  return Number.isFinite(numeric) ? numeric : NaN;
}

export function numberCheck(expected, tolerance = 1e-6) {
  return (value) => {
    const parsed = parseNumericAnswer(value);
    if (!Number.isFinite(parsed)) {
      return false;
    }
    return Math.abs(parsed - expected) <= tolerance;
  };
}

export function integerCheck(expected) {
  return (value) => {
    const parsed = parseNumericAnswer(value);
    if (!Number.isFinite(parsed)) {
      return false;
    }
    return Math.round(parsed) === expected && Math.abs(parsed - Math.round(parsed)) <= 1e-6;
  };
}

export function pairCheck(first, second) {
  return (value) => {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) {
      return false;
    }
    const split = raw
      .split(/[,\s]+/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (split.length !== 2) {
      return false;
    }
    const left = parseNumericAnswer(split[0]);
    const right = parseNumericAnswer(split[1]);
    if (!Number.isFinite(left) || !Number.isFinite(right)) {
      return false;
    }
    return Math.round(left) === first && Math.round(right) === second;
  };
}
