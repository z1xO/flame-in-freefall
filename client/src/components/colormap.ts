// Polynomial fit of the "inferno" colormap; t in 0..1 -> [r, g, b] in 0..255.
const C = [[0.000218, 0.001651, -0.019481], [0.106513, 0.563956, 3.932712], [11.602493, -3.972854, -15.942394], [-41.703996, 17.436399, 44.354145], [77.162936, -33.402359, -81.807309], [-71.319428, 32.626064, 73.20952], [25.131126, -12.242669, -23.070325]];

export function inferno(t: number): [number, number, number] {
  t = Math.min(1, Math.max(0, t));
  const ch = (c: number) => { let v = C[6][c]; for (let k = 5; k >= 0; k--) v = v * t + C[k][c]; return Math.round(Math.min(1, Math.max(0, v)) * 255); };
  return [ch(0), ch(1), ch(2)];
}

export const T_RANGE: [number, number] = [300, 2700];
