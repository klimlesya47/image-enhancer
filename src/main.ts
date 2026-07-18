import { api } from "./api";
import { convertHeicIfNeeded } from "./heic";
import "./style.css";

const input = document.querySelector<HTMLInputElement>("#file-input")!;
const progressEl = document.querySelector<HTMLDivElement>("#progress")!;
const abortBtn = document.querySelector<HTMLButtonElement>("#abort-btn")!;
const originalImg = document.querySelector<HTMLImageElement>("#original")!;
const resultImg = document.querySelector<HTMLImageElement>("#result")!;

let currentTaskId: string | null = null;

input.addEventListener("change", async () => {
  const file = input.files?.[0];
  if (!file) return;

  originalImg.removeAttribute("src");
  resultImg.removeAttribute("src");
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
      resultImg.src = URL.createObjectURL(state.result);
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
