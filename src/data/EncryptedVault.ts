export class UnlockMismatchError extends Error {}
import { validateShared, type SharedData } from "./sharedData";

export const VAULT_STORAGE_KEY = "janroku.JanRoku.unlock.v1";
const iterations = 600_000;
const aad = new TextEncoder().encode("JanRoku:shared:v1");
export interface Envelope {
  version: 1;
  algorithm: "PBKDF2-SHA256/AES-256-GCM";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}
export interface DataCodec {
  decode(value: unknown): Promise<SharedData>;
  encode(data: SharedData): Promise<unknown>;
}
export function toBase64(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}
export function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  if (
    typeof value !== "string" ||
    value.length > 12_000_000 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      value,
    )
  )
    throw new Error("暗号化データの形式が不正です。");
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
// 最終更新: 2026-09-10 — 形式・鍵導出コストを固定し、不正な暗号文を復号前に拒否する。
export function envelope(value: unknown): Envelope {
  const e = value as Envelope;
  if (
    !e ||
    e.version !== 1 ||
    e.algorithm !== "PBKDF2-SHA256/AES-256-GCM" ||
    e.iterations !== iterations ||
    fromBase64(e.salt).length !== 16 ||
    fromBase64(e.iv).length !== 12 ||
    fromBase64(e.ciphertext).length < 16
  )
    throw new Error("暗号化データの形式が不正です。");
  return e;
}
export class EncryptedVault implements DataCodec {
  private constructor(
    private key: CryptoKey,
    private salt: string,
  ) {}
  // 最終更新: 2026-09-10 — 2つの合言葉は順序と境界を保持して鍵を導出する。
  static async unlock(value: unknown, first: string, second: string) {
    const e = envelope(value);
    if (!first || !second) throw new Error("2つの合言葉を入力してください。");
    const material = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(
        JSON.stringify([first.normalize("NFC"), second.normalize("NFC")]),
      ),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(e.salt), iterations },
      material,
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
    const vault = new EncryptedVault(key, e.salt);
    await vault.decode(e);
    return vault;
  }
  static async restore(
    value: unknown,
    storage: Storage,
  ): Promise<EncryptedVault | null> {
    const saved = storage.getItem(VAULT_STORAGE_KEY);
    if (!saved) return null;
    try {
      const record = JSON.parse(saved);
      const e = envelope(value);
      if (record.salt !== e.salt || fromBase64(record.key).length !== 32)
        throw new Error();
      const key = await crypto.subtle.importKey(
        "raw",
        fromBase64(record.key),
        "AES-GCM",
        true,
        ["encrypt", "decrypt"],
      );
      const vault = new EncryptedVault(key, e.salt);
      await vault.decode(e);
      return vault;
    } catch {
      storage.removeItem(VAULT_STORAGE_KEY);
      return null;
    }
  }
  // 合言葉の文字列ではなく復号鍵を保存する。端末内のこの鍵も秘密情報として扱う。
  async remember(storage: Storage) {
    const key = toBase64(
      new Uint8Array(await crypto.subtle.exportKey("raw", this.key)),
    );
    storage.setItem(
      VAULT_STORAGE_KEY,
      JSON.stringify({ key, salt: this.salt }),
    );
  }
  async decode(value: unknown): Promise<SharedData> {
    const e = envelope(value);
    if (e.salt !== this.salt)
      throw new Error(
        "合言葉が変更されました。ロックしてから開き直してください。",
      );
    let plain: ArrayBuffer;
    try {
      plain = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: fromBase64(e.iv),
          additionalData: aad,
          tagLength: 128,
        },
        this.key,
        fromBase64(e.ciphertext),
      );
    } catch {
      throw new UnlockMismatchError(
        "合言葉が違うか、暗号化データが破損しています。",
      );
    }
    return validateShared(JSON.parse(new TextDecoder().decode(plain)));
  }
  async encode(data: SharedData): Promise<Envelope> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad, tagLength: 128 },
      this.key,
      new TextEncoder().encode(JSON.stringify(validateShared(data))),
    );
    return {
      version: 1,
      algorithm: "PBKDF2-SHA256/AES-256-GCM",
      iterations,
      salt: this.salt,
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(ciphertext)),
    };
  }
}
