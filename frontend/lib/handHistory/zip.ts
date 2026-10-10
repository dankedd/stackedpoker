/**
 * Minimal ZIP reader for PokerCraft exports — no dependency.
 *
 * Reads the central directory and inflates each entry with the platform's
 * DecompressionStream("deflate-raw") (all current browsers and Node 18+).
 * Supports the two methods real exports use: stored (0) and deflate (8).
 * ZIP64 and encrypted archives are rejected with a Dutch message.
 */

export interface ZipEntry {
  name: string;
  /** Decoded as UTF-8. */
  text: () => Promise<string>;
}

const EOCD_SIG = 0x06054b50;
const CEN_SIG = 0x02014b50;
const LOC_SIG = 0x04034b50;

export class ZipError extends Error {}

export function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;
}

export function readZip(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // End of central directory: last 22 bytes, plus up to 64 KiB of comment.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new ZipError("Dit zip-bestand is beschadigd of onvolledig.");

  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  if (count === 0xffff || p === 0xffffffff) throw new ZipError("Dit zip-formaat (ZIP64) wordt niet ondersteund.");

  const decoder = new TextDecoder("utf-8");
  const entries: ZipEntry[] = [];
  for (let k = 0; k < count; k++) {
    if (p + 46 > bytes.length || view.getUint32(p, true) !== CEN_SIG) {
      throw new ZipError("Dit zip-bestand is beschadigd of onvolledig.");
    }
    const flags = view.getUint16(p + 8, true);
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const localOffset = view.getUint32(p + 42, true);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith("/")) continue; // directory
    if (flags & 0x1) throw new ZipError("Versleutelde zip-bestanden worden niet ondersteund.");
    if (view.getUint32(localOffset, true) !== LOC_SIG) throw new ZipError("Dit zip-bestand is beschadigd of onvolledig.");

    const dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
    const data = bytes.subarray(dataStart, dataStart + compSize);

    entries.push({
      name,
      text: async () => {
        if (method === 0) return decoder.decode(data);
        if (method !== 8) throw new ZipError(`Compressiemethode ${method} in '${name}' wordt niet ondersteund.`);
        return decoder.decode(await inflateRaw(data));
      },
    });
  }
  return entries;
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  // Copy into a fresh ArrayBuffer-backed view: Blob wants plain ArrayBuffer memory.
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
