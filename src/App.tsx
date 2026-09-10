import { ThemeToggle } from "./components/ThemeToggle";
import { rememberPlayers } from "./data/lastPlayers";
import { SyncPage } from "./pages/SyncPage";
import type { GitHubStore } from "./data/GitHubStore";
import { PlayersProvider, usePlayers } from "./hooks/usePlayers";
import {
  LocalStoragePlayerRepository,
  type PlayerRepository,
} from "./data/PlayerRepository";
import { MembersPage } from "./pages/MembersPage";
import { useState } from "react";
import {
  BarChart3,
  Users,
  CalendarDays,
  History,
  Plus,
  Settings2,
  CheckCircle2,
  X,
} from "lucide-react";
import { LocalStorageGameRepository } from "./data/LocalStorageGameRepository";
import type { GameRepository } from "./data/GameRepository";
import { useGames } from "./hooks/useGames";
import { useRoute } from "./hooks/useRoute";
import { useStatsTools } from "./hooks/useStatsTools";
import { RankingPage } from "./pages/RankingPage";
import { InputPage } from "./pages/InputPage";
import { HistoryPage } from "./pages/HistoryPage";
import { DailyPage } from "./pages/DailyPage";
import { PlayerPage } from "./pages/PlayerPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ConfirmDialog } from "./components/ConfirmDialog";
import type { Game } from "./domain/types";
import { formatDate } from "./utils/date";

const repository = new LocalStorageGameRepository();
const playerStore = new LocalStoragePlayerRepository();
const links = [
  { href: "/input", label: "入力", Icon: Plus },
  { href: "/", label: "戦績", Icon: BarChart3 },
  { href: "/daily", label: "日別", Icon: CalendarDays },
  { href: "/history", label: "履歴", Icon: History },
  { href: "/members", label: "メンバー", Icon: Users },
];

