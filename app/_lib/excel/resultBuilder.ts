// 결과 엑셀 파일을 별도 작업 공간(Web Worker)에서 만들게 해 주는 도구.
// 작업 공간을 쓸 수 없거나 실패하면 화면과 같은 곳에서 만든다. 결과는 똑같다.
import type { AppliedValue } from "../merge/consolidate";
import type { ConsolidationSettings } from "../types";
import { buildResultFile } from "./writeResult";
import type { WriteRequest, WriteResponse } from "./writeResult.worker";

export async function buildResultFileInWorker(
  originalMaster: ArrayBuffer,
  appliedValues: AppliedValue[],
  settings: Pick<ConsolidationSettings, "sheetName">,
): Promise<Uint8Array<ArrayBuffer>> {
  if (typeof Worker === "undefined") return buildResultFile(originalMaster, appliedValues, settings);

  let worker: Worker;
  try {
    worker = new Worker(new URL("./writeResult.worker.ts", import.meta.url), { type: "module" });
  } catch {
    return buildResultFile(originalMaster, appliedValues, settings);
  }

  // 작업 공간이 고장 났을 때 다시 만들 수 있도록 원본 복사본을 남겨 두고, 원본은 작업 공간으로 넘긴다.
  const backup = originalMaster.slice(0);
  try {
    return await new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<WriteResponse>) => {
        if (event.data.ok) resolve(event.data.bytes);
        else reject(new Error(event.data.message));
      };
      worker.onerror = () => reject(new WorkerFailure());
      const request: WriteRequest = { buffer: originalMaster, appliedValues, settings };
      worker.postMessage(request, [originalMaster]);
    });
  } catch (caught) {
    if (caught instanceof WorkerFailure) return buildResultFile(backup, appliedValues, settings);
    throw caught;
  } finally {
    worker.terminate();
  }
}

class WorkerFailure extends Error {}
