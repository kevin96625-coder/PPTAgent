'use strict';

// Per-image USD prices (2026-11). gpt-image-2.6-* and gemini-3.1-flash-image
// entries are estimates pending official vendor sheets — adjust when published.
// gpt-image-2.5-* rows stay for legacy run records.
const PRICES = {
  'gemini-api': {
    'nano-banana': 0.039,
    'nano-banana-2': 0.067,
    'nano-banana-pro': 0.134,
  },
  'gemini-fetch': {
    'gemini-3.1-flash-image': 0.039,
  },
  'openai-api': {
    'gpt-image-2': 0.04,
    'gpt-image-2.5-flare': 0.04,
    'gpt-image-2.5-sunburst': 0.06,
    'gpt-image-2.6-flare': 0.04,
    'gpt-image-2.6-sunburst': 0.06,
  },
  // Direct-fetch OpenAI backend — same models/prices as openai-api.
  'openai-fetch': {
    'gpt-image-2': 0.04,
    'gpt-image-2.5-flare': 0.04,
    'gpt-image-2.5-sunburst': 0.06,
    'gpt-image-2.6-flare': 0.04,
    'gpt-image-2.6-sunburst': 0.06,
  },
};

const DEFAULT_MODEL = {
  'codex-cli': 'gpt-image-2.6-flare',
  'agy-cli': 'gemini-3.1-flash-image',
  'gemini-api': 'nano-banana-2',
  'gemini-fetch': 'gemini-3.1-flash-image',
  'openai-api': 'gpt-image-2',
  'openai-fetch': 'gpt-image-2',
};

/**
 * @param {{backend:string, model?:string, count:number}} opts
 * @returns {{estUsdTotal:number, meteredImages:number, quotaNote:string, model:(string|null)}}
 */
function estimate(opts) {
  const { backend, count } = opts;
  const n = Number(count) || 0;
  if (backend === 'codex-cli') {
    return {
      estUsdTotal: 0,
      meteredImages: 0,
      quotaNote: `Covered by ChatGPT subscription; image turns drain Codex quota ~3-5x faster than text (${n} images).`,
      model: opts.model || 'gpt-image-2.6-flare',
    };
  }
  if (backend === 'agy-cli') {
    return {
      estUsdTotal: 0,
      meteredImages: 0,
      quotaNote: `Covered by Google/Antigravity subscription via agy CLI (${n} images, no per-image billing).`,
      model: opts.model || 'gemini-3.1-flash-image',
    };
  }
  const table = PRICES[backend];
  if (!table) throw new Error(`estimate: unknown backend "${backend}"`);
  const model = opts.model || DEFAULT_MODEL[backend];
  const price = table[model];
  if (price == null) throw new Error(`estimate: unknown model "${model}" for ${backend}`);
  return {
    estUsdTotal: n * price,
    meteredImages: n,
    quotaNote: `Metered: ${n} × $${price} via ${backend}/${model}.`,
    model,
  };
}

module.exports = { estimate, PRICES, DEFAULT_MODEL };
