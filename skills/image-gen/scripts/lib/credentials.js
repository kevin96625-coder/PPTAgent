'use strict';
const fs = require('node:fs');
const path = require('node:path');

const ENV_FILE = path.resolve(__dirname, '..', '.env');
const LOADED = { done: false, vars: {} };

function loadDotEnv() {
  if (LOADED.done) return LOADED.vars;
  LOADED.done = true;
  if (!fs.existsSync(ENV_FILE)) return LOADED.vars;
  const text = fs.readFileSync(ENV_FILE, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) {
      LOADED.vars[key] = val;
    }
  }
  return LOADED.vars;
}

function getCredential(name) {
  loadDotEnv();
  return process.env[name] || LOADED.vars[name] || '';
}

module.exports = { getCredential, loadDotEnv };
