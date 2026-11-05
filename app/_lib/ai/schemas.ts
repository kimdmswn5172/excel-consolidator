// AI 분석 요청과 응답의 "약속한 모양"을 검사하는 규칙. (Zod)
//  - 브라우저가 서버로 보내는 요청(analyzeRequestSchema): 크기를 제한해 엉뚱하게 큰 데이터가 AI로 가지 않게 한다.
//  - AI가 돌려주는 답(aiOutputSchema): 약속한 모양이 아니면 "invalid-response" 실패로 처리한다.
import * as z from "zod/v4";

// 요청 크기 한도. 정상 요청(시트 몇 개 × 위쪽 10행)보다 넉넉하지만, 엑셀 전체가 올 수는 없는 크기다.
export const LIMITS = { sheets: 20, rows: 10, columns: 200, textLength: 300 } as const;

const cellSchema = z.union([z.string().max(LIMITS.textLength), z.number(), z.boolean(), z.null()]);

export const analyzeRequestSchema = z.object({
  headersOnly: z.boolean(),
  sheets: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        rows: z.array(z.array(cellSchema).max(LIMITS.columns)).max(LIMITS.rows),
        headerRow: z.number().int().min(1).optional(),
      }),
    )
    .min(1)
    .max(LIMITS.sheets),
});

// AI가 항목 하나에 대해 돌려주는 값과 신뢰도(0~100). 확신이 없으면 value를 null로 둔다.
function item<T extends z.ZodType>(value: T) {
  return z.object({ value: value.nullable(), confidence: z.number().nullable() });
}

export const aiOutputSchema = z.object({
  sheetName: item(z.string()),
  keyColumn: item(z.number().int()),
  targetColumns: item(z.array(z.number().int())),
  headerRow: item(z.number().int()),
  dataStartRow: item(z.number().int()),
});

export type AiOutput = z.infer<typeof aiOutputSchema>;
