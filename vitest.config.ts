// 자동 시험(Vitest) 설정.
// 연습용 엑셀 파일 21개를 여러 시험이 동시에 읽어서, 컴퓨터가 바쁠 때 기본 제한 시간(5초)을 넘길 수 있다.
// 계산이 틀린 것이 아니라 시간 초과로 실패하지 않도록 제한 시간을 넉넉히 둔다.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30_000,
  },
});
