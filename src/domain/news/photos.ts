import table from "../../assets/news/mahjong-table.webp";
import sticks from "../../assets/news/mahjong-score-sticks.webp";
import quiet from "../../assets/news/quiet-table.webp";
import wall from "../../assets/news/tile-wall.webp";
import tray from "../../assets/news/score-tray.webp";
import dice from "../../assets/news/dice-closeup.webp";
import center from "../../assets/news/table-center.webp";
import facedown from "../../assets/news/facedown-tiles.webp";
import casePhoto from "../../assets/news/tile-case.webp";
import honors from "../../assets/news/honor-tiles.webp";
import opposite from "../../assets/news/opposite-walls.webp";
import evening from "../../assets/news/evening-table.webp";
import { copyHash } from "./editorial";
import type { CopyHistory } from "./repetition";

type Theme = "general" | "score" | "matchup" | "milestone" | "review";
export interface NewsPhoto { id: string; src: string; caption: string; alt: string; themes: Theme[] }
export const newsPhotos: NewsPhoto[] = [
  { id: "table", src: table, caption: "麻雀卓", alt: "緑の卓に並ぶ麻雀牌", themes: ["general", "matchup"] },
  { id: "sticks", src: sticks, caption: "点棒と麻雀牌", alt: "緑の卓上の点棒と麻雀牌", themes: ["score"] },
  { id: "quiet-table", src: quiet, caption: "対局前の卓", alt: "牌山を整えた無人の麻雀卓", themes: ["general"] },
  { id: "tile-wall", src: wall, caption: "二段に積まれた牌山", alt: "緑のマットに積まれた牌山の接写", themes: ["milestone", "matchup"] },
  { id: "score-tray", src: tray, caption: "点棒箱", alt: "仕切りのある点棒箱に収められた点棒", themes: ["score"] },
  { id: "dice-closeup", src: dice, caption: "卓上のサイコロ", alt: "緑のマットに置かれた二つのサイコロ", themes: ["general", "matchup"] },
  { id: "table-center", src: center, caption: "自動卓の中央部", alt: "自動麻雀卓の中央パネルとサイコロのケース", themes: ["matchup", "score"] },
  { id: "facedown-tiles", src: facedown, caption: "裏返した麻雀牌", alt: "卓に集められた黄色い背の麻雀牌", themes: ["review"] },
  { id: "tile-case", src: casePhoto, caption: "ケースに収めた麻雀牌", alt: "開いた収納ケースに並ぶ麻雀牌", themes: ["general", "review"] },
  { id: "honor-tiles", src: honors, caption: "白・發・中", alt: "緑の卓に並ぶ白・發・中の三種類の牌", themes: ["milestone"] },
  { id: "opposite-walls", src: opposite, caption: "向かい合う牌山", alt: "卓の両側に向かい合って並ぶ二つの牌山", themes: ["matchup"] },
  { id: "evening-table", src: evening, caption: "夜の麻雀卓", alt: "暖色の照明に照らされた無人の麻雀卓", themes: ["review"] },
];

// 最終更新: 2026-09-12 — 人物・実際の役・会場を推定せず、確定した記事テーマに合う物撮りを選ぶ。
function themeFor(event: string): Theme {
  if (/nemesis|favorite|duel|rival/.test(event)) return "matchup";
  if (/title|personal-daily-best|all-tops|three-tops|consecutive/.test(event)) return "milestone";
  if (/leader|hundred|positive/.test(event)) return "score";
  if (/negative|tough|no-last/.test(event)) return "review";
  return "general";
}

// 最終更新: 2026-09-12 — 冒頭写真は過去10開催日の再使用を避け、同日本文・関連記事・別端末で一致させる。
export function selectNewsPhotos(event: string, groupId: string, date: string, history: CopyHistory) {
  const theme = themeFor(event);
  const select = (slot: string, excluded?: string) => {
    const selected = newsPhotos.filter(p => p.id !== excluded).map(p => ({
      photo: p,
      used: history.score(`photo/${slot}/${p.id}`, { text: `news-photo-${slot}-${p.id}` }),
      matches: p.themes.includes(theme),
      tie: copyHash(`${groupId}/${date}/${slot}/${p.id}`),
    })).sort((a, b) => a.used - b.used || Number(b.matches) - Number(a.matches) || a.tie - b.tie)[0].photo;
    history.record(`photo/${slot}/${selected.id}`, { text: `news-photo-${slot}-${selected.id}` });
    return selected;
  };
  const lead = select("lead");
  return { lead: lead.id, secondary: select("secondary", lead.id).id };
}

// 最終更新: 2026-09-12 — URL・代替テキスト・キャプションを一か所で管理する。
export function newsPhoto(id: string): NewsPhoto {
  return newsPhotos.find(p => p.id === id) ?? newsPhotos[0];
}
