import { useEffect, useState } from "react";
import { isNewsAvailable, newsAvailableAt } from "../domain/news/availability";

// 最終更新: 2026-09-12 — 開いたままの午前0時と、スリープ・タブ復帰の両方で公開可否を更新する。
export function useNewsAvailability(date: string) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      const current = Date.now();
      setNow(current);
      const remaining = newsAvailableAt(date) - current;
      if (remaining > 0 && Number.isFinite(remaining))
        timer = setTimeout(update, Math.min(remaining, 2_147_000_000));
    };
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [date]);
  return isNewsAvailable(date, now);
}
