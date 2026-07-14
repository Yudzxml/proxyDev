/**
 * Utility Functions
 * Pure Web Standard API, tanpa Node.js
 */

/**
 * Konversi Headers ke plain object dengan key lowercase
 * @param {Headers} headers
 * @returns {Object}
 */
export function headersToObject(headers) {
  const obj = {};
  headers.forEach((value, key) => {
    obj[key.toLowerCase()] = value;
  });
  return obj;
}

/**
 * Buat ReadableStream baru yang menyisipkan firstChunk di awal
 * Digunakan untuk magic byte detection tanpa kehilangan data
 * @param {Uint8Array} firstChunk
 * @param {ReadableStreamDefaultReader} reader
 * @returns {ReadableStream}
 */
export function createStreamWithFirstChunk(firstChunk, reader) {
  return new ReadableStream({
    start(controller) {
      // Sisipkan chunk pertama yang sudah dibaca
      if (firstChunk && firstChunk.length > 0) {
        controller.enqueue(firstChunk);
      }

      // Lanjutkan membaca sisa stream
      function pump() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              controller.close();
              return;
            }
            controller.enqueue(value);
            pump();
          })
          .catch((err) => {
            controller.error(err);
          });
      }

      pump();
    },
    cancel(reason) {
      reader.cancel(reason);
    },
  });
}

/**
 * Parse Base64 token menjadi object header
 * Menggunakan atob() bukan Buffer
 * @param {string} token
 * @returns {Object|null} Parsed headers atau null jika invalid
 */
export function parseToken(token) {
  if (!token || typeof token !== "string") return null;

  try {
    const decoded = atob(token.trim());
    const parsed = JSON.parse(decoded);

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    // Konversi semua key ke lowercase
    const headers = {};
    for (const key in parsed) {
      if (Object.prototype.hasOwnProperty.call(parsed, key)) {
        const value = parsed[key];
        if (typeof value === "string") {
          headers[key.toLowerCase()] = value;
        }
      }
    }

    return Object.keys(headers).length > 0 ? headers : null;
  } catch {
    return null;
  }
}

/**
 * Cek apakah content type termasuk raw/binary yang harus di-stream
 * @param {string} contentType
 * @returns {boolean}
 */
export function isRawContentType(contentType) {
  if (!contentType) return false;
  const lower = contentType.toLowerCase();
  return (
    lower.includes("multipart/form-data") ||
    lower.includes("application/grpc-web") ||
    lower.includes("application/octet-stream") ||
    lower.includes("application/x-protobuf") ||
    lower.includes("application/zip") ||
    lower.includes("application/x-zip-compressed") ||
    lower.includes("application/pdf") ||
    lower.includes("application/gzip") ||
    lower.includes("application/x-gzip") ||
    lower.includes("application/wasm") ||
    lower.includes("audio/") ||
    lower.includes("video/") ||
    lower.includes("image/")
  );
}

/**
 * Header response yang harus diteruskan dari upstream
 */
export const PASSTHROUGH_RESPONSE_HEADERS = [
  "content-length",
  "etag",
  "accept-ranges",
  "cache-control",
  "last-modified",
  "content-range",
  "expires",
  "x-goog-storage-class",
];

/**
 * Header request yang harus diteruskan ke upstream
 */
export const PASSTHROUGH_REQUEST_HEADERS = [
  "accept",
  "authorization",
  "cookie",
  "origin",
  "referer",
  "user-agent",
  "x-client-version",
  "x-locale",
  "x-grpc-web",
  "grpc-timeout",
  "x-user-agent",
  "content-type",
];
