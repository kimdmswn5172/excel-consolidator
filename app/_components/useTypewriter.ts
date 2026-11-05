"use client";

// 글자를 하나씩 보여 주는 타자기 효과. 시작 전 잠깐 기다린 뒤 speed(밀리초)마다 한 글자씩 늘어난다.
// 움직임을 줄여 달라는 설정을 쓰는 사용자에게는 처음부터 전체 글을 보여 준다.
import { useEffect, useState } from "react";

export function useTypewriter(text: string, speed = 38, startDelay = 600): { displayed: string; done: boolean } {
  // 어느 글에 대한 글자 수인지 함께 들고 있어서, 글이 바뀌면 자동으로 처음부터 시작한다.
  const [progress, setProgress] = useState({ text, count: 0 });
  const count = progress.text === text ? progress.count : 0;

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const instant = setTimeout(() => setProgress({ text, count: text.length }), 0);
      return () => clearTimeout(instant);
    }
    let interval: ReturnType<typeof setInterval> | undefined;
    const timer = setTimeout(() => {
      interval = setInterval(() => {
        setProgress((current) => {
          const done = current.text === text && current.count >= text.length;
          if (done) {
            clearInterval(interval);
            return current;
          }
          return { text, count: (current.text === text ? current.count : 0) + 1 };
        });
      }, speed);
    }, startDelay);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [text, speed, startDelay]);

  return { displayed: text.slice(0, count), done: count >= text.length };
}
