import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  webcrypto,
  pbkdf2Sync,
  createCipheriv,
  randomBytes,
} from "node:crypto";
import {
  EncryptedVault,
  VAULT_STORAGE_KEY,
  type Envelope,
} from "./EncryptedVault";
import { GitHubStore } from "./GitHubStore";
import { players } from "../config/players";
import { fixture } from "../test/fixtures";
const first = "test-only first phrase",
  second = "test-only second phrase";
const data = {
  version: 1 as const,
  players,
  games: [fixture("cipher-test", "2026-09-10")],
};
function sealed(): Envelope {
  const salt = randomBytes(16),
    iv = randomBytes(12);
  const key = pbkdf2Sync(
    JSON.stringify([first, second]),
    salt,
    600000,
    32,
    "sha256",
  );
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("JanRoku:shared:v1"));
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify(data), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return {
    version: 1,
    algorithm: "PBKDF2-SHA256/AES-256-GCM",
    iterations: 600000,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    ciphertext: bytes.toString("base64"),
  };
}
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());
it("標準暗号と相互運用し、再保存ではIVを再利用せず内容を維持する", async () => {
  const source = sealed(),
    vault = await EncryptedVault.unlock(source, first, second);
  expect(await vault.decode(source)).toEqual(data);
  const a = await vault.encode(data),
    b = await vault.encode(data);
  expect(a.iv).not.toBe(b.iv);
  expect(a.ciphertext).not.toBe(b.ciphertext);
  expect(await vault.decode(a)).toEqual(data);
  expect(JSON.stringify(a)).not.toContain(players[0].name);
});
it("合言葉の誤り・順序違い・改ざん・平文を拒否する", async () => {
  const source = sealed();
  await expect(EncryptedVault.unlock(source, second, first)).rejects.toThrow();
  await expect(EncryptedVault.unlock(source, first, "wrong")).rejects.toThrow();
  const vault = await EncryptedVault.unlock(source, first, second);
  const bytes = Buffer.from(source.ciphertext, "base64");
  bytes[0] ^= 1;
  await expect(
    vault.decode({ ...source, ciphertext: bytes.toString("base64") }),
  ).rejects.toThrow();
  await expect(vault.decode(data)).rejects.toThrow();
  await expect(vault.decode({ ...source, iterations: 1 })).rejects.toThrow();
});
it("端末保存で再開でき、保存解除・異なる鍵では復号できない", async () => {
  const source = sealed(),
    vault = await EncryptedVault.unlock(source, first, second);
  await vault.remember(localStorage);
  const saved = localStorage.getItem(VAULT_STORAGE_KEY)!;
  expect(saved).not.toContain(first);
  expect(saved).not.toContain(second);
  expect(
    await (await EncryptedVault.restore(source, localStorage))!.decode(source),
  ).toEqual(data);
  expect(await EncryptedVault.restore(sealed(), localStorage)).toBeNull();
  expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeNull();
  await vault.remember(localStorage);
  localStorage.removeItem(VAULT_STORAGE_KEY);
  expect(await EncryptedVault.restore(source, localStorage)).toBeNull();
});
it("GitHubへの読み書きに平文を送らず、既存の競合処理で再暗号化する", async () => {
  let source = sealed(),
    put = 0;
  const vault = await EncryptedVault.unlock(source, first, second);
  const request: typeof fetch = async (url, init) => {
    if (String(url).endsWith("/JanRoku"))
      return Response.json({ permissions: { push: true } });
    if (init?.method === "PUT") {
      const body = JSON.parse(String(init.body));
      const sent = JSON.parse(atob(body.content));
      expect(sent.algorithm).toBe("PBKDF2-SHA256/AES-256-GCM");
      expect(JSON.stringify(sent)).not.toContain("追加テスト");
      source = sent;
      put++;
      return Response.json({ content: { sha: String(put) } });
    }
    if (String(url).includes("raw.githubusercontent.com"))
      return Response.json(source);
    return Response.json({
      content: btoa(JSON.stringify(source)),
      sha: String(put),
    });
  };
  const store = new GitHubStore(request, () => localStorage, vault);
  expect(await store.playerRepository.getPlayers()).toEqual(players);
  await store.connect("test-token");
  await store.playerRepository.addPlayer("追加テスト");
  expect((await vault.decode(source)).players.at(-1)!.name).toBe("追加テスト");
  expect(put).toBe(1);
});
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnlockPage } from '../pages/UnlockPage';
it('解除前は名前を表示せず、合言葉の確認後だけ戦績を開き保存した鍵で再開する',async()=>{
 const source=sealed();vi.stubGlobal('fetch',vi.fn(async()=>Response.json(source)));
 const user=userEvent.setup();const view=render(<UnlockPage />);
 await screen.findByRole('button',{name:'戦績を開く'});
 expect(screen.queryByText(players[0].name)).toBeNull();
 await user.type(screen.getByLabelText('合言葉1'),first);
 await user.type(screen.getByLabelText('合言葉2'),'wrong');
 await user.click(screen.getByRole('button',{name:'戦績を開く'}));
 await screen.findByRole('alert');expect(screen.queryByText(players[0].name)).toBeNull();
 await user.clear(screen.getByLabelText('合言葉2'));await user.type(screen.getByLabelText('合言葉2'),second);
 await user.click(screen.getByRole('button',{name:'戦績を開く'}));
 await screen.findByRole('heading',{name:'戦績ランキング'});
 expect(localStorage.getItem(VAULT_STORAGE_KEY)).toBeTruthy();
 view.unmount();render(<UnlockPage />);
 await screen.findByRole('heading',{name:'戦績ランキング'});
 expect(screen.getByRole('button',{name:'ロック'})).toBeTruthy();
});
