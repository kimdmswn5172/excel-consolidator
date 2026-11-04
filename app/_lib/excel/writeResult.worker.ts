// 별도 작업 공간(Web Worker)에서 결과 엑셀 파일을 만든다.
// 큰 파일(20만 행)의 결과 파일을 화면과 같은 곳에서 만들면 10초 넘게 화면이 멈춰서 옮겼다.
import type { AppliedValue } from "../merge/consolidate";
import type { ConsolidationSettings } from "../types";
import { buildResultFile } from "./writeResult";

export type WriteRequest = {
  buffer: ArrayBuffer; // 원본 마스터 파일 내용
  appliedValues: AppliedValue[];
  settings: Pick<ConsolidationSettings, "sheetName">;
};

export type WriteResponse = { ok: true; bytes: Uint8Array<ArrayBuffer> } | { ok: false; message: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<WriteRequest>) => void) | null;
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

scope.onmessage = async (event) => {
  const { buffer, appliedValues, settings } = event.data;
  try {
    const bytes = await buildResultFile(buffer, appliedValues, settings);
    scope.postMessage({ ok: true, bytes } satisfies WriteResponse, [bytes.buffer]);
  } catch (caught) {
    scope.postMessage({ ok: false, message: caught instanceof Error ? caught.message : "결과 파일을 만들지 못했습니다." } satisfies WriteResponse);
  }
};
