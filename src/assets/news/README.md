# ニュース用イメージ画像

2026-09-12 に OpenAI の組み込み画像生成ツールで生成。実際の参加者・開催日の写真ではありません。記事内では「生成イメージ」として表示します。
生成した PNG を WebP（品質 82）へ変換しています。CLI による生成は使用していません。

## 追加画像10種類（2026-09-12）

人物・手・実際の参加者は描いていません。室内の自然な光、緑の卓、日常的な麻雀用具を中心にした写真調です。各1536 × 1024。組み込み `image_gen` で生成し、サイコロの目と夜の卓の牌面は同ツールで修正した後、SharpでWebPへ変換しました。

| ファイル | 題材 |
| --- | --- |
| quiet-table.webp | 対局前の無人の卓 |
| tile-wall.webp | 二段に積まれた牌山の接写 |
| score-tray.webp | 整理された点棒箱 |
| dice-closeup.webp | 卓上の二つのサイコロ |
| table-center.webp | 自動卓の中央部 |
| facedown-tiles.webp | 卓上に集めた裏向きの牌 |
| tile-case.webp | 収納ケースに収めた牌 |
| honor-tiles.webp | 白・發・中の三種類の牌 |
| opposite-walls.webp | 向かい合う牌山 |
| evening-table.webp | 片付け時の夜の卓 |

生成と修正の最終プロンプトは [generation-prompts.json](./generation-prompts.json) に保存しています。原本PNGは生成ツールの保存先に保持し、このフォルダーのWebPをサイトに配信します。

既存画像と合わせた12枚を `src/domain/news/photos.ts` で管理します。記事の話題に合う写真を優先しつつ、冒頭写真は同じ会の直近10開催日との重複を避けます。本文・関連記事・サイドバーは同じ日の画像を共有し、再閲覧や未来の日の追加では変わりません。長文のみ2枚目を添え、本文内では別の写真にします。牌や点棒は題材を示すイメージで、特定の役・得点・開催会場の証拠として扱いません。

## mahjong-table.webp

1536 × 1024。記事冒頭の麻雀卓イメージ。

生成プロンプト:

```text
Use case: photorealistic-natural. Asset type: a landscape editorial stock image for a Japanese mahjong sports news article. Generate one 1536x1024 image. A close, documentary-style view across a real Japanese riichi mahjong table: deep green felt, a tidy row of ivory Japanese mahjong tiles with traditional red, green and black engraved markings near the camera, a short two-level wall of tiles farther back, and two small white dice on the felt. Natural indoor daylight and warm room light, believable used materials, restrained realistic colors, shallow depth of field with the near tiles sharp. Crop close to the playing surface, no faces, no people, no logos, no writing overlaid, no borders, no poster effects. This is a generic illustrative photograph, not any actual player's match or a specific winning hand. Full-bleed composition, no extra margins.
```

## mahjong-score-sticks.webp

1536 × 1024。記事途中の点棒イメージ。

生成プロンプト:

```text
Use case: photorealistic-natural. Asset type: a secondary landscape illustration photograph for a Japanese mahjong news article. Generate one 1536x1024 close-up documentary photograph of a Japanese riichi mahjong tabletop after play. Deep green felt, a small orderly cluster of traditional white scoring sticks with tiny red and black dot marks in the foreground, a pair of white dice beside them, and the backs of ivory and yellow mahjong tiles softly out of focus behind. Crop closely, soft natural indoor light, neutral realistic materials, candid editorial stock photography rather than glossy advertising. No people, faces, logos, captions, overlaid text, borders or extra margins. This is a generic illustrative scene, not a specific match or score.
```
