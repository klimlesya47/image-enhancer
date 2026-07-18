import { applyCorrection } from "./correction";
import { runForward, type ModelWeights } from "./inference";

let weightsPromise: Promise<ModelWeights> | null = null;
const abortedTasks = new Set<string>();

function getWeights(): Promise<ModelWeights> {
  if (!weightsPromise) {
    weightsPromise = fetch("/weights.json").then((r) => r.json());
  }
  return weightsPromise;
}

function postStatus(taskId: string, status: string, progress: number) {
  (self as any).postMessage({ type: "status", taskId, status, progress });
}

async function decodeImage(blob: Blob): Promise<ImageBitmap> {
  return await createImageBitmap(blob);
}

async function runInference(bitmap: ImageBitmap): Promise<[number, number, number]> {
  const size = 224;
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, size, size);
  const imgData = ctx.getImageData(0, 0, size, size);

  const inputCHW = new Float32Array(3 * size * size);
  for (let i = 0; i < size * size; i++) {
    inputCHW[i] = imgData.data[i * 4] / 255; // R
    inputCHW[size * size + i] = imgData.data[i * 4 + 1] / 255; // G
    inputCHW[2 * size * size + i] = imgData.data[i * 4 + 2] / 255; // B
  }

  const weights = await getWeights();
  return runForward(inputCHW, weights, size);
}

async function processTask(taskId: string, image: Blob) {
  const startTime = performance.now();
  try {
    postStatus(taskId, "decoding", 10);
    const bitmap = await decodeImage(image);
    if (abortedTasks.has(taskId)) return finishAborted(taskId);

    postStatus(taskId, "inferring", 40);
    const [brightness, contrast, saturation] = await runInference(bitmap);
    if (abortedTasks.has(taskId)) return finishAborted(taskId);

    postStatus(taskId, "applying", 70);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    imgData = applyCorrection(imgData, brightness, contrast, saturation);
    ctx.putImageData(imgData, 0, 0);
    if (abortedTasks.has(taskId)) return finishAborted(taskId);

    postStatus(taskId, "encoding", 90);
    const resultBlob = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.92 });

    postStatus(taskId, "done", 100);
    (self as any).postMessage({ type: "result", taskId, blob: resultBlob });

    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
    console.log(`Обработка заняла ${elapsed} с`);
  } catch (err: any) {
    console.error("RAW error in worker:", err);
    const errorMessage =
      err?.message || err?.toString?.() || JSON.stringify(err) || "unknown error";
    (self as any).postMessage({ type: "error", taskId, error: errorMessage });
  } finally {
    abortedTasks.delete(taskId);
  }
}

function finishAborted(taskId: string) {
  postStatus(taskId, "aborted", 0);
  (self as any).postMessage({ type: "aborted", taskId });
}

self.onmessage = (e: MessageEvent) => {
  const { type, taskId, image } = e.data;
  if (type === "submit") {
    processTask(taskId, image);
  } else if (type === "abort") {
    abortedTasks.add(taskId);
  }
};
