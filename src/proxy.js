/**
 * Proxy Core
 * Menangani fetch ke upstream dan membangun response
 * Streaming untuk binary, parsing untuk JSON/text
 */

import { getFileName } from "./filename.js";
import { guessMime, isBinaryMime } from "./mime.js";
import {
  headersToObject,
  createStreamWithFirstChunk,
  PASSTHROUGH_RESPONSE_HEADERS,
} from "./utils.js";

/**
 * Build headers untuk binary response
 */
function buildBinaryHeaders(contentType, filename, upstreamHeaders) {
  const headers = new Headers();
  headers.set("Content-Type", contentType);

  if (filename) {
    headers.set("Content-Disposition", `inline; filename="${filename}"`);
  }

  // Teruskan header relevan dari upstream
  for (const key of PASSTHROUGH_RESPONSE_HEADERS) {
    const value = upstreamHeaders[key];
    if (value) {
      headers.set(key, value);
    }
  }

  return headers;
}

/**
 * Build headers untuk text/JSON response
 */
function buildTextHeaders(contentType, filename, upstreamHeaders) {
  const headers = new Headers();
  headers.set("Content-Type", contentType);

  if (filename) {
    headers.set("Content-Disposition", `inline; filename="${filename}"`);
  }

  // Teruskan cache-related headers
  for (const key of ["cache-control", "etag", "last-modified", "expires"]) {
    const value = upstreamHeaders[key];
    if (value) {
      headers.set(key, value);
    }
  }

  return headers;
}

/**
 * Core proxy function
 * @param {Object} options
 * @param {string} options.url - Target URL
 * @param {string} options.method - HTTP method
 * @param {BodyInit|null} options.body - Request body
 * @param {Object} options.customHeaders - Custom headers (plain object)
 * @returns {Promise<Response>}
 */
export async function proxyRequest({
  url,
  method = "GET",
  body = null,
  customHeaders = {},
}) {
  // Set default headers
  const fetchHeaders = new Headers();
  fetchHeaders.set("accept", "*/*");
  fetchHeaders.set(
    "user-agent",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/136 Safari/537.36"
  );
  fetchHeaders.set("referer", "https://www.google.com/");

  // Override dengan custom headers
  for (const [key, value] of Object.entries(customHeaders)) {
    if (value !== undefined && value !== null) {
      fetchHeaders.set(key, value);
    }
  }

  // Fetch ke upstream
  // fetch() default mengikuti redirect (sama seperti axios)
  const response = await fetch(url, {
    method,
    headers: fetchHeaders,
    body,
  });

  // Konversi response headers ke plain object
  const upstreamHeaders = headersToObject(response.headers);

  // Deteksi filename
  const filename = getFileName(response.headers, url);

  // Deteksi content type dari extension dan header
  let contentType = guessMime(filename, null, upstreamHeaders);

  // Cek apakah perlu magic byte detection
  const noContentTypeHeader = !upstreamHeaders["content-type"];
  const needsMagicDetection =
    noContentTypeHeader && contentType === "application/octet-stream";

  if (needsMagicDetection) {
    // Perlu peek bytes pertama untuk magic detection
    const reader = response.body.getReader();
    const { value: firstChunk } = await reader.read();

    let detectedMime = "application/octet-stream";
    if (firstChunk && firstChunk.length >= 4) {
      detectedMime = guessMime(filename, firstChunk, {});
    }

    contentType = detectedMime;

    // Buat stream baru yang menyertakan chunk pertama
    const bodyStream = createStreamWithFirstChunk(firstChunk, reader);

    return new Response(bodyStream, {
      status: response.status,
      headers: buildBinaryHeaders(contentType, filename, upstreamHeaders),
    });
  }

  // Handle berdasarkan content type
  if (isBinaryMime(contentType)) {
    // Stream binary langsung, JANGAN convert ke buffer
    return new Response(response.body, {
      status: response.status,
      headers: buildBinaryHeaders(contentType, filename, upstreamHeaders),
    });
  }

  // Untuk JSON dan text, baca body
  const text = await response.text();

  // JSON handling
  if (contentType.includes("application/json")) {
    try {
      const data = JSON.parse(text);
      return Response.json(data, {
        status: response.status,
        headers: buildTextHeaders(contentType, filename, upstreamHeaders),
      });
    } catch {
      // JSON invalid, kembalikan sebagai text
      return new Response(text, {
        status: response.status,
        headers: buildTextHeaders("text/plain", filename, upstreamHeaders),
      });
    }
  }

  // Text handling (text/*, html, xml)
  return new Response(text, {
    status: response.status,
    headers: buildTextHeaders(contentType, filename, upstreamHeaders),
  });
}
