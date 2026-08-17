#!/usr/bin/env node
/* =====================================================================
   Aqua Zero Heavens Arena - brand logo embedder
   Luminara Digital

   Takes the AZ mark as a PNG, lifts it off whatever background it was
   rendered on, trims, downscales, and writes it into the page as a
   base64 data URI. The page stays a single self-contained file.

   Usage:
     node tools/embed-logo.js brand-logo.png
     node tools/embed-logo.js brand-logo.png --size 512
     node tools/embed-logo.js brand-logo.png --preview out.png   # look before you ship
     node tools/embed-logo.js brand-logo.png --page aqua-zero-heavens-arena.html

   Keying: the mark is blue. Anything neutral (r==g==b, any brightness) is
   background, whether that is white, grey or black. Pixels are scored by
   how far they sit from neutral, so a soft glow feathers out instead of
   leaving a hard disc, and the dark navy foot of the Z stays solid.
   Pass --keep-glow to retain the outer halo if the source has one.
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/* ---------------- PNG decode ---------------- */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let p = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  let palette = null, trns = null;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8), data = buf.slice(p + 8, p + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      depth = data[8]; ctype = data[9]; interlace = data[12];
    } else if (type === "PLTE") palette = data;
    else if (type === "tRNS") trns = data;
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (depth !== 8) throw new Error("only 8-bit PNGs are supported (got " + depth + ")");
  if (interlace) throw new Error("interlaced PNGs are not supported");
  const chan = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ctype];
  if (!chan) throw new Error("unsupported colour type " + ctype);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * chan;
  const out = Buffer.alloc(w * h * chan);
  let ip = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[ip++];
    const line = raw.slice(ip, ip + stride); ip += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y ? out.slice((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= chan ? cur[x - chan] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= chan ? prev[x - chan] : 0;
      let v = line[x];
      if (f === 1) v += a;
      else if (f === 2) v += b;
      else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      cur[x] = v & 255;
    }
  }
  // normalise everything to RGBA
  const rgba = Buffer.alloc(w * h * 4, 255);
  for (let i = 0; i < w * h; i++) {
    if (ctype === 6) { out.copy(rgba, i * 4, i * 4, i * 4 + 4); }
    else if (ctype === 2) { rgba[i*4]=out[i*3]; rgba[i*4+1]=out[i*3+1]; rgba[i*4+2]=out[i*3+2]; }
    else if (ctype === 0) { rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=out[i]; }
    else if (ctype === 4) { rgba[i*4]=rgba[i*4+1]=rgba[i*4+2]=out[i*2]; rgba[i*4+3]=out[i*2+1]; }
    else if (ctype === 3) {
      const ix = out[i];
      rgba[i*4]=palette[ix*3]; rgba[i*4+1]=palette[ix*3+1]; rgba[i*4+2]=palette[ix*3+2];
      rgba[i*4+3]= trns && ix < trns.length ? trns[ix] : 255;
    }
  }
  return { w, h, rgba };
}

/* ---------------- PNG encode ---------------- */
const CRCT = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRCT[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ---------------- keying ---------------- */
const smooth = (v, lo, hi) => Math.max(0, Math.min(1, (v - lo) / (hi - lo)));
function key(img, keepGlow) {
  const { w, h, rgba } = img;
  const out = Buffer.from(rgba);
  // distance from neutral grey: 0 for any pure grey/white/black, high for the mark
  const lo = keepGlow ? 3 : 12, hi = keepGlow ? 14 : 40;
  for (let i = 0; i < w * h; i++) {
    const r = rgba[i*4], g = rgba[i*4+1], b = rgba[i*4+2], a0 = rgba[i*4+3] / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    let a = smooth(mx - mn, lo, hi);
    // the deep navy foot reads as low-chroma but is unmistakably blue-dominant
    if (b - r > 14 || g - r > 14) a = Math.max(a, smooth(Math.max(b - r, g - r), 14, 30));
    out[i*4+3] = Math.round(255 * a * a0);
  }
  return { w, h, rgba: out };
}
function trim(img, pad) {
  const { w, h, rgba } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rgba[(y * w + x) * 4 + 3] > 8) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error("keying removed the whole image - wrong --keep-glow setting?");
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad);
  const nw = x1 - x0 + 1, nh = y1 - y0 + 1;
  const out = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y++)
    rgba.copy(out, y * nw * 4, ((y + y0) * w + x0) * 4, ((y + y0) * w + x0 + nw) * 4);
  return { w: nw, h: nh, rgba: out };
}
/* box downscale, premultiplied so transparent pixels do not bleed grey in */
function resize(img, target) {
  const { w, h, rgba } = img;
  const scale = Math.min(1, target / Math.max(w, h));
  const nw = Math.max(1, Math.round(w * scale)), nh = Math.max(1, Math.round(h * scale));
  if (nw === w && nh === h) return img;
  const out = Buffer.alloc(nw * nh * 4);
  for (let y = 0; y < nh; y++) {
    const sy0 = Math.floor(y * h / nh), sy1 = Math.max(sy0 + 1, Math.floor((y + 1) * h / nh));
    for (let x = 0; x < nw; x++) {
      const sx0 = Math.floor(x * w / nw), sx1 = Math.max(sx0 + 1, Math.floor((x + 1) * w / nw));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = sy0; sy < sy1; sy++) for (let sx = sx0; sx < sx1; sx++) {
        const i = (sy * w + sx) * 4, al = rgba[i + 3] / 255;
        r += rgba[i] * al; g += rgba[i + 1] * al; b += rgba[i + 2] * al; a += al; n++;
      }
      const o = (y * nw + x) * 4;
      if (a > 0.0001) { out[o] = Math.round(r / a); out[o+1] = Math.round(g / a); out[o+2] = Math.round(b / a); }
      out[o + 3] = Math.round(255 * a / n);
    }
  }
  return { w: nw, h: nh, rgba: out };
}

function main() {
  const args = process.argv.slice(2);
  const src = args.find((a) => !a.startsWith("--"));
  if (!src) { console.error("usage: node tools/embed-logo.js <logo.png> [--size N] [--preview out.png] [--page FILE] [--keep-glow]"); process.exit(1); }
  const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
  const size = parseInt(opt("--size", "512"), 10);
  const root = path.resolve(__dirname, "..");
  const pageFile = path.resolve(root, opt("--page", "aqua-zero-heavens-arena.html"));

  let img = decodePNG(fs.readFileSync(path.resolve(src)));
  console.log("source     : " + path.basename(src) + "  " + img.w + "x" + img.h);
  img = key(img, args.includes("--keep-glow"));
  img = trim(img, 2);
  console.log("trimmed    : " + img.w + "x" + img.h);
  img = resize(img, size);
  console.log("embedded   : " + img.w + "x" + img.h);

  const png = encodePNG(img.w, img.h, img.rgba);
  const preview = opt("--preview", null);
  if (preview) { fs.writeFileSync(path.resolve(preview), png); console.log("preview    : " + preview); }

  const uri = "data:image/png;base64," + png.toString("base64");
  console.log("data URI   : " + Math.round(uri.length / 1024) + " KB");

  const page = fs.readFileSync(pageFile, "utf8");
  const line = 'const LOGO_SRC="' + uri + '";';
  if (!/^const LOGO_SRC=.*;$/m.test(page)) throw new Error("no `const LOGO_SRC=` line found in " + path.basename(pageFile));
  fs.writeFileSync(pageFile, page.replace(/^const LOGO_SRC=.*;$/m, () => line));
  console.log("written    : " + path.basename(pageFile));
}
main();
