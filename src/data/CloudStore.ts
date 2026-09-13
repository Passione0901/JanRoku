import type { Game, Player, RuleConfig } from '../domain/types';
import type { GameRepository } from './GameRepository';
import type { PlayerRepository } from './PlayerRepository';
import { normalize } from './PlayerRepository';
import { fingerprint } from './sharedData';
import { entryRules } from '../config/rules';

export const SHARED_API = 'https://janroku-api.janroku-one.workers.dev';
type Change = { revision: string; kind: string; id: string; action: string; data: Game | Player | null };
type SyncData = { group: { id: string; name: string; role: 'admin' | 'participant' }; revision: number; cursor: number; rules: RuleConfig; rulesRevision: string; changes: Change[] };
export const invitationUrl = (token: string) => `${location.origin}${location.pathname}#/join/${token}`;
export const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), x => x.toString(16).padStart(2, '0')).join('');

// Updated 2026-09-13: Each tab owns one group and its in-memory cache; URLs never cross group boundaries.
export class CloudStore {
  group: SyncData['group'] = { id: '', name: '', role: 'participant' };
  rules = entryRules;
  rulesRevision = '';
  error = '';
  unauthorized = false;
  lastSynced = '';
  private cursor = 0;
  private games = new Map<string, Game>();
  private players = new Map<string, Player>();
  private memberRevisions = new Map<string, string>();
  private listeners = new Set<() => void>();
  private pending?: Promise<void>;
  constructor(readonly token: string) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { this.listeners.forEach(listener => listener()); }
  async request<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${SHARED_API}${path}`, {
      method: body ? 'POST' : 'GET', cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: { Authorization: `Bearer ${this.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) { this.unauthorized = true; this.games.clear(); this.players.clear(); this.emit(); }
      throw Object.assign(new Error(data.error ?? 'サーバーに接続できませんでした。'), { status: response.status });
    }
    return data as T;
  }
  // Updated 2026-09-13: Resume from the last complete page; serialize overlapping refreshes.
  sync = (): Promise<void> => {
    if (this.pending) return this.pending;
    this.pending = (async () => {
      try {
        let more = true;
        while (more) {
          const data = await this.request<SyncData>(`/sync?since=${this.cursor}`);
          if (this.group.id && data.group.id !== this.group.id) throw new Error('共有先が変わりました。URLを開き直してください。');
          this.group = data.group; this.rules = data.rules; this.rulesRevision = data.rulesRevision;
          for (const change of data.changes) {
            if (change.kind === 'game') {
              if (change.data) this.games.set(change.id, { ...change.data as Game, syncRevision: change.revision });
              else this.games.delete(change.id);
            }
            if (change.kind === 'member') {
              if (change.data) { this.players.set(change.id, change.data as Player); this.memberRevisions.set(change.id, change.revision); }
              else { this.players.delete(change.id); this.memberRevisions.delete(change.id); }
            }
          }
          if (data.cursor === this.cursor && data.revision > this.cursor) throw new Error('同期データを読み込めませんでした。');
          this.cursor = data.cursor; more = data.cursor < data.revision;
        }
        this.error = ''; this.lastSynced = new Date().toISOString();
      } catch (e) { this.error = e instanceof Error ? e.message : '同期できませんでした。'; throw e; }
      finally { this.emit(); }
    })().finally(() => { this.pending = undefined; });
    return this.pending;
  };
  async mutate(body: Record<string, unknown>) {
    const operation = { ...body, requestId: crypto.randomUUID() };
    try { await this.request('/mutation', operation); }
    catch (e) {
      // A lost response may already have committed. Retry exactly the same operation ID.
      if (!(e instanceof Error) || !('status' in e)) await this.request('/mutation', operation);
      else { if (e.status === 409) await this.sync().catch(() => {}); throw e; }
    }
    // A successful save stays successful even if its following refresh loses connectivity.
    if (this.pending) await this.pending.catch(() => {});
    await this.sync().catch(() => {});
  }
  saveRules = async (rules: RuleConfig, expected = this.rules) => {
    if (fingerprint(expected) !== fingerprint(this.rules)) throw new Error('ルールが更新されています。設定画面を開き直してください。');
    await this.mutate({ kind: 'rules', action: 'save', data: rules, expected: this.rulesRevision });
  };
  gameRepository: GameRepository = {
    getGames: async () => structuredClone([...this.games.values()]),
    addGame: async game => this.mutate({ kind: 'game', action: 'add', id: game.id, data: game }),
    updateGame: async game => this.mutate({ kind: 'game', action: 'save', id: game.id, data: game, expected: game.syncRevision }),
    deleteGame: async (id, expected) => this.mutate({ kind: 'game', action: 'delete', id, expected }),
    resetToSample: async () => { throw new Error('共有データをサンプルに置き換えることはできません。'); },
    subscribe: this.subscribe,
  };
  playerRepository: PlayerRepository = {
    getPlayers: async () => structuredClone([...this.players.values()]),
    addPlayer: async input => {
      const player = { id: `member-${crypto.randomUUID()}`, name: normalize(input), color: '#7f9a8a' };
      await this.mutate({ kind: 'member', action: 'add', id: player.id, data: player });
      return player;
    },
    deletePlayer: async id => this.mutate({ kind: 'member', action: 'delete', id, expected: this.memberRevisions.get(id) }),
    subscribe: this.subscribe,
  };
  backup() { return { version: 1, players: [...this.players.values()], games: [...this.games.values()].map(({ syncRevision: _revision, ...game }) => game), rules: this.rules }; }
  async rotateInvitation(token: string) {
    const tokenHash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))), x => x.toString(16).padStart(2, '0')).join('');
    await this.mutate({ kind: 'access_key', action: 'rotate', tokenHash });
  }
}
