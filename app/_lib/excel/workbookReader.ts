// 엑셀 파일을 별도 작업 공간(Web Worker)에서 읽게 해 주는 도구.
// 작업 공간을 쓸 수 없는 곳(자동 시험 등)이나 작업 공간이 실패하면 화면과 같은 곳에서 읽는다. 결과는 똑같다.
import { readWorkbookFromBuffer, readWorkbookFromFile, type ReadWorkbookResult } from "./readWorkbook";
import type { ReadRequest } from "./readWorkbook.worker";

export type WorkbookReader = {
  read: (file: File) => Promise<ReadWorkbookResult>;
  dispose: () => void; // 다 읽은 뒤 작업 공간을 정리한다
};

export function createWorkbookReader(): WorkbookReader {
  if (typeof Worker === "undefined") {
    return { read: readWorkbookFromFile, dispose: () => {} };
  }

  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL("./readWorkbook.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return { read: readWorkbookFromFile, dispose: () => {} };
  }

  let nextId = 0;
  const pending = new Map<number, { resolve: (result: ReadWorkbookResult) => void; buffer: ArrayBuffer; fileName: string }>();

  worker.onmessage = (event: MessageEvent<{ id: number; result: ReadWorkbookResult }>) => {
    const job = pending.get(event.data.id);
    if (!job) return;
    pending.delete(event.data.id);
    job.resolve(event.data.result);
  };

  // 작업 공간이 고장 나면 남은 파일은 화면 쪽에서 읽는다.
  worker.onerror = () => {
    worker?.terminate();
    worker = null;
    for (const [id, job] of pending) {
      pending.delete(id);
      void readWorkbookFromBuffer(job.buffer, job.fileName).then(job.resolve);
    }
  };

  return {
    async read(file) {
      const buffer = await file.arrayBuffer();
      if (!worker) return readWorkbookFromBuffer(buffer, file.name);
      const id = nextId++;
      // 고장 났을 때 다시 읽을 수 있도록 복사본을 남기고, 원본은 작업 공간으로 넘긴다.
      const backup = buffer.slice(0);
      return new Promise((resolve) => {
        pending.set(id, { resolve, buffer: backup, fileName: file.name });
        const request: ReadRequest = { id, buffer, fileName: file.name };
        worker!.postMessage(request, [buffer]);
      });
    },
    dispose() {
      worker?.terminate();
      worker = null;
    },
  };
}
