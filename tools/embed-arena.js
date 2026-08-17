#!/usr/bin/env node
/* =====================================================================
   Aqua Zero Heavens Arena - arena backdrop embedder
   Luminara Digital

   Takes the arena render (the ring: white canvas, ropes, corner pads,
   dark crowd), scales it to the game's 960x540 stage and writes it into
   the page as a data URI, same pattern as the brand logo.

   Usage:
     node tools/embed-arena.js Aqua_Zero_Heavens_Arena.png
     node tools/embed-arena.js arena.png --page aqua-zero-heavens-arena.html
   ===================================================================== */
"use strict";
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

/* PNG decode/encode - same core as embed-logo, without the keying */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  let p = 8, w = 0, h = 0, depth = 0, ctype = 0, interlace = 0;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString("ascii", p + 4, p + 8), data = buf.slice(p + 8, p + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; interlace = data[12]; }
    else if (type === "IDAT") idat.push(data);
    else if (type === "IEND") break;
    p += 12 + len;
  }
  if (depth !== 8 || interlace) throw new Error("only plain 8-bit PNGs supported");
  const chan = { 0: 1, 2: 3, 4: 2, 6: 4 }[ctype];
  if (!chan) throw new Error("unsupported colour type " + ctype);
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * chan, out = Buffer.alloc(w * h * chan);
  let ip = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[ip++], line = raw.slice(ip, ip + stride); ip += stride;
    const cur = out.slice(y * stride, (y + 1) * stride);
    const prev = y ? out.slice((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= chan ? cur[x - chan] : 0, b = prev ? prev[x] : 0, c = prev && x >= chan ? prev[x - chan] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      cur[x] = v & 255;
    }
  }
  const rgb = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    if (chan >= 3) { rgb[i*3] = out[i*chan]; rgb[i*3+1] = out[i*chan+1]; rgb[i*3+2] = out[i*chan+2]; }
    else { rgb[i*3] = rgb[i*3+1] = rgb[i*3+2] = out[i*chan]; }
  }
  return { w, h, rgb };
}
const CRCT = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(b) { let c = -1; for (let i = 0; i < b.length; i++) c = CRCT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgb) {
  const raw = Buffer.alloc(h * (w * 3 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 1;                              // sub filter: photographic rows pack tighter
    for (let x = 0; x < w * 3; x++) {
      const i = y * w * 3 + x;
      raw[y * (w * 3 + 1) + 1 + x] = (rgb[i] - (x >= 3 ? rgb[i - 3] : 0)) & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
/* cover-fit box resample to the stage size */
function resizeCover(img, tw, th) {
  const { w, h, rgb } = img;
  const scale = Math.max(tw / w, th / h);
  const sw = tw / scale, sh = th / scale;
  const sx0 = (w - sw) / 2, sy0 = (h - sh) * 0.45;         // bias upward: keep the ropes, crop empty floor
  const out = Buffer.alloc(tw * th * 3);
  for (let y = 0; y < th; y++) {
    const fy0 = sy0 + (y / th) * sh, fy1 = sy0 + ((y + 1) / th) * sh;
    const iy0 = Math.max(0, Math.floor(fy0)), iy1 = Math.min(h, Math.max(iy0 + 1, Math.ceil(fy1)));
    for (let x = 0; x < tw; x++) {
      const fx0 = sx0 + (x / tw) * sw, fx1 = sx0 + ((x + 1) / tw) * sw;
      const ix0 = Math.max(0, Math.floor(fx0)), ix1 = Math.min(w, Math.max(ix0 + 1, Math.ceil(fx1)));
      let r = 0, g = 0, b = 0, n = 0;
      for (let sy = iy0; sy < iy1; sy++) for (let sx = ix0; sx < ix1; sx++) {
        const i = (sy * w + sx) * 3; r += rgb[i]; g += rgb[i+1]; b += rgb[i+2]; n++;
      }
      const o = (y * tw + x) * 3;
      out[o] = Math.round(r / n); out[o+1] = Math.round(g / n); out[o+2] = Math.round(b / n);
    }
  }
  return { w: tw, h: th, rgb: out };
}

function main() {
  const args = process.argv.slice(2);
  const src = args.find((a) => !a.startsWith("--"));
  if (!src) { console.error("usage: node tools/embed-arena.js <arena.png> [--page FILE]"); process.exit(1); }
  const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
  const root = path.resolve(__dirname, "..");
  const pageFile = path.resolve(root, opt("--page", "aqua-zero-heavens-arena.html"));

  let img = decodePNG(fs.readFileSync(path.resolve(src)));
  console.log("source  : " + path.basename(src) + "  " + img.w + "x" + img.h);
  img = resizeCover(img, 960, 540);
  const png = encodePNG(img.w, img.h, img.rgb);
  const uri = "data:image/png;base64," + png.toString("base64");
  console.log("embedded: 960x540, " + Math.round(uri.length / 1024) + " KB");

  const page = fs.readFileSync(pageFile, "utf8");
  if (!/^const ARENA_SRC=.*;$/m.test(page)) throw new Error("no `const ARENA_SRC=` line found in " + path.basename(pageFile));
  fs.writeFileSync(pageFile, page.replace(/^const ARENA_SRC=.*;$/m, () => 'const ARENA_SRC="' + uri + '";'));
  console.log("written : " + path.basename(pageFile));
}
main();
