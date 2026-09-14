import { useEffect, useState } from "react";
import { routeFromHash } from '../utils/sharedNavigation';

// 最終更新: 2026-09-10 — hash遷移なので静的ホスト側のリライト設定は不要。
export function useRoute() {
  const [route, setRoute] = useState(() => routeFromHash(window.location.hash));
  useEffect(() => {
    const onChange = () => {
      setRoute(routeFromHash(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
