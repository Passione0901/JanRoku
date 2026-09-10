import type { DataCodec } from "./EncryptedVault";
import type { GameRepository } from "./GameRepository";
import { normalize, type PlayerRepository } from "./PlayerRepository";
import { players } from "../config/players";
import { validateShared, type SharedData } from "./sharedData";
export const TOKEN_STORAGE_KEY = "janroku.JanRoku.github-token.v1";
export const SYNC_REPO = "Passione0901/JanRoku";
const endpoint = `https://api.github.com/repos/${SYNC_REPO}/contents/data/encrypted.json`;
// 最終更新: 2026-09-10 — GitHubのSHAを用いて同時書き込みを検出し、認証済みトークンを端末に保存して接続を復元する。
export class GitHubStore {
  private token = "";
  private snapshot?: { data: SharedData; sha: string };
  private fetched = 0;
  private pending?: Promise<{ data: SharedData; sha: string }>;
  private listeners = new Set<() => void>();
  private timer?: ReturnType<typeof setInterval>;
  private writing = false;
  constructor(
    private request: typeof fetch = (input, init) =>
      globalThis.fetch(input, init),
    private credentialStorage: () => Pick<
      Storage,
      "getItem" | "setItem" | "removeItem"
    > = () => window.localStorage,
    private codec?: DataCodec,
  ) {
    try {
      this.token = this.credentialStorage().getItem(TOKEN_STORAGE_KEY) ?? "";
    } catch {
      /* 保存領域が無効でも閲覧は可能。 */
    }
  }
  get authenticated() {
    return !!this.token;
  }
  private headers() {
    return {
      Accept: "application/vnd.github+json",
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }
  private async response(url: string, init?: RequestInit) {
    let r: Response;
    try {
      r = await this.request(url, {
        ...init,
        headers: { ...this.headers(), ...init?.headers },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
    } catch {
      throw new Error(
        "GitHubと通信できません。通信状況を確認し、再読み込みしてください。保存操作中の場合は履歴で反映を確認してから再試行してください。",
      );
    }
    if (r.status === 401) {
      this.token = "";
      try {
        this.credentialStorage().removeItem(TOKEN_STORAGE_KEY);
      } catch {
        /* 認証エラーの案内を優先。 */
      }
    }
    if (!r.ok && r.status !== 409)
      throw new Error(
        r.status === 401
          ? "認証が期限切れ、または無効です。同期設定で再接続してください。"
          : r.status === 403
            ? "GitHubの権限または利用回数制限を確認してください。保存にはContentsの書き込み権限が必要です。"
            : `GitHubへの接続に失敗しました（${r.status}）。同期設定から再読み込みしてください。`,
      );
    return r;
  }
  async connect(token: string) {
    this.token = token.trim();
    if (!this.token) throw new Error("トークンを入力してください。");
    try {
      const r = await this.response(
        `https://api.github.com/repos/${SYNC_REPO}`,
      );
      const repo = (await r.json()) as { permissions?: { push?: boolean } };
      if (!repo.permissions?.push)
        throw new Error("このリポジトリへの書き込み権限がありません。");
      await this.refresh();
      try {
        this.credentialStorage().setItem(TOKEN_STORAGE_KEY, this.token);
      } catch {
        throw new Error(
          "この端末にトークンを保存できません。ブラウザーの保存設定・空き容量を確認してください。",
        );
      }
    } catch (e) {
      this.token = "";
      throw e;
    }
  }
  disconnect() {
    this.token = "";
    try {
      this.credentialStorage().removeItem(TOKEN_STORAGE_KEY);
    } catch {
      throw new Error(
        "保存済みトークンを削除できません。ブラウザーのサイトデータを削除してください。",
      );
    }
    this.fetched = 0;
    this.emit();
  }
  private emit() {
    for (const listener of this.listeners) listener();
  }
  async read(force = false): Promise<{ data: SharedData; sha: string }> {
    if (this.pending) return this.pending;
    if (!force && this.snapshot && Date.now() - this.fetched < 15000)
      return structuredClone(this.snapshot);
    const task = (async () => {
      if (this.codec && !this.token) {
        const r = await this.response(
          "https://raw.githubusercontent.com/Passione0901/JanRoku/main/data/encrypted.json",
        );
        const data = await this.codec.decode(await r.json());
        this.snapshot = { data, sha: "public" };
        this.fetched = Date.now();
        return structuredClone(this.snapshot);
      }
      const r = await this.response(`${endpoint}?ref=main`);
      if (r.status === 409) throw new Error("共有データを取得できません。");
      const file = (await r.json()) as { content?: string; sha?: string };
      if (!file.content || !file.sha)
        throw new Error("共有データを取得できません。");
      const bytes = Uint8Array.from(
        atob(file.content.replace(/\s/g, "")),
        (c) => c.charCodeAt(0),
      );
      const payload = JSON.parse(new TextDecoder().decode(bytes));
      const data = this.codec
        ? await this.codec.decode(payload)
        : validateShared(payload);
      this.snapshot = { data, sha: file.sha };
      this.fetched = Date.now();
      return structuredClone(this.snapshot);
    })();
    this.pending = task;
    try {
      return await task;
    } finally {
      this.pending = undefined;
    }
  }
  async refresh() {
    this.fetched = 0;
    await this.read(true);
    this.emit();
  }
  async mutate(change: (data: SharedData) => SharedData): Promise<void> {
    if (!this.token)
      throw new Error(
        "保存にはGitHub認証が必要です。画面上部の「同期設定」から接続してください。",
      );
    if (this.writing) throw new Error("保存中です。少しお待ちください。");
    this.writing = true;
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const current = await this.read(true);
        const next = validateShared(change(structuredClone(current.data)));
        const encoded = Array.from(
          new TextEncoder().encode(
            JSON.stringify(this.codec ? await this.codec.encode(next) : next),
          ),
          (byte) => String.fromCharCode(byte),
        ).join("");
        const r = await this.response(endpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "Update shared Mahjong records",
            branch: "main",
            sha: current.sha,
            content: btoa(encoded),
          }),
        });
        if (r.status === 409) {
          this.fetched = 0;
          continue;
        }
        const saved = (await r.json()) as { content: { sha: string } };
        this.snapshot = { data: next, sha: saved.content.sha };
        this.fetched = Date.now();
        this.emit();
        return;
      }
      throw new Error(
        "別の端末で更新されました。再読み込みしてからやり直してください。",
      );
    } finally {
      this.writing = false;
    }
  }
  // 最終更新: 2026-09-10 — 閲覧時は2分、認証後は30秒で更新。非表示タブの通信は止める。
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (!this.timer) {
      this.timer = setInterval(() => {
        if (
          document.visibilityState === "visible" &&
          Date.now() - this.fetched > (this.token ? 30000 : 120000)
        ) {
          this.fetched = 0;
          this.emit();
        }
      }, 15000);
      window.addEventListener("focus", this.onFocus);
    }
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) {
        clearInterval(this.timer);
        this.timer = undefined;
        window.removeEventListener("focus", this.onFocus);
      }
    };
  };
  private onFocus = () => {
    if (Date.now() - this.fetched > 15000) {
      this.fetched = 0;
      this.emit();
    }
  };
  readonly playerRepository: PlayerRepository = {
    // 最終更新: 2026-09-10 — 最新の共有対局を確認し、参照中のメンバーは削除しない。
    deletePlayer: async (id) => {
      await this.mutate((d) => {
        if (d.games.some((g) => g.players.some((p) => p.playerId === id)))
          throw new Error(
            "このメンバーの対局履歴があります。履歴から該当する対局を削除してから、もう一度お試しください。",
          );
        d.players = d.players.filter((p) => p.id !== id);
        return d;
      });
    },
    getPlayers: async () => (await this.read()).data.players,
    subscribe: this.subscribe,
    addPlayer: async (input) => {
      const name = normalize(input);
      const player = {
        id: `member-${crypto.randomUUID()}`,
        name,
        color: players[Math.floor(Math.random() * players.length)].color,
      };
      await this.mutate((d) => {
        if (
          d.players.some(
            (p) => normalize(p.name).toLowerCase() === name.toLowerCase(),
          )
        )
          throw new Error("同じ名前のメンバーがいます。");
        d.players.push(player);
        return d;
      });
      return player;
    },
  };
  private observed = new Map<string, string>();
  readonly gameRepository: GameRepository = {
    getGames: async () => {
      const games = (await this.read()).data.games;
      this.observed = new Map(games.map((g) => [g.id, JSON.stringify(g)]));
      return games.map((g) => ({ ...g, syncRevision: JSON.stringify(g) }));
    },
    subscribe: this.subscribe,
    addGame: async (game) => {
      await this.mutate((d) => {
        const old = d.games.find((g) => g.id === game.id);
        if (old) {
          if (JSON.stringify(old) === JSON.stringify(game)) return d;
          throw new Error("この対局はすでに登録されています。");
        }
        d.games.push(game);
        return d;
      });
    },
    updateGame: async (game) => {
      const expected = game.syncRevision ?? this.observed.get(game.id);
      const { syncRevision: _revision, ...record } = game;
      await this.mutate((d) => {
        const old = d.games.find((g) => g.id === game.id);
        if (!old || JSON.stringify(old) !== expected)
          throw new Error(
            "別の端末で対局が変更・削除されました。編集画面を開き直してください。",
          );
        d.games = d.games.map((g) =>
          g.id === game.id ? { ...record, createdAt: old.createdAt } : g,
        );
        return d;
      });
    },
    deleteGame: async (id, expectedRevision) => {
      const expected = expectedRevision ?? this.observed.get(id);
      await this.mutate((d) => {
        const old = d.games.find((g) => g.id === id);
        if (old && JSON.stringify(old) !== expected)
          throw new Error(
            "別の端末で対局が変更されました。再読み込みしてください。",
          );
        d.games = d.games.filter((g) => g.id !== id);
        return d;
      });
    },
    resetToSample: async () => {
      throw new Error("共有データではサンプルへの初期化はできません。");
    },
  };
}
