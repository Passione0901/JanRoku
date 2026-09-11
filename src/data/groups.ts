// 最終更新: 2026-09-11 — 保存先を固定し、麻雀会をまたぐ読み書きを防ぐ。
export const groups = [
  { id: "main", path: "data/encrypted.json" },
  { id: "second", path: "data/groups/second.json" },
] as const;
export type GroupId = (typeof groups)[number]["id"];
export const ACTIVE_GROUP_KEY = "janroku.active-group.v1";
export function groupInfo(id: GroupId) {
  const group = groups.find((group) => group.id === id);
  if (!group) throw new Error("合言葉を入力し直してください。");
  return group;
}
export function groupStorageKey(key: string, id: GroupId): string {
  return id === "main" ? key : `${key}.${id}`;
}
export function groupFileUrl(id: GroupId): string {
  return `https://raw.githubusercontent.com/Passione0901/JanRoku/main/${groupInfo(id).path}`;
}
