'use strict';
function hexToRgb(hex) {
  let h = String(hex).trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex([r, g, b]) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function relLuminance(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrastRatio(a, b) {
  const la = relLuminance(a), lb = relLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
// Move `fill` toward white (lighten) or black (darken) in small steps until contrast vs bg >= target.
function adjustToContrast(fill, bg, target, dir) {
  if (contrastRatio(fill, bg) >= target) return fill;
  const rgb = hexToRgb(fill);
  if (!rgb) return fill;
  let cur = rgb.slice();
  for (let i = 0; i < 40; i++) {
    cur = cur.map((v) => dir === 'lighten' ? v + (255 - v) * 0.1 : v - v * 0.1);
    const hex = rgbToHex(cur);
    if (contrastRatio(hex, bg) >= target) return hex;
  }
  return dir === 'lighten' ? '#ffffff' : '#000000';
}
module.exports = { hexToRgb, rgbToHex, relLuminance, contrastRatio, adjustToContrast };
