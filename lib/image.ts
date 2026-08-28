// Browser-side image normalisation for guest photo contributions.
//
// Two reasons this exists rather than uploading the raw file:
//
// 1. guest-photo-upload mints its storage path as `<gathering>/<uuid>.jpg`
//    and registers the row with mime_type "image/jpeg". Sending PNG or
//    WebP bytes to that path would store content that disagrees with its
//    own declared type. Encoding to JPEG here keeps the two honest.
//
// 2. A photo straight off a phone is routinely 4–8 MB. The bucket caps
//    at 15 MB, but the real problem is a guest on mobile data watching an
//    upload crawl and giving up. Downscaling to a long edge of 2000px is
//    invisible in a gallery and turns that into a few hundred kilobytes.
//
// iOS hands over HEIC as JPEG when it comes from a file input, so the
// canvas path covers it without a decoder.

const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;

export async function toUploadableJpeg(file: File): Promise<Blob | null> {
  try {
    const bitmap = await createImageBitmap(file);

    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", JPEG_QUALITY);
    });
  } catch {
    // Unreadable file, unsupported codec, or a browser without
    // createImageBitmap. The caller reports it rather than uploading
    // something that would be stored under a lie.
    return null;
  }
}
