#!/usr/bin/env node
/* =====================================================================
   Aqua Zero Heavens Arena - fighter portrait importer
   Luminara Digital

   Takes a full-body render with a transparent background, fits it to the
   framing the roster already uses, and writes it into assets/rom/art.txt
   as a WebP data URI. Rebuild afterwards - art.txt is a build input.

   Usage:
     node tools/import-portrait.js "Ogun Celsus" "Ogun Celsus (Full body).png"
     node tools/import-portrait.js "Ogun Celsus" render.png --preview out.png
     node tools/import-portrait.js "New Guy" render.png --quality 88

   A render that arrives with no alpha - a figure sitting on flat black or
   flat white - is keyed automatically; see keyFlatBackground() below.

   Framing: the canvas is not a crop. `drawFighterArt()` stands the whole
   image on the mat and `drawPortrait()` cuts its head shot from a fixed
   square near the top, so where the fighter sits *inside* the canvas is
   the framing. Replacing an existing fighter therefore reuses that
   fighter's canvas and subject box - same height, same feet, same head -
   and only the artwork changes. A fighter with no entry yet gets the house
   default: 640 tall, head at the top edge, feet on the bottom one. Pass
   --reframe to take that default over an existing entry, for when the old
   framing is the thing being fixed.

   Resampling is alpha-weighted, so whatever backdrop the render was cut
   off does not bleed back in as a halo along the edges.

   Requires ffmpeg on PATH for the WebP encode (the page ships the result;
   only this tool needs the encoder).
   ===================================================================== */
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { execFileSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const ART_FILE = path.join(ROOT, "assets", "rom", "art.txt");
const ALPHA_FLOOR = 12;      // below this a pixel is background, not a soft edge
const KEY_POCKET = 0.01;     // enclosed backdrop bigger than this share of the figure is negative space
const SHADOW_INK = 24;       // dimmer than this, low in the frame, and it is floor rather than fighter

/* ---------------- PNG decode - 8-bit, non-interlaced ---------------- */
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
  if (depth !== 8) throw new Error("only 8-bit PNGs are supported (got " + depth + ")");
  if (interlace) throw new Error("interlaced PNGs are not supported");
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
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    if (chan >= 3) { rgba[i*4] = out[i*chan]; rgba[i*4+1] = out[i*chan+1]; rgba[i*4+2] = out[i*chan+2]; rgba[i*4+3] = chan === 4 ? out[i*chan+3] : 255; }
    else { rgba[i*4] = rgba[i*4+1] = rgba[i*4+2] = out[i*chan]; rgba[i*4+3] = chan === 2 ? out[i*chan+1] : 255; }
  }
  return { w, h, rgba };
}

