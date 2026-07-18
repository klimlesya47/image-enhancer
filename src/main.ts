import { api } from "./api";
import { convertHeicIfNeeded } from "./heic";
import "./style.css";

const input = document.querySelector<HTMLInputElement>("#file-input")!;
const progressEl = document.querySelector<HTMLDivElement>("#progress")!;
const abortBtn = document.querySelector<HTMLButtonElement>("#abort-btn")!;
const originalImg = document.querySelector<HTMLImageElement>("#original")!;
const resultImg = document.querySelector<HTMLImageElement>("#result")!;
const downloadLink = document.querySelector<HTMLAnchorElement>("#download-link")!;

let currentTaskId: string | null = null;

input.addEventListener("change", async () => {
  const file = input.files?.[0];
  if (!file) return;

  originalImg.removeAttribute("src");
  resultImg.removeAttribute("src");
  downloadLink.classList.add("hidden");
  abortBtn.disabled = false;

  let blob: Blob;
  try {
    blob = await convertHeicIfNeeded(file);
  } catch (err: any) {
    progressEl.textContent = `Ошибка конвертации HEIC: ${err?.message ?? err}`;
    return;
  }

  originalImg.src = URL.createObjectURL(blob);

  const { taskId } = await api.submitTask(blob);
  currentTaskId = taskId;

  const unsubscribe = api.onStatusChange((id, state) => {
    if (id !== taskId) return;

    progressEl.textContent = `${state.status} — ${state.progress}%`;

    if (state.status === "done" && state.result) {
      const resultUrl = URL.createObjectURL(state.result);
      resultImg.src = resultUrl;

      downloadLink.href = resultUrl;
      downloadLink.download = buildDownloadName(file.name);
      downloadLink.classList.remove("hidden");

      abortBtn.disabled = true;
      currentTaskId = null;
      unsubscribe();
    }
    if (state.status === "error") {
      console.error("Полная ошибка:", state.error);
      progressEl.textContent = `Ошибка: ${JSON.stringify(state.error, null, 2)}`;
      abortBtn.disabled = true;
      currentTaskId = null;
      unsubscribe();
    }
    if (state.status === "aborted") {
      progressEl.textContent = "Обработка прервана";
      abortBtn.disabled = true;
      currentTaskId = null;
      unsubscribe();
    }
  });
});

abortBtn.addEventListener("click", async () => {
  if (!currentTaskId) return;
  await api.abortTask(currentTaskId);
});

function buildDownloadName(originalName: string): string {
  const dotIndex = originalName.lastIndexOf(".");
  const base = dotIndex === -1 ? originalName : originalName.slice(0, dotIndex);
  return `${base}_enhanced.jpg`;
}
