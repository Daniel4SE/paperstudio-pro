/**
 * Minimal ZIP writer (Store method — no compression).
 * Produces valid ZIP files without any external dependencies.
 */

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[i] = c
  }
  return t
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (const b of data) crc = CRC_TABLE[(crc ^ b) & 0xff]! ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function u16(v: number) {
  const b = new Uint8Array(2)
  new DataView(b.buffer).setUint16(0, v, true)
  return b
}
function u32(v: number) {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, v, true)
  return b
}

export interface ZipEntry {
  name: string
  data: Uint8Array
}

export function buildZip(entries: ZipEntry[]): Blob {
  const enc = new TextEncoder()
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = enc.encode(entry.name)
    const data = entry.data
    const crc = crc32(data)
    const size = data.length

    // Local file header (30 bytes + name)
    const local = concat([
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // signature
      u16(20),   // version needed
      u16(0),    // flags
      u16(0),    // compression (stored)
      u16(0), u16(0),           // mod time / date
      u32(crc),
      u32(size), u32(size),     // compressed / uncompressed
      u16(nameBytes.length),
      u16(0),    // extra length
      nameBytes,
      data,
    ])
    localParts.push(local)

    // Central directory entry (46 bytes + name)
    const central = concat([
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]), // signature
      u16(20), u16(20), // version made / needed
      u16(0), u16(0), u16(0), u16(0),  // flags, comp, time, date
      u32(crc),
      u32(size), u32(size),
      u16(nameBytes.length),
      u16(0), u16(0), u16(0), // extra, comment, disk
      u16(0),    // internal attrs
      u32(0),    // external attrs
      u32(offset),
      nameBytes,
    ])
    centralParts.push(central)
    offset += local.length
  }

  const cdSize = centralParts.reduce((s, c) => s + c.length, 0)
  const eocd = concat([
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]), // signature
    u16(0), u16(0),              // disk / cd disk
    u16(entries.length), u16(entries.length),
    u32(cdSize),
    u32(offset),
    u16(0), // comment length
  ])

  return new Blob(
    [...localParts.map(p => p.buffer as ArrayBuffer), ...centralParts.map(p => p.buffer as ArrayBuffer), eocd.buffer as ArrayBuffer],
    { type: "application/zip" }
  )
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0)
  const out = new Uint8Array(total)
  let pos = 0
  for (const p of parts) { out.set(p, pos); pos += p.length }
  return out
}

/** Convert a base64 data-URL to Uint8Array */
export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

/** Trigger a browser download of the given Blob */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