/* ---------------- PNG encode - RGBA, sub filter ---------------- */
const CRCT = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc32(b) { let c = -1; for (let i = 0; i < b.length; i++) c = CRCT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const bpp = 4, row = w * bpp + 1, raw = Buffer.alloc(h * row);
  for (let y = 0; y < h; y++) {
    raw[y * row] = 1;
    for (let x = 0; x < w * bpp; x++) {
      const i = y * w * bpp + x;
      raw[y * row + 1 + x] = (rgba[i] - (x >= bpp ? rgba[i - bpp] : 0)) & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

/* ---------------- keying a flat backdrop ----------------
   Renders turn up two ways: already cut out, or a figure standing on flat
   black. Keying the flat ones by brightness alone is not possible here -
   the fight kit is black too, and on this roster a pair of shorts can hold
   more sub-8 pixels than the backdrop does. So:

     1. Flood the backdrop colour inwards from the frame edge. Dark pixels
        that live *inside* the figure are never reached, so the kit stays.
     2. The flood still crawls down the artwork's own black linework -
        seams, knuckle lines, fabric folds - and opens hairline slits
        through the middle of a garment. A morphological close seals every
        channel narrower than 2r while leaving the silhouette where it was.
     3. Backdrop the flood could not reach at all - the pocket between a
        fighter's arm and his ribs is walled off from the frame - is judged
        by size. Bigger than KEY_POCKET of the figure and it is negative
        space, cut; smaller and it is the artwork's own black, kept. Both
        counts are logged, because a wrong call here is a black wedge down
        someone's side and you want to see the number that caused it.

     4. Renders that stand him on a floor leave a contact shadow under the
        feet - too dark to read as figure, too light to read as backdrop.
        Widening the tolerance to swallow it takes his hair with it, so it
        goes by its own signature instead: in the bottom band, nothing under
        SHADOW_INK may sit below the last lit pixel of its own column. A
        shadow pools under and beside the feet; a foot is lit, so it keeps
        everything above it. A fighter in black boots would trip this, which
        is why the pixel count is logged - and --keep-shadow turns it off.

     5. Only the largest surviving island is the fighter; loose flecks the
        shadow left behind are dropped. The biggest thing dropped is logged
        too: a fighter is one island, so if that number is not tiny then
        something got amputated and you need to know.

   Order matters: pockets are settled on the raw colour match, before the
   close, or step 2 seals them shut and step 3 never sees them.

   What this cannot recover is a genuinely ambiguous edge: where the art
   itself fades a black garment into a black frame there is no boundary to
   find, and none is invented. --key-close raises the sealing radius,
   --key-tolerance widens what counts as backdrop. */
function keyFlatBackground(img, tol, radius, dropShadow) {
  const { w, h, rgba } = img, N = w * h;
  const corner = (x, y) => [rgba[(y*w+x)*4], rgba[(y*w+x)*4+1], rgba[(y*w+x)*4+2]];
  const cs = [corner(0,0), corner(w-1,0), corner(0,h-1), corner(w-1,h-1)];
  const bgc = [0,1,2].map((c) => cs.map((p) => p[c]).sort((a,b) => a-b)[1]);

  const near = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    near[i] = Math.max(Math.abs(rgba[i*4] - bgc[0]), Math.abs(rgba[i*4+1] - bgc[1]),
                       Math.abs(rgba[i*4+2] - bgc[2])) <= tol ? 1 : 0;
  }
  const fillFromEdge = (ok) => {
    const m = new Uint8Array(N), st = [];
    const push = (x, y) => { const i = y * w + x; if (!m[i] && ok[i]) { m[i] = 1; st.push(i); } };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (st.length) {
      const i = st.pop(), x = i % w, y = (i / w) | 0;
      if (x > 0) push(x-1, y); if (x < w-1) push(x+1, y);
      if (y > 0) push(x, y-1); if (y < h-1) push(x, y+1);
    }
    return m;
  };
  /* separable box dilate (max) / erode (min); off-frame reads as background */
  const morph = (src, r, dilate) => {
    const tmp = new Uint8Array(N), out = new Uint8Array(N);
    const pass = (src, dst, horiz) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let v = dilate ? 0 : 1;
        for (let d = -r; d <= r; d++) {
          const xx = horiz ? x + d : x, yy = horiz ? y : y + d;
          if (xx < 0 || xx >= w || yy < 0 || yy >= h) { if (!dilate) v = 0; continue; }
          const s = src[yy * w + xx];
          v = dilate ? (v | s) : (v & s);
        }
        dst[y * w + x] = v;
      }
    };
    pass(src, tmp, true); pass(tmp, out, false);
    return out;
  };

  const bg = fillFromEdge(near);
  const subj = new Uint8Array(N);
  let area = 0;
  for (let i = 0; i < N; i++) { subj[i] = bg[i] ? 0 : 1; area += subj[i]; }

  /* walled-off backdrop, one connected component at a time */
  const limit = Math.max(1, Math.round(area * KEY_POCKET));
  const seen = new Uint8Array(N);
  let pockets = 0, inked = 0;
  for (let s = 0; s < N; s++) {
    if (!near[s] || bg[s] || seen[s]) continue;
    const comp = [s]; seen[s] = 1;
    for (let q = 0; q < comp.length; q++) {
      const i = comp[q], x = i % w, y = (i / w) | 0;
      const step = (xx, yy) => {
        const j = yy * w + xx;
        if (!seen[j] && near[j] && !bg[j]) { seen[j] = 1; comp.push(j); }
      };
      if (x > 0) step(x-1, y); if (x < w-1) step(x+1, y);
      if (y > 0) step(x, y-1); if (y < h-1) step(x, y+1);
    }
    if (comp.length > limit) { comp.forEach((i) => { subj[i] = 0; }); pockets++; }
    else inked++;
  }

  const closed = radius > 0 ? morph(morph(subj, radius, true), radius, false) : subj;

  /* the floor he is standing on: in the bottom band only, nothing dark may
     sit below the last lit pixel of its own column. A shadow pools under
     and beside the feet; a foot is lit and keeps everything above it. The
     band matters - unconfined, this rule would erase a black glove held out
     at arm's length, since that column has nothing lit in it either. */
  let shadowPx = 0;
  if (dropShadow) {
    const lum = (i) => Math.max(rgba[i*4], rgba[i*4+1], rgba[i*4+2]);
    let top = h, bot = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (closed[y*w+x]) { if (y < top) top = y; if (y > bot) bot = y; break; }
    }
    const band = bot - Math.round((bot - top) * 0.15);
    for (let x = 0; x < w; x++) {
      let lit = -1;
      for (let y = h - 1; y >= 0; y--) if (closed[y*w+x] && lum(y*w+x) >= SHADOW_INK) { lit = y; break; }
      for (let y = Math.max(band, lit + 1); y < h; y++) {
        if (closed[y*w+x]) { closed[y*w+x] = 0; shadowPx++; }
      }
    }
  }

  /* one fighter, one island - everything else is floor */
  const mark = new Int32Array(N).fill(-1);
  const islands = [];
  for (let s = 0; s < N; s++) {
    if (!closed[s] || mark[s] >= 0) continue;
    const id = islands.length, comp = [s];
    mark[s] = id;
    for (let q = 0; q < comp.length; q++) {
      const i = comp[q], x = i % w, y = (i / w) | 0;
      const step = (xx, yy) => {
        const j = yy * w + xx;
        if (closed[j] && mark[j] < 0) { mark[j] = id; comp.push(j); }
      };
      if (x > 0) step(x-1, y); if (x < w-1) step(x+1, y);
      if (y > 0) step(x, y-1); if (y < h-1) step(x, y+1);
    }
    islands.push(comp.length);
  }
  const main = islands.indexOf(Math.max.apply(null, islands));
  const dropped = islands.length - 1;
  const biggestDrop = islands.reduce((m, n, i) => (i === main ? m : Math.max(m, n)), 0);

  let kept = 0;
  const out = Buffer.from(rgba);
  for (let i = 0; i < N; i++) {
    const on = mark[i] === main;
    out[i*4+3] = on ? 255 : 0; kept += on ? 1 : 0;
  }
  return { img: { w, h, rgba: out }, bgc, kept, pockets, inked, dropped, biggestDrop, shadowPx };
}

