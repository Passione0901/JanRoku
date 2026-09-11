import { EncryptedVault, UnlockMismatchError } from "./EncryptedVault";
import { groups, type GroupId } from "./groups";

export type GroupPayloads = Record<GroupId, unknown>;

// 最終更新: 2026-09-11 — 復号に成功したデータの保存先だけを使い、組の手動選択を不要にする。
export async function unlockGroups(
  payloads: GroupPayloads,
  first: string,
  second: string,
) {
  for (const { id } of groups) {
    try {
      const vault = await EncryptedVault.unlock(payloads[id], first, second);
      return { id, vault };
    } catch (error) {
      if (!(error instanceof UnlockMismatchError)) throw error;
    }
  }
  return null;
}
