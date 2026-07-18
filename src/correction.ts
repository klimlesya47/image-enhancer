/** Применяет коррекцию яркости, контрастности и насыщенности к ImageData*/
export function applyCorrection(
  imageData: ImageData,
  brightness: number,
  contrast: number,
  saturation: number
): ImageData {
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255;
    let g = data[i + 1] / 255;
    let b = data[i + 2] / 255;

    // яркость + контраст
    r = (r - 0.5) * contrast + 0.5 + brightness;
    g = (g - 0.5) * contrast + 0.5 + brightness;
    b = (b - 0.5) * contrast + 0.5 + brightness;

    // насыщенность 
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    r = lum + (r - lum) * saturation;
    g = lum + (g - lum) * saturation;
    b = lum + (b - lum) * saturation;

    data[i] = clamp255(r * 255);
    data[i + 1] = clamp255(g * 255);
    data[i + 2] = clamp255(b * 255);
  }

  return imageData;
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}