/* ---------------- geometry ---------------- */
function alphaBox(img) {
  const { w, h, rgba } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (rgba[(y * w + x) * 4 + 3] > ALPHA_FLOOR) {
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) throw new Error("the render is fully transparent - is the background actually cut out?");
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/* Box-resample src[box] into a dst rect on a transparent canvas.
   RGB is averaged weighted by alpha: a cut-out render still carries the
   old backdrop in its transparent pixels, and an unweighted average would
   drag that colour back along every edge. */
function place(src, box, cw, ch, dx, dy, dw, dh) {
  const out = Buffer.alloc(cw * ch * 4);
  const sxs = box.w / dw, sys = box.h / dh;
  for (let y = 0; y < dh; y++) {
    const ty = dy + y; if (ty < 0 || ty >= ch) continue;
    const fy0 = box.y0 + y * sys, fy1 = fy0 + sys;
    const iy0 = Math.max(0, Math.floor(fy0)), iy1 = Math.min(src.h, Math.max(iy0 + 1, Math.ceil(fy1)));
    for (let x = 0; x < dw; x++) {
      const tx = dx + x; if (tx < 0 || tx >= cw) continue;
      const fx0 = box.x0 + x * sxs, fx1 = fx0 + sxs;
      const ix0 = Math.max(0, Math.floor(fx0)), ix1 = Math.min(src.w, Math.max(ix0 + 1, Math.ceil(fx1)));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = iy0; sy < iy1; sy++) for (let sx = ix0; sx < ix1; sx++) {
        const i = (sy * src.w + sx) * 4, al = src.rgba[i + 3];
        r += src.rgba[i] * al; g += src.rgba[i+1] * al; b += src.rgba[i+2] * al;
        a += al; n++;
      }
      const o = (ty * cw + tx) * 4;
      out[o + 3] = Math.round(a / n);
      if (a > 0) { out[o] = Math.round(r / a); out[o+1] = Math.round(g / a); out[o+2] = Math.round(b / a); }
    }
  }
  return { w: cw, h: ch, rgba: out };
}