// 最終更新: 2026-09-10 — アプリの画面遷移と共有データの所有をこのシェルへ限定する。
export default function App({
  gameRepository = repository,
  playerRepository = playerStore,
  syncStore,
  onLock,
}: {
  gameRepository?: GameRepository;
  playerRepository?: PlayerRepository;
  syncStore?: GitHubStore;
  onLock?: () => void;
}) {
  const topRoute = useRoute();
  if (topRoute === "/sync" && syncStore)
    return (
      <div className="app-shell">
        <main className="main-content">
          <a className="back-link" href="#/">
            戦績に戻る
          </a>
          <ThemeToggle />
          {onLock && (
            <button className="button subtle" onClick={onLock}>
              ロック
            </button>
          )}
          <SyncPage store={syncStore} />
        </main>
      </div>
    );
  return (
    <PlayersProvider repository={playerRepository}>
      <AppContent
        gameRepository={gameRepository}
        syncStore={syncStore}
        onLock={onLock}
      />
    </PlayersProvider>
  );
}
function AppContent({
  syncStore,
  onLock,
  gameRepository = repository,
}: {
  gameRepository?: GameRepository;
  syncStore?: GitHubStore;
  onLock?: () => void;
}) {
  const route = useRoute();
  const { players } = usePlayers();
  const data = useGames(gameRepository, players);
  useStatsTools(data.stats);
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Game | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const activeRoute = route.startsWith("/players/")
    ? "/"
    : route.startsWith("/edit/")
      ? "/input"
      : route.startsWith("/daily/")
        ? "/daily"
        : route;
  const saveGame = async (game: Game, editing: boolean) => {
    await data.saveGame(game, editing);
    if (!editing)
      rememberPlayers(game.players.map((player) => player.playerId));
    setNotice(editing ? "対局を更新しました。" : "対局を登録しました。");
    window.location.hash = "/";
  };
  const requestDelete = (game: Game) => {
    setDeleteError("");
    setDeleteTarget(game);
  };
  const deleteGame = async () => {
    if (!deleteTarget) return;
    try {
      await data.deleteGame(deleteTarget.id, deleteTarget.syncRevision);
      setDeleteTarget(null);
      setNotice("対局を削除しました。");
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "削除できませんでした。",
      );
    }
  };
  const page = () => {
    if (route === "/sync" && syncStore) return <SyncPage store={syncStore} />;
    if (route === "/members") return <MembersPage shared={!!syncStore} />;
    if (route === "/settings")
      return (
        <SettingsPage
          shared={!!syncStore}
          gameCount={data.games.length}
          busy={data.busy}
          onReset={async () => {
            await data.reset();
            setNotice("48半荘のサンプルデータに戻しました。");
          }}
        />
      );
    if (data.loading)
      return <div className="empty-state">戦績を読み込み中…</div>;
    if (data.error && route !== "/input" && !route.startsWith("/edit/"))
      return (
        <div className="error-panel" role="alert">
          <p>{data.error}</p>
          <button
            className="button subtle"
            onClick={() => {
              void data.reload();
            }}
          >
            もう一度読み込む
          </button>{" "}
          <a href="#/settings" className="button subtle">
            データ設定を開く
          </a>
        </div>
      );
    if (route === "/")
      return (
        <RankingPage
          stats={data.stats}
          gameCount={data.games.length}
          days={data.days}
        />
      );
    if (route === "/input")
      return <InputPage key="new" onSave={saveGame} busy={data.busy} />;
    if (route === "/history")
      return (
        <HistoryPage
          games={data.games}
          onDelete={requestDelete}
          busy={data.busy}
        />
      );
    if (route === "/daily" || route.startsWith("/daily/"))
      return (
        <DailyPage
          days={data.days}
          selectedDate={route.split("/")[2]}
          onDelete={requestDelete}
          busy={data.busy}
        />
      );
    if (route.startsWith("/players/")) {
      const stats = data.stats.find(
        (stats) => stats.playerId === route.split("/")[2],
      );
      if (stats) return <PlayerPage key={stats.playerId} stats={stats} />;
    }
    if (route.startsWith("/edit/")) {
      const game = data.games.find((game) => game.id === route.split("/")[2]);
      if (game)
        return (
          <InputPage
            key={game.id}
            game={game}
            onSave={saveGame}
            busy={data.busy}
          />
        );
    }
    return (
      <div className="empty-state">
        <p>指定されたページ・対局が見つかりません。</p>
        <a className="button primary" href="#/">
          戦績に戻る
        </a>
      </div>
    );
  };
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        本文へ移動
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#/" aria-label="雀録 ホーム">
            <span className="brand-mark">雀</span>
            <span>
              雀録<small>Jang-roku</small>
            </span>
          </a>
          <nav className="desktop-nav" aria-label="メインナビゲーション">
            {links.map(({ href, label, Icon }) => (
              <a
                key={href}
                href={`#${href}`}
                className={activeRoute === href ? "active" : ""}
                aria-current={activeRoute === href ? "page" : undefined}
              >
                <Icon size={17} />
                {label}
              </a>
            ))}
          </nav>
          <div className="header-actions">
            <ThemeToggle />
            {onLock && (
              <button className="button subtle" onClick={onLock}>
                ロック
              </button>
            )}
            {syncStore && (
              <a className="button subtle" href="#/sync">
                同期設定
              </a>
            )}
            <span className="local-badge">
              {syncStore ? "共有データ" : "端末保存"}
            </span>
            <a className="icon-button" href="#/settings" aria-label="設定">
              <Settings2 size={19} />
            </a>
          </div>
        </div>
      </header>
      <main id="main-content" className="main-content" tabIndex={-1}>
        {notice && (
          <div className="notice" role="status">
            <CheckCircle2 size={17} />
            <span>{notice}</span>
            <button
              className="icon-button"
              onClick={() => setNotice("")}
              aria-label="通知を閉じる"
            >
              <X size={17} />
            </button>
          </div>
        )}
        {data.error && (route === "/input" || route.startsWith("/edit/")) && (
          <p role="alert" className="negative">
            同期エラー：{data.error}
          </p>
        )}
        {page()}
      </main>
      <footer className="site-footer">
        <span className="footer-brand">
          雀録 <small>Jang-roku</small>
        </span>
        <span>
          {syncStore
            ? "記録は暗号化して共有されます"
            : "記録はこのブラウザーに保存されます"}
        </span>
        <a href="#/settings">
          ルール・データ設定 <Settings2 size={13} />
        </a>
      </footer>
      <nav className="bottom-nav" aria-label="モバイルナビゲーション">
        {links.map(({ href, label, Icon }) => (
          <a
            key={href}
            href={`#${href}`}
            className={`${activeRoute === href ? "active" : ""} ${href === "/input" ? "input-nav" : ""}`}
            aria-current={activeRoute === href ? "page" : undefined}
          >
            <Icon size={21} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      {deleteTarget && (
        <ConfirmDialog
          title="この対局を削除しますか？"
          confirmLabel="削除する"
          danger
          busy={data.busy}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => {
            void deleteGame();
          }}
        >
          <p>
            {formatDate(deleteTarget.date)}
            の4人分の記録を削除し、戦績に反映します。この操作は取り消せません。
          </p>
          {deleteError && (
            <p className="negative" role="alert">
              {deleteError}
            </p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}
