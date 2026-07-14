/**
 * CORS Handling
 * Universal CORS untuk semua request
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Expose-Headers": "*",
  "Access-Control-Max-Age": "86400",
};

/**
 * Handle CORS preflight (OPTIONS request)
 * @param {Request} request
 * @returns {Response|null} Response OPTIONS atau null jika bukan preflight
 */
export function handleCorsPreflight(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS,
    });
  }
  return null;
}

/**
 * Tambahkan CORS headers ke response
 * @param {Response} response
 * @returns {Response} Response dengan CORS headers
 */
export function addCorsHeaders(response) {
  const newHeaders = new Headers(response.headers);

  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}