/* ---------------- art.txt ---------------- */
function readArt() {
  const line = fs.readFileSync(ART_FILE, "utf8").trim();
  const PRE = "const ART=";
  if (!line.startsWith(PRE)) throw new Error("art.txt does not start with `const ART=`");
  return JSON.parse(line.slice(PRE.length, line.lastIndexOf(";")));
}
function writeArt(art) {
  fs.writeFileSync(ART_FILE, "const ART=" + JSON.stringify(art) + ";\n");
}

function toWebP(png, quality) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "azha-art-"));
  const inp = path.join(tmp, "in.png"), outp = path.join(tmp, "out.webp");
  try {
    fs.writeFileSync(inp, png);
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", inp, "-c:v", "libwebp",
      "-preset", "picture", "-quality", String(quality), "-pix_fmt", "yuva420p", outp], { stdio: "pipe" });
    return fs.readFileSync(outp);
  } catch (e) {
    if (e.code === "ENOENT") throw new Error("ffmpeg not found on PATH - it does the WebP encode");
    throw new Error("ffmpeg failed: " + (e.stderr ? e.stderr.toString().trim() : e.message));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function main() {
  const args = process.argv.slice(2);
  const opt = (n, d) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
  const TAKES_VALUE = ["--quality", "--preview", "--key-tolerance", "--key-close"];
  const free = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && TAKES_VALUE.includes(args[i - 1])));
  const [name, srcPath] = free;
  if (!name || !srcPath) {
    console.error('usage: node tools/import-portrait.js "<Fighter Name>" <render.png> [--reframe] [--quality N] [--preview out.png]');
    process.exit(1);
  }
  const reframe = args.includes("--reframe");
  const quality = Number(opt("--quality", "90"));   // ~45 KB a fighter, the roster's own weight
  const preview = opt("--preview", null);
  /* Tight on purpose. A flat backdrop is flat, and cel-shaded art draws its
     linework in the same #000 the backdrop uses - every point of slack here
     is bitten out of somebody's hair. */
  const keyTol = Number(opt("--key-tolerance", "2"));
  const keyClose = Number(opt("--key-close", "6"));

  const art = readArt();
  let src = decodePNG(fs.readFileSync(path.resolve(srcPath)));
  console.log("source  : " + path.basename(srcPath) + "  " + src.w + "x" + src.h);

  let cut = 0;
  for (let i = 0; i < src.w * src.h; i++) if (src.rgba[i*4+3] < 255) cut++;
  if (cut * 200 < src.w * src.h && !args.includes("--no-key")) {   // under 0.5% - nothing was cut out
    const r = keyFlatBackground(src, keyTol, keyClose, !args.includes("--keep-shadow"));
    src = r.img;
    console.log("keyed   : backdrop rgb(" + r.bgc.join(",") + ") tol " + keyTol +
                ", close r" + keyClose + " -> " + (100 * r.kept / (src.w * src.h)).toFixed(1) + "% kept" +
                ", " + r.pockets + " walled-off pocket" + (r.pockets === 1 ? "" : "s") + " cut, " +
                r.inked + " kept as linework, " +
                r.dropped + " fragment" + (r.dropped === 1 ? "" : "s") + " dropped" +
                (r.dropped ? " (largest " + r.biggestDrop + " px)" : "") +
                (r.shadowPx ? ", " + r.shadowPx + " px of floor shadow trimmed" : ""));
  }
  const box = alphaBox(src);
  console.log("subject : " + box.w + "x" + box.h + " at " + box.x0 + "," + box.y0);

  let cw, ch, dh, dy, cxCentre;
  const old = art[name];
  if (old && !reframe) {
    /* Match the fighter being replaced: same canvas, same subject height and
       top edge, centred on the same axis. The framing survives; the art changes. */
    const prev = alphaBox(decodePNG(toPNGFromWebP(old.d)));
    cw = old.w; ch = old.h;
    dh = prev.h; dy = prev.y0;
    cxCentre = (prev.x0 + prev.x1 + 1) / 2;
    console.log("matching: " + name + "  canvas " + cw + "x" + ch +
                "  subject " + prev.w + "x" + prev.h + " at " + prev.x0 + "," + prev.y0);
  } else {
    /* House default: 640 tall, head at the top edge, feet on the bottom one -
       drawFighterArt() stands the canvas on the mat, so bottom padding is a
       fighter hovering. Reach for --reframe when the entry being replaced is
       framed wrong and inheriting it would waste the new render: a half-body
       crop, a landscape canvas, a figure floating clear of the floor. */
    ch = 640; dh = ch; dy = 0;
    cw = Math.round(src.w * (dh / box.h));
    cxCentre = cw / 2;
    console.log((old ? "reframed: " : "new     : ") + name + "  house default canvas " + cw + "x" + ch);
  }
  let dw = Math.round(dh * (box.w / box.h));
  if (dw > cw) { dw = cw; dh = Math.round(dw * (box.h / box.w)); }   // never crop a shoulder off
  const dx = Math.round(cxCentre - dw / 2);

  const canvas = place(src, box, cw, ch, dx, dy, dw, dh);
  const png = encodePNG(canvas.w, canvas.h, canvas.rgba);
  console.log("placed  : " + dw + "x" + dh + " at " + dx + "," + dy + " on " + cw + "x" + ch);

  if (preview) { fs.writeFileSync(path.resolve(preview), png); console.log("preview : " + preview); }

  const webp = toWebP(png, quality);
  const uri = "data:image/webp;base64," + webp.toString("base64");
  console.log("encoded : q" + quality + ", " + Math.round(uri.length / 1024) + " KB of data URI");

  art[name] = { w: cw, h: ch, d: uri };
  writeArt(art);
  console.log("written : assets/rom/art.txt  (rebuild with `node tools/build.js`)");
}

/* WebP in, PNG out - only used to read back the entry being replaced. */
function toPNGFromWebP(dataUri) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "azha-art-"));
  const inp = path.join(tmp, "in.webp"), outp = path.join(tmp, "out.png");
  try {
    fs.writeFileSync(inp, Buffer.from(dataUri.slice(dataUri.indexOf(",") + 1), "base64"));
    execFileSync("ffmpeg", ["-y", "-v", "error", "-i", inp, "-pix_fmt", "rgba", outp], { stdio: "pipe" });
    return fs.readFileSync(outp);
  } catch (e) {
    if (e.code === "ENOENT") throw new Error("ffmpeg not found on PATH - it does the WebP decode");
    throw new Error("ffmpeg failed reading the existing entry: " + (e.stderr ? e.stderr.toString().trim() : e.message));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

main();
