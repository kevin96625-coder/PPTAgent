'use strict';

// Per-image USD prices (2026-06, see FEASIBILITY_SUBSCRIPTION_AUTH.md §3).
const PRICES = {
  'gemini-api': {
    'nano-banana': 0.039,
    'nano-banana-2': 0.067,
    'nano-banana-pro': 0.134,
  },
  'openai-api': {
    'gpt-image-2': 0.04,
  },
  // Direct-fetch OpenAI backend — same models/prices as openai-api.
  'openai-fetch': {
    'gpt-image-2': 0.04,
  },
};

const DEFAULT_MODEL = {
  'gemini-api': 'nano-banana-2',
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
      model: 'gpt-image-2',
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
