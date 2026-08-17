#!/usr/bin/env node
/**
 * Assert production HTTPS / security headers for static hosting.
 *
 * CSP is host-provided via vercel.json and netlify.toml (not a <meta> tag).
 * A CSP meta fallback was skipped on purpose: the page embeds fighter art as
 * data: URLs and uses Web Audio; dual meta+header CSP is easy to misalign,
 * and frame-ancestors cannot be set from meta anyway. Deployed hosts must
 * send the Content-Security-Policy response header.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const REQUIRED = [
  "Strict-Transport-Security",
  "X-Content-Type-Options",
  "X-Frame-Options",
  "Content-Security-Policy",
  "Referrer-Policy",
  "Cache-Control",
];

function assertCacheControl(value, where) {
  if (!value) {
    fail(where + ": missing Cache-Control");
    return;
  }
  const v = String(value);
  const shortLived =
    /no-cache/i.test(v) ||
    /max-age\s*=\s*0/i.test(v);
  if (!shortLived) {
    fail(where + ": Cache-Control must be no-cache or max-age=0 for HTML");
  }
  if (!/must-revalidate/i.test(v) && !/no-cache/i.test(v)) {
    fail(where + ": Cache-Control should include must-revalidate (or no-cache)");
  }
  pass(where + " Cache-Control is short-lived for HTML");
}

const failures = [];
const notes = [];

function fail(msg) {
  failures.push(msg);
}

function pass(msg) {
  notes.push("OK  " + msg);
}

function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) {
    fail("missing file: " + rel);
    return null;
  }
  return fs.readFileSync(p, "utf8");
}

function assertHsts(value, where) {
  if (!/max-age\s*=\s*63072000/i.test(value)) {
    fail(where + ": HSTS max-age must be 63072000");
  }
  if (!/includeSubDomains/i.test(value)) {
    fail(where + ": HSTS must include includeSubDomains");
  }
  if (!/preload/i.test(value)) {
    fail(where + ": HSTS must include preload");
  }
}

function assertCsp(value, where) {
  if (!/'unsafe-inline'/.test(value)) {
    fail(where + ": CSP must allow 'unsafe-inline' for the single-file page");
  }
  if (!/\bdata:/.test(value)) {
    fail(where + ": CSP must allow data: (canvas art embeds)");
  }
  if (!/\bblob:/.test(value)) {
    fail(where + ": CSP must allow blob: for images/media");
  }
  if (!/connect-src[^;]*'self'/.test(value)) {
    fail(where + ": CSP connect-src must include 'self'");
  }
  if (!/connect-src[^;]*https:\/\/\*\.supabase\.co/.test(value)) {
    fail(where + ": CSP connect-src must allow https://*.supabase.co for optional cloud saves");
  } else {
    pass(where + " CSP connect-src allows Supabase");
  }
  if (!/script-src[^;]*https:\/\/unpkg\.com/.test(value)) {
    fail(where + ": CSP script-src must allow https://unpkg.com for TON Connect UI");
  } else {
    pass(where + " CSP script-src allows unpkg for TON Connect");
  }
  if (!/connect-src[^;]*bridge\.tonapi\.io/.test(value)) {
    fail(where + ": CSP connect-src must allow bridge.tonapi.io for TON Connect");
  } else {
    pass(where + " CSP connect-src allows TON bridges");
  }
}

function checkVercel(raw) {
  if (raw == null) return;
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch (e) {
    fail("vercel.json: invalid JSON (" + e.message + ")");
    return;
  }

  const blocks = Array.isArray(cfg.headers) ? cfg.headers : [];
  if (!blocks.length) {
    fail("vercel.json: no headers blocks");
    return;
  }

  const flat = {};
  for (const block of blocks) {
    for (const h of block.headers || []) {
      if (h && h.key) flat[h.key] = String(h.value || "");
    }
  }

  for (const name of REQUIRED) {
    if (!(name in flat)) fail("vercel.json: missing header " + name);
    else pass("vercel.json has " + name);
  }

  if (flat["Strict-Transport-Security"]) {
    assertHsts(flat["Strict-Transport-Security"], "vercel.json HSTS");
  }
  if (flat["X-Content-Type-Options"] && flat["X-Content-Type-Options"] !== "nosniff") {
    fail("vercel.json: X-Content-Type-Options must be nosniff");
  }
  if (flat["X-Frame-Options"] && flat["X-Frame-Options"] !== "DENY") {
    fail("vercel.json: X-Frame-Options must be DENY");
  }
  if (flat["Referrer-Policy"] && flat["Referrer-Policy"] !== "no-referrer") {
    fail("vercel.json: Referrer-Policy must be no-referrer");
  }
  if (flat["Content-Security-Policy"]) {
    assertCsp(flat["Content-Security-Policy"], "vercel.json CSP");
  }
  assertCacheControl(flat["Cache-Control"], "vercel.json");
  if (!flat["Permissions-Policy"]) {
    fail("vercel.json: missing Permissions-Policy");
  } else if (!/camera=\(\)/.test(flat["Permissions-Policy"]) ||
             !/microphone=\(\)/.test(flat["Permissions-Policy"]) ||
             !/geolocation=\(\)/.test(flat["Permissions-Policy"])) {
    fail("vercel.json: Permissions-Policy must lock camera/microphone/geolocation");
  } else {
    pass("vercel.json Permissions-Policy locks camera/mic/geolocation");
  }

  const rewrites = Array.isArray(cfg.rewrites) ? cfg.rewrites : [];
  const rootRewrite = rewrites.some(
    (r) => r && r.source === "/" && /aqua-zero-heavens-arena\.html/.test(String(r.destination || ""))
  );
  if (!rootRewrite) fail("vercel.json: missing / rewrite to aqua-zero-heavens-arena.html");
  else pass("vercel.json rewrites / to aqua-zero-heavens-arena.html");
}

function headerValueFromToml(raw, name) {
  // Match Netlify [headers.values] assignments, including quoted multi-token values.
  const re = new RegExp(
    "^\\s*" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*=\\s*\"([^\"]*)\"",
    "m"
  );
  const m = raw.match(re);
  return m ? m[1] : null;
}

function checkNetlify(raw) {
  if (raw == null) return;
  if (!/\[\[headers\]\]/.test(raw)) {
    fail("netlify.toml: missing [[headers]]");
    return;
  }

  for (const name of REQUIRED) {
    const val = headerValueFromToml(raw, name);
    if (val == null) fail("netlify.toml: missing header " + name);
    else pass("netlify.toml has " + name);

    if (name === "Strict-Transport-Security" && val) assertHsts(val, "netlify.toml HSTS");
    if (name === "X-Content-Type-Options" && val && val !== "nosniff") {
      fail("netlify.toml: X-Content-Type-Options must be nosniff");
    }
    if (name === "X-Frame-Options" && val && val !== "DENY") {
      fail("netlify.toml: X-Frame-Options must be DENY");
    }
    if (name === "Referrer-Policy" && val && val !== "no-referrer") {
      fail("netlify.toml: Referrer-Policy must be no-referrer");
    }
    if (name === "Content-Security-Policy" && val) assertCsp(val, "netlify.toml CSP");
    if (name === "Cache-Control" && val) assertCacheControl(val, "netlify.toml");
  }

  const perm = headerValueFromToml(raw, "Permissions-Policy");
  if (!perm) fail("netlify.toml: missing Permissions-Policy");
  else if (!/camera=\(\)/.test(perm) || !/microphone=\(\)/.test(perm) || !/geolocation=\(\)/.test(perm)) {
    fail("netlify.toml: Permissions-Policy must lock camera/microphone/geolocation");
  } else {
    pass("netlify.toml Permissions-Policy locks camera/mic/geolocation");
  }

  if (!/to\s*=\s*"\/aqua-zero-heavens-arena\.html"/.test(raw)) {
    fail("netlify.toml: missing / -> aqua-zero-heavens-arena.html rewrite/redirect");
  } else {
    pass("netlify.toml maps / to aqua-zero-heavens-arena.html");
  }
}

function checkPageCspPolicy() {
  const candidates = [
    "aqua-zero-heavens-arena.html",
    path.join("src", "page.template.html"),
  ];
  let html = null;
  let used = null;
  for (const rel of candidates) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) {
      html = fs.readFileSync(p, "utf8");
      used = rel;
      break;
    }
  }
  if (!html) {
    fail("neither aqua-zero-heavens-arena.html nor src/page.template.html found");
    return;
  }

  const hasMeta = /http-equiv\s*=\s*["']Content-Security-Policy["']/i.test(html) ||
    /http-equiv\s*=\s*["']content-security-policy["']/i.test(html);

  if (hasMeta) {
    pass(used + " has CSP meta fallback");
  } else {
    // Documented policy: CSP (and the rest) come from the static host configs.
    pass(
      used +
        ": no CSP meta (intentional); CSP is host-provided via vercel.json / netlify.toml"
    );
  }
}

function checkGitignoreEnvHygiene() {
  const raw = read(".gitignore");
  if (raw == null) return;
  const lines = raw.split(/\r?\n/).map((l) => l.trim());
  const hasEnv = lines.indexOf(".env") >= 0;
  const hasEnvStar = lines.indexOf(".env.*") >= 0;
  if (!hasEnv) fail(".gitignore: missing .env");
  else pass(".gitignore ignores .env");
  if (!hasEnvStar) fail(".gitignore: missing .env.*");
  else pass(".gitignore ignores .env.*");
  if (lines.indexOf("!.env.example") >= 0) {
    pass(".gitignore keeps !.env.example exception");
  } else {
    notes.push("NOTE  .gitignore has no !.env.example (optional)");
  }
}

function checkSaveBackupSecuritySymbols() {
  const raw = read(path.join("src", "progress", "save-backup.js"));
  if (raw == null) return;
  if (!/\bSECURITY_LOG_KEY\b/.test(raw)) {
    fail("save-backup.js: missing SECURITY_LOG_KEY");
  } else {
    pass("save-backup.js defines SECURITY_LOG_KEY");
  }
  if (!/\bIMPORT_RATE_MAX\b/.test(raw)) {
    fail("save-backup.js: missing IMPORT_RATE_MAX");
  } else {
    pass("save-backup.js defines IMPORT_RATE_MAX");
  }
}

function checkRenderErrorHygiene() {
  const candidates = [
    "aqua-zero-heavens-arena.html",
    path.join("src", "page.template.html"),
  ];
  let html = null;
  let used = null;
  for (const rel of candidates) {
    const p = path.join(ROOT, rel);
    if (fs.existsSync(p)) {
      html = fs.readFileSync(p, "utf8");
      used = rel;
      break;
    }
  }
  if (!html) {
    fail("neither aqua-zero-heavens-arena.html nor src/page.template.html found for render hygiene");
    return;
  }

  // Bare Error object: console.error("render", err) / console.error('render',err)
  const bareErr =
    /console\.error\(\s*["']render["']\s*,\s*err\s*\)/.test(html) ||
    /console\.error\(\s*["']render["']\s*,\s*e\s*\)/.test(html);
  if (bareErr) {
    fail(
      used +
        ': console.error("render", err) logs bare Error; use message-only (err && err.message or String)'
    );
    return;
  }

  const messageOnly =
    /console\.error\(\s*["']render["']\s*,\s*[^)]*\.message/.test(html) ||
    /console\.error\(\s*["']render["']\s*,\s*String\s*\(/.test(html);
  if (messageOnly) {
    pass(used + " render catch logs message only");
  } else if (/console\.error\(\s*["']render["']/.test(html)) {
    pass(used + ' has console.error("render", ...) without bare err identifier');
  } else {
    pass(used + " has no console.error(\"render\", ...) pattern (ok)");
  }
}

checkVercel(read("vercel.json"));
checkNetlify(read("netlify.toml"));
checkPageCspPolicy();
checkGitignoreEnvHygiene();
checkSaveBackupSecuritySymbols();
checkRenderErrorHygiene();

if (failures.length) {
  console.log("FAIL");
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
}

console.log("PASS");
for (const n of notes) console.log("  " + n);
process.exit(0);
