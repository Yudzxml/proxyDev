/**
 * MIME Type Detection - 3 Layer
 * Layer 1: Extension
 * Layer 2: Content-Type Header
 * Layer 3: Magic Bytes (Uint8Array manual comparison)
 */

const MIME_MAP = {
  // AUDIO
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  m4a: "audio/mp4",
  flac: "audio/flac",
  aac: "audio/aac",
  opus: "audio/opus",

  // VIDEO
  mp4: "video/mp4",
  webm: "video/webm",
  mkv: "video/x-matroska",
  mov: "video/quicktime",
  avi: "video/x-msvideo",
  mpeg: "video/mpeg",

  // IMAGE
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  ico: "image/x-icon",
  tiff: "image/tiff",
  tif: "image/tiff",

  // DOCUMENT
  pdf: "application/pdf",
  json: "application/json",
  xml: "application/xml",
  txt: "text/plain",
  csv: "text/csv",
  html: "text/html",
  htm: "text/html",
  css: "text/css",
  js: "application/javascript",

  // ARCHIVE
  zip: "application/zip",
  rar: "application/vnd.rar",
  "7z": "application/x-7z-compressed",
  tar: "application/x-tar",
  gz: "application/gzip",
  bz2: "application/x-bzip2",

  // FONT
  ttf: "font/ttf",
  otf: "font/otf",
  woff: "font/woff",
  woff2: "font/woff2",

  // WEB / APP
  wasm: "application/wasm",
  proto: "application/x-protobuf",
  apk: "application/vnd.android.package-archive",
  iso: "application/x-iso9660-image",
};

const BINARY_PREFIXES = [
  "audio/",
  "video/",
  "image/",
  "font/",
];

const BINARY_EXACT = new Set([
  "application/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
  "application/pdf",
  "application/wasm",
  "application/x-protobuf",
  "application/grpc-web+proto",
  "application/grpc-web",
  "application/gzip",
  "application/x-gzip",
  "application/x-tar",
  "application/vnd.rar",
  "application/x-rar-compressed",
  "application/x-7z-compressed",
  "application/x-bzip2",
  "application/vnd.android.package-archive",
  "application/x-iso9660-image",
  "application/x-msvideo",
  "application/mpeg",
]);

/**
 * Deteksi MIME type dengan 3 layer
 * @param {string} filename
 * @param {Uint8Array|null} uint8Array
 * @param {Object} headers - plain object dengan key lowercase
 * @returns {string}
 */
export function guessMime(filename = "", uint8Array = null, headers = {}) {
  // Layer 1: Extension
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (MIME_MAP[ext]) return MIME_MAP[ext];

  // Layer 2: Header Content-Type
  const headerType = headers["content-type"];
  if (headerType) {
    return headerType.split(";")[0].toLowerCase().trim();
  }

  // Layer 3: Magic Bytes (manual byte comparison, tanpa toString hex)
  if (uint8Array && uint8Array.length >= 4) {
    return detectMagicBytes(uint8Array);
  }

  return "application/octet-stream";
}

/**
 * Deteksi magic bytes secara manual menggunakan Uint8Array
 * Tidak menggunakan buffer.toString("hex")
 * @param {Uint8Array} b
 * @returns {string}
 */
function detectMagicBytes(b) {
  // PNG: 89 50 4E 47
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return "image/png";
  }

  // JPEG: FF D8 FF
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) {
    return "image/jpeg";
  }

  // PDF: 25 50 44 46
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) {
    return "application/pdf";
  }

  // ZIP: 50 4B 03 04
  if (b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) {
    return "application/zip";
  }

  // RAR: 52 61 72 21
  if (b[0] === 0x52 && b[1] === 0x61 && b[2] === 0x72 && b[3] === 0x21) {
    return "application/vnd.rar";
  }

  // WASM: 00 61 73 6D
  if (b[0] === 0x00 && b[1] === 0x61 && b[2] === 0x73 && b[3] === 0x6d) {
    return "application/wasm";
  }

  // GZIP: 1F 8B
  if (b[0] === 0x1f && b[1] === 0x8b) {
    return "application/gzip";
  }

  // OGG: 4F 67 67 53
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) {
    return "audio/ogg";
  }

  // WebM/MKV (EBML): 1A 45 DF A3
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) {
    // Cek apakah WebM atau Matroska berdasarkan segment
    if (b.length >= 8) {
      // WebM biasanya punya doc type "webm"
      // Matroska punya doc type "matroska"
      // Untuk sederhananya, gunakan webm (paling umum di web)
      return "video/webm";
    }
    return "video/webm";
  }

  // MP4: "ftyp" di offset 4-7
  if (b.length >= 8 &&
      b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    return "video/mp4";
  }

  // BMP: 42 4D
  if (b[0] === 0x42 && b[1] === 0x4d) {
    return "image/bmp";
  }

  // ICO: 00 00 01 00
  if (b[0] === 0x00 && b[1] === 0x00 && b[2] === 0x01 && b[3] === 0x00) {
    return "image/x-icon";
  }

  // TIFF: 49 49 2A 00 (little endian) atau 4D 4D 00 2A (big endian)
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
      (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)) {
    return "image/tiff";
  }

  // SVG: dimulai dengan <?xml atau <svg
  if (b[0] === 0x3c && (b[1] === 0x3f || b[1] === 0x73)) {
    return "image/svg+xml";
  }

  return "application/octet-stream";
}

/**
 * Cek apakah MIME type termasuk binary (harus di-stream)
 * @param {string} mime
 * @returns {boolean}
 */
export function isBinaryMime(mime) {
  for (const prefix of BINARY_PREFIXES) {
    if (mime.startsWith(prefix)) return true;
  }
  return BINARY_EXACT.has(mime);
}
