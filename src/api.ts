export type TaskStatus =
  | "queued"
  | "decoding"
  | "inferring"
  | "applying"
  | "encoding"
  | "done"
  | "error"
  | "aborted";

export interface TaskState {
  status: TaskStatus;
  progress: number;
  result?: Blob;
  error?: string;
}

type StatusListener = (taskId: string, state: TaskState) => void;

class ImageEnhanceAPI {
  private worker: Worker;
  private tasks = new Map<string, TaskState>();
  private listeners = new Set<StatusListener>();
  private nextId = 1;

  constructor() {
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e) => this.handleWorkerMessage(e.data);
  }

  private handleWorkerMessage(msg: any) {
    const { taskId, type } = msg;

    if (type === "status") {
      const state: TaskState = { status: msg.status, progress: msg.progress };
      this.tasks.set(taskId, state);
      this.emit(taskId, state);
    } else if (type === "result") {
      const state = this.tasks.get(taskId) ?? { status: "done", progress: 100 };
      state.status = "done";
      state.progress = 100;
      state.result = msg.blob;
      this.tasks.set(taskId, state);
      this.emit(taskId, state);
    } else if (type === "error") {
      const state = this.tasks.get(taskId) ?? { status: "error", progress: 0 };
      state.status = "error";
      state.error = msg.error;
      this.tasks.set(taskId, state);
      this.emit(taskId, state);
    } else if (type === "aborted") {
      const state = this.tasks.get(taskId) ?? { status: "aborted", progress: 0 };
      state.status = "aborted";
      this.tasks.set(taskId, state);
      this.emit(taskId, state);
    }
  }

  private emit(taskId: string, state: TaskState) {
    this.listeners.forEach((cb) => cb(taskId, state));
  }

  /** принимает изображение, возвращает идентификатор задачи */
  async submitTask(image: File | Blob): Promise<{ taskId: string }> {
    const taskId = `task_${this.nextId++}`;
    this.tasks.set(taskId, { status: "queued", progress: 0 });
    this.worker.postMessage({ type: "submit", taskId, image });
    return { taskId };
  }

  /** получения статуса задачи */
  async getStatus(taskId: string): Promise<{ status: TaskStatus; progress: number }> {
    const t = this.tasks.get(taskId);
    if (!t) throw new Error(`Unknown taskId: ${taskId}`);
    return { status: t.status, progress: t.progress };
  }

  /** прерывания задачи */
  async abortTask(taskId: string): Promise<{ success: boolean }> {
    if (!this.tasks.has(taskId)) return { success: false };
    this.worker.postMessage({ type: "abort", taskId });
    return { success: true };
  }

  /** получения готового изображения */
  async getResult(taskId: string): Promise<Blob> {
    const t = this.tasks.get(taskId);
    if (!t || !t.result) throw new Error(`Result not ready for taskId: ${taskId}`);
    return t.result;
  }

  /** изменения статуса задачи*/
  onStatusChange(callback: StatusListener): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
}

export const api = new ImageEnhanceAPI();
