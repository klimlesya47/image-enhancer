import heic2any from "heic2any";

/** eсли файл в формате HEIC конвертирует его в JPEG до отправки в API*/
export async function convertHeicIfNeeded(file: File): Promise<Blob> {
  const isHeic =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    file.name.toLowerCase().endsWith(".heic") ||
    file.name.toLowerCase().endsWith(".heif");

  if (!isHeic) return file;

  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(converted) ? converted[0] : converted;
}
