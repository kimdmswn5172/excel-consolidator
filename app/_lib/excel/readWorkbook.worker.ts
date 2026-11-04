// 별도 작업 공간(Web Worker)에서 엑셀 파일을 읽는다.
// 큰 파일을 화면과 같은 곳에서 읽으면 읽는 동안 화면이 몇 초씩 멈춘다. (9MB 파일에서 최대 5.9초 측정)
// 여기서 읽으면 화면은 계속 움직이고, 진행 표시도 제때 바뀐다.
import { readWorkbookFromBuffer } from "./readWorkbook";

export type ReadRequest = { id: number; buffer: ArrayBuffer; fileName: string };

// 작업 공간 안에서는 self가 화면(window)이 아니라 작업 공간 자신이다.
const scope = self as unknown as {
  onmessage: ((event: MessageEvent<ReadRequest>) => void) | null;
  postMessage: (message: unknown) => void;
};

scope.onmessage = async (event) => {
  const { id, buffer, fileName } = event.data;
  const result = await readWorkbookFromBuffer(buffer, fileName);
  scope.postMessage({ id, result });
};
