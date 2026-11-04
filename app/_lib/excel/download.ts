// 브라우저에서 파일을 내려받게 하는 도구. 파일은 사용자의 컴퓨터로만 저장되고 서버로는 가지 않는다.
import { XLSX_MIME_TYPE } from "./writeResult";

export function downloadFile(bytes: Uint8Array, fileName: string, mimeType: string = XLSX_MIME_TYPE): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // 다운로드가 시작될 시간을 준 뒤 임시 주소를 정리한다.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
