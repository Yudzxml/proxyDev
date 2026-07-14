/**
 * Cloudflare Worker - Entry Point
 * Menggantikan Express Router dengan export default { fetch() }
 */

import { proxyRequest } from "./proxy.js";
import { handleCorsPreflight, addCorsHeaders } from "./cors.js";
import {
  parseToken,
  isRawContentType,
  PASSTHROUGH_REQUEST_HEADERS,
} from "./utils.js";

export default {
  /**
   * Main fetch handler
   * @param {Request} request
   * @param {Env} env
   * @param {ExecutionContext} ctx
   * @returns {Promise<Response>}
   */
  async fetch(request, env, ctx) {
    // Handle CORS preflight
    const corsResponse = handleCorsPreflight(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const searchParams = url.searchParams;

    // Ambil target URL dari query param
    let targetUrl = searchParams.get("url");
    let method = (searchParams.get("method") || request.method).toUpperCase();

    // Validasi URL wajib
    if (!targetUrl) {
      return addCorsHeaders(
        Response.json(
          {
            status: 400,
            error: "Parameter 'url' wajib diisi",
          },
          { status: 400 }
        )
      );
    }

    // Decode URL
    try {
      targetUrl = decodeURIComponent(targetUrl);
    } catch {
      return addCorsHeaders(
        Response.json(
          {
            status: 400,
            error: "URL tidak valid",
          },
          { status: 400 }
        )
      );
    }

    // Ambil content type dari request
    const contentType = request.headers.get("content-type") || "";

    // Inisialisasi custom headers
    let customHeaders = {};

    // Variable untuk body parsing
    let bodyObj = null;
    let fetchBody = null;

    // Parse body untuk non-GET/HEAD
    if (request.method !== "GET" && request.method !== "HEAD") {
      if (isRawContentType(contentType)) {
        // Raw binary: stream langsung, JANGAN baca ke memory
        fetchBody = request.body;

        // Pastikan content-type tetap diset
        if (!customHeaders["content-type"]) {
          customHeaders["content-type"] = contentType;
        }
      } else {
        // Non-raw: baca sebagai text dulu (hanya sekali, stream tidak bisa dibaca ulang)
        const bodyText = await request.text();

        if (bodyText) {
          try {
            bodyObj = JSON.parse(bodyText);
          } catch {
            // Bukan JSON, gunakan sebagai plain text
            fetchBody = bodyText;
          }
        }

        // Update target URL dan method dari body jika ada
        if (bodyObj) {
          if (bodyObj.url) {
            targetUrl = bodyObj.url;
          }
          if (bodyObj.method) {
            method = bodyObj.method.toUpperCase();
          }
        }
      }
    }

    // Ambil token dari query atau body
    const queryToken = searchParams.get("token");
    const bodyToken = bodyObj?.token;
    const token = queryToken || bodyToken;

    // Parse dan apply token headers
    if (token) {
      const tokenHeaders = parseToken(token);
      if (tokenHeaders === null) {
        return addCorsHeaders(
          Response.json(
            {
              status: 400,
              error: "Token base64 invalid",
            },
            { status: 400 }
          )
        );
      }
      Object.assign(customHeaders, tokenHeaders);
    }

    // Apply headers dari body.headers
    if (bodyObj?.headers && typeof bodyObj.headers === "object") {
      for (const key in bodyObj.headers) {
        if (Object.prototype.hasOwnProperty.call(bodyObj.headers, key)) {
          customHeaders[key.toLowerCase()] = bodyObj.headers[key];
        }
      }
    }

    // Passthrough request headers yang diperlukan
    for (const key of PASSTHROUGH_REQUEST_HEADERS) {
      const value = request.headers.get(key);
      if (value && !customHeaders[key]) {
        customHeaders[key] = value;
      }
    }

    // Handle body untuk JSON request (setelah token dan headers di-parse)
    if (fetchBody === null && bodyObj && request.method !== "GET" && request.method !== "HEAD") {
      if (bodyObj.data !== undefined) {
        if (typeof bodyObj.data === "string") {
          // String data: kirim apa adanya
          fetchBody = bodyObj.data;
        } else {
          // Object data: JSON stringify
          fetchBody = JSON.stringify(bodyObj.data);
          if (!customHeaders["content-type"]) {
            customHeaders["content-type"] = "application/json";
          }
        }
      } else {
        // Strip special keys, kirim sisanya
        const { url: _, method: __, headers: ___, token: ____, ...rest } = bodyObj;
        if (Object.keys(rest).length > 0) {
          fetchBody = JSON.stringify(rest);
          if (!customHeaders["content-type"]) {
            customHeaders["content-type"] = "application/json";
          }
        }
      }
    }

    // Execute proxy request
    try {
      const response = await proxyRequest({
        url: targetUrl,
        method,
        body: fetchBody,
        customHeaders,
      });

      return addCorsHeaders(response);
    } catch (err) {
      console.error("[Proxy Error]", err.message);

      return addCorsHeaders(
        Response.json(
          {
            status: 500,
            error: err.message || "Internal server error",
          },
          { status: 500 }
        )
      );
    }
  },
};
