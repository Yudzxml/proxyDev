/**
 * Filename Detection
 * Ekstrak filename dari Content-Disposition header atau URL pathname
 * Tidak menggunakan path.basename()
 */

/**
 * Ekstrak filename dari response
 * @param {Headers} headers - Web Headers object
 * @param {string} url - Request URL
 * @returns {string} Filename atau default "download_file"
 */
export function getFileName(headers, url) {
  // Prioritas 1: Content-Disposition header
  const cd = headers.get("content-disposition");

  if (cd) {
    // Coba filename* (RFC 5987) dulu (lebih lengkap untuk non-ASCII)
    const matchStar = /filename\*=(?:UTF-8''|utf-8'')?([^;\n]+)/i.exec(cd);
    if (matchStar?.[1]) {
      try {
        // Hapus quote jika ada
        const raw = matchStar[1].replace(/^["']|["']$/g, "");
        return decodeURIComponent(raw);
      } catch {
        return matchStar[1].replace(/^["']|["']$/g, "");
      }
    }

    // Coba filename (RFC 2616)
    const match = /filename="?([^";\n]+)"?/i.exec(cd);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }

  // Prioritas 2: URL pathname (tanpa path.basename)
  try {
    const pathname = new URL(url).pathname;
    const segments = pathname.split("/");
    const lastSegment = segments[segments.length - 1];

    if (lastSegment && lastSegment.includes(".")) {
      try {
        return decodeURIComponent(lastSegment);
      } catch {
        return lastSegment;
      }
    }
  } catch {
    // URL parsing gagal, abaikan
  }

  return "download_file";
}
