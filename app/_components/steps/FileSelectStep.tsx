"use client";

// 1단계. 파일 선택: 마스터 표 1개와 부서 파일 여러 개를 고르고, 개인정보 포함 여부를 체크한다. (DESIGN 1단계)
// 여기서는 파일을 고르기만 한다. 파일을 실제로 읽는 일은 [분석 시작]을 누른 뒤에 한다.
import { useEffect, useRef, useState, type DragEvent } from "react";
import { MAX_DEPARTMENT_FILES, formatFileSize } from "../../_lib/fileSelection";
import { AlertBox } from "../AlertBox";

type Props = {
  master: File | null;
  departments: File[];
  containsPersonalInfo: boolean;
  notices: string[];
  onSelectMaster: (file: File) => void;
  onClearMaster: () => void;
  onAddDepartments: (files: File[], fromFolder: boolean) => void;
  onRemoveDepartment: (index: number) => void;
  onClearDepartments: () => void;
  onPersonalInfoChange: (checked: boolean) => void;
};

const button =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800";
const textButton = "text-sm text-zinc-500 underline-offset-2 hover:text-zinc-800 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200";

export function FileSelectStep(props: Props) {
  const { master, departments, containsPersonalInfo, notices } = props;
  const masterInput = useRef<HTMLInputElement>(null);
  const departmentInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [canPickFolder, setCanPickFolder] = useState(false);

  // 폴더 선택은 이 기능을 지원하는 브라우저(크롬, 엣지 등)에서만 보여 준다.
  // 화면을 처음 그린 뒤에 확인해야 서버에서 만든 화면과 어긋나지 않는다.
  useEffect(() => {
    const input = folderInput.current;
    if (!input) return;
    input.setAttribute("webkitdirectory", "");
    setCanPickFolder("webkitdirectory" in input);
  }, []);

  function takeFiles(list: FileList | null): File[] {
    return list ? Array.from(list) : [];
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const files = takeFiles(event.dataTransfer.files);
    if (files.length > 0) props.onAddDepartments(files, false);
  }

  return (
    <section className="flex flex-col gap-6" aria-labelledby="step-title">
      <div>
        <h2 id="step-title" className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          1단계. 파일 선택
        </h2>
        <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          마스터 표와 부서별 엑셀 파일(.xlsx)을 고르고, 개인정보 포함 여부를 체크합니다.
        </p>
      </div>

      {notices.length > 0 && (
        <AlertBox tone="warning" title="넣지 못한 파일이 있습니다">
          <ul className="list-disc pl-5">
            {notices.map((notice) => (
              <li key={notice}>{notice}</li>
            ))}
          </ul>
        </AlertBox>
      )}

      {/* 마스터 표 */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">마스터 표</h3>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <button type="button" className={button} onClick={() => masterInput.current?.click()}>
            {master ? "다른 파일로 바꾸기" : "파일 선택"}
          </button>
          {master ? (
            <span className="flex min-w-0 items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
              <span className="truncate" title={master.name}>
                {master.name}
              </span>
              <span className="shrink-0 text-zinc-500">{formatFileSize(master.size)}</span>
              <button type="button" className={textButton} onClick={props.onClearMaster} aria-label="마스터 표 선택 취소">
                ✕
              </button>
            </span>
          ) : (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">아직 고르지 않았습니다.</span>
          )}
          <input
            ref={masterInput}
            id="master-input"
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) props.onSelectMaster(file);
              event.target.value = ""; // 같은 파일을 다시 골라도 알아차리게 비운다
            }}
          />
        </div>
      </div>

      {/* 부서 파일 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            부서 파일{" "}
            <span className="font-normal text-zinc-500">
              ({departments.length} / {MAX_DEPARTMENT_FILES}개)
            </span>
          </h3>
          {departments.length > 0 && (
            <button type="button" className={textButton} onClick={props.onClearDepartments}>
              모두 빼기
            </button>
          )}
        </div>
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={[
            "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-5 text-center",
            dragging ? "border-blue-500 bg-blue-50 dark:bg-blue-950/40" : "border-zinc-300 dark:border-zinc-700",
          ].join(" ")}
        >
          <p className="text-sm text-zinc-600 dark:text-zinc-400">엑셀 파일을 여기에 끌어다 놓거나</p>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" className={button} onClick={() => departmentInput.current?.click()}>
              파일 선택
            </button>
            {canPickFolder && (
              <button type="button" className={button} onClick={() => folderInput.current?.click()}>
                폴더 선택
              </button>
            )}
          </div>
          {canPickFolder && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">폴더를 고르면 그 안의 .xlsx 파일을 모두 부서 파일로 가져옵니다.</p>
          )}
          <input
            ref={departmentInput}
            id="department-input"
            type="file"
            accept=".xlsx"
            multiple
            className="hidden"
            onChange={(event) => {
              props.onAddDepartments(takeFiles(event.target.files), false);
              event.target.value = "";
            }}
          />
          <input
            ref={folderInput}
            id="folder-input"
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              props.onAddDepartments(takeFiles(event.target.files), true);
              event.target.value = "";
            }}
          />
        </div>

        {departments.length > 0 && (
          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800" aria-label="고른 부서 파일">
            {departments.map((file, index) => (
              <li key={file.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate text-zinc-800 dark:text-zinc-200" title={file.name}>
                  {file.name}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-zinc-500">{formatFileSize(file.size)}</span>
                  <button
                    type="button"
                    className={textButton}
                    onClick={() => props.onRemoveDepartment(index)}
                    aria-label={`${file.name} 빼기`}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 개인정보 확인 */}
      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-zinc-800 dark:text-zinc-200">개인정보 확인</h3>
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4"
            checked={containsPersonalInfo}
            onChange={(event) => props.onPersonalInfoChange(event.target.checked)}
          />
          <span className="text-sm leading-6">
            <span className="text-zinc-800 dark:text-zinc-200">선택한 파일들에 개인정보가 포함되어 있습니다</span>
            <span className="block text-zinc-500 dark:text-zinc-400">
              체크하면 AI에는 열 이름만 보내고 칸의 값은 보내지 않습니다. 이름, 사번, 연락처 등이 있다면 체크해 주세요.
            </span>
          </span>
        </label>
      </div>
    </section>
  );
}
