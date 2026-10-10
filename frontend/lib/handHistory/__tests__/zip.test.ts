import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { readFiles } from "../importer";
import { readZip } from "../zip";
import { TOP_HAND } from "./reconstructed";

/** Builds a real ZIP archive (local headers + central directory) in memory. */
function makeZip(files: { name: string; text: string; store?: boolean }[]): Uint8Array {
  const enc = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const raw = enc.encode(f.text);
    const data = f.store ? raw : new Uint8Array(deflateRawSync(raw));
    const method = f.store ? 0 : 8;
    const loc = new Uint8Array(30 + name.length + data.length);
    const lv = new DataView(loc.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(8, method, true);
    lv.setUint32(18, data.length, true);
    lv.setUint32(22, raw.length, true);
    lv.setUint16(26, name.length, true);
    loc.set(name, 30);
    loc.set(data, 30 + name.length);
    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(10, method, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, raw.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cen.set(name, 46);
    locals.push(loc);
    centrals.push(cen);
    offset += loc.length;
  }
  const cenSize = centrals.reduce((a, c) => a + c.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, cenSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + cenSize + 22);
  let p = 0;
  for (const part of [...locals, ...centrals, eocd]) {
    out.set(part, p);
    p += part.length;
  }
  return out;
}

describe("zip reader", () => {
  it("reads stored and deflated entries", async () => {
    const zip = makeZip([
      { name: "GG20261008 - Daily Special 10.txt", text: TOP_HAND },
      { name: "notes/readme.txt", text: "hallo", store: true },
    ]);
    const entries = readZip(zip);
    expect(entries.map((e) => e.name)).toEqual(["GG20261008 - Daily Special 10.txt", "notes/readme.txt"]);
    expect(await entries[0].text()).toBe(TOP_HAND);
    expect(await entries[1].text()).toBe("hallo");
  });

  it("expands a zip upload into its .txt files", async () => {
    const zip = makeZip([{ name: "a.txt", text: TOP_HAND }, { name: "b.csv", text: "x" }]);
    const res = await readFiles([{ name: "export.zip", arrayBuffer: async () => zip.slice().buffer }]);
    expect(res.fileErrors).toEqual([]);
    expect(res.texts).toEqual([{ fileName: "export.zip › a.txt", text: TOP_HAND }]);
  });

  it("reports a damaged zip in Dutch instead of throwing", async () => {
    const zip = makeZip([{ name: "a.txt", text: TOP_HAND }]).slice(0, 40);
    const res = await readFiles([{ name: "kapot.zip", arrayBuffer: async () => zip.buffer }]);
    expect(res.fileErrors[0].error).toMatch(/beschadigd/);
  });
});
