// Updated 2026-09-13: Use the same concise invitation in every participant sharing action.
export function invitationText(groupName: string, url: string): string {
  return `【雀録 / Jang-roku】${groupName}\n麻雀の点数・収支を記録して、仲間と戦績を共有できるツールです。\nこちらからグループに参加して、戦績を閲覧・入力できます。\n${url}`;
}
