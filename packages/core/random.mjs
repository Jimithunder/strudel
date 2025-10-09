const xorwise = (x) => {
  const a = (x << 13) ^ x;
  const b = (a >> 17) ^ a;
  return (b << 5) ^ b;
};

// stretch 300 cycles over the range of [0,2**29 == 536870912) then apply the xorshift algorithm
const _frac = (x) => x - Math.trunc(x);

const timeToIntSeed = (x) => xorwise(Math.trunc(_frac(x / 300) * 536870912));

const intSeedToRand = (x) => (x % 536870912) / 536870912;

export const timeToRand = (x) => Math.abs(intSeedToRand(timeToIntSeed(x)));

const timeToRandsPrime = (seed, n) => {
  const result = [];
  // eslint-disable-next-line
  for (let i = 0; i < n; ++i) {
    result.push(intSeedToRand(seed));
    seed = xorwise(seed);
  }
  return result;
};

export const timeToRands = (t, n) => timeToRandsPrime(timeToIntSeed(t), n);

export function perlinNoise(t) {
  let ta = Math.floor(t);
  let tb = ta + 1;
  const smootherStep = (x) => 6.0 * x ** 5 - 15.0 * x ** 4 + 10.0 * x ** 3;
  const interp = (x) => (a) => (b) => a + smootherStep(x) * (b - a);
  const v = interp(t - ta)(timeToRand(ta))(timeToRand(tb));
  return v;
}

export function berlinNoise(t) {
  const prevRidgeStartIndex = Math.floor(t);
  const nextRidgeStartIndex = prevRidgeStartIndex + 1;

  const prevRidgeBottomPoint = timeToRand(prevRidgeStartIndex);
  const nextRidgeTopPoint = timeToRand(nextRidgeStartIndex) + prevRidgeBottomPoint;

  const currentPercent = (t - prevRidgeStartIndex) / (nextRidgeStartIndex - prevRidgeStartIndex);
  const interp = (a, b, t) => {
    return a + (b - a) * t;
  };
  return interp(prevRidgeBottomPoint, nextRidgeTopPoint, currentPercent) / 2;
}
