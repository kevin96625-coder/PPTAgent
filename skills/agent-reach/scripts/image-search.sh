#!/usr/bin/env bash
# Best-effort image search+download. NEVER blocks caller.
# usage: image-search.sh "<query>" "<out_path>"
set -uo pipefail
QUERY="${1:-}"; OUT="${2:-}"
if [[ -z "$QUERY" || -z "$OUT" ]]; then echo "usage: image-search.sh <query> <out_path>" >&2; exit 2; fi

# 1) Try registered MCP image search via mcporter (e.g. exa), if available.
if command -v mcporter >/dev/null 2>&1; then
  SERVERS="$(mcporter list 2>/dev/null || true)"
  if echo "$SERVERS" | grep -qi exa; then
    URL="$(mcporter call 'exa.image_search' --query "$QUERY" 2>/dev/null | grep -oE 'https?://[^" ]+\.(jpg|jpeg|png|webp)' | head -1 || true)"
    if [[ -n "${URL:-}" ]] && curl -fsSL "$URL" -o "$OUT" 2>/dev/null; then echo "$OUT"; exit 0; fi
  fi
fi

# 2) Fallback: Bing image search results page scrape via curl (best-effort, may be empty).
ENC="$(printf '%s' "$QUERY" | sed 's/ /+/g')"
HTML="$(curl -fsSL -A 'Mozilla/5.0' "https://www.bing.com/images/search?q=${ENC}" 2>/dev/null || true)"
URL="$(printf '%s' "$HTML" | grep -oE 'murl&quot;:&quot;[^&]+' | head -1 | sed 's/murl&quot;:&quot;//')"
if [[ -n "${URL:-}" ]] && curl -fsSL -A 'Mozilla/5.0' "$URL" -o "$OUT" 2>/dev/null; then
  # minimal sanity: file exists and >10KB (skip thumbnails/blanks)
  if [[ -f "$OUT" && $(wc -c <"$OUT") -gt 10240 ]]; then echo "$OUT"; exit 0; fi
fi

echo "no-image-source" >&2
exit 1
