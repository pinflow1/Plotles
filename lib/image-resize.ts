const MAX_DIMENSION = 640;
const JPEG_QUALITY = 0.82;

/** Resizes/compresses an image file client-side and returns a JPEG data
 *  URL. Storing this directly in `coverUrl` (a Postgres column) avoids
 *  standing up a separate file host — reasonable at this scale, worth
 *  moving to real object storage if covers ever need to get bigger or
 *  the project needs a CDN. */
export function fileToCoverDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Couldn't process that image."));
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Couldn't read that image."));
    };
    img.src = objectUrl;
  });
}
