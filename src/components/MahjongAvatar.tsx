// 最終更新: 2026-09-10 — IDを種に34種の牌を割り当て、全端末で同じアイコンを描く。
export function memberTile(id: string): number {
  let hash = 2166136261;
  for (const char of `jang-roku-tile-v1:${id}`)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return (hash >>> 0) % 34;
}
const ink = "#172936",
  red = "#b42530",
  green = "#176447",
  face = "#fff9e9";
type Mark = [number, number, string?, number?];
// 最終更新: 2026-09-10 — 牌ごとの伝統的な配置を定義し、単純な行詰めを避ける。
const circles: Mark[][] = [
  [],
  [
    [30, 24, green],
    [30, 53, green],
  ],
  [
    [16, 18, ink],
    [30, 38, red],
    [44, 58, green],
  ],
  [
    [17, 23],
    [43, 23],
    [17, 53],
    [43, 53],
  ],
  [
    [16, 21],
    [44, 21],
    [30, 38, red],
    [16, 55],
    [44, 55],
  ],
  [
    [18, 17, green],
    [42, 17, green],
    [18, 38, red],
    [42, 38, red],
    [18, 58, red],
    [42, 58, red],
  ],
  [
    [15, 15, green],
    [30, 23, green],
    [45, 31, green],
    [18, 46, red],
    [42, 46, red],
    [18, 62, red],
    [42, 62, red],
  ],
  [
    [18, 15],
    [42, 15],
    [18, 30],
    [42, 30],
    [18, 46],
    [42, 46],
    [18, 61],
    [42, 61],
  ],
  [
    [15, 18, green],
    [30, 18, green],
    [45, 18, green],
    [15, 38, red],
    [30, 38, red],
    [45, 38, red],
    [15, 58],
    [30, 58],
    [45, 58],
  ],
];
const bamboo: Mark[][] = [
  [],
  [
    [30, 22],
    [30, 55],
  ],
  [
    [30, 18],
    [18, 54],
    [42, 54],
  ],
  [
    [18, 22],
    [42, 22],
    [18, 55],
    [42, 55],
  ],
  [
    [16, 18],
    [44, 18],
    [30, 38, red],
    [16, 58],
    [44, 58],
  ],
  [
    [16, 22],
    [30, 22],
    [44, 22],
    [16, 55],
    [30, 55],
    [44, 55],
  ],
  [
    [30, 14, red],
    [16, 35],
    [30, 35],
    [44, 35],
    [16, 58],
    [30, 58],
    [44, 58],
  ],
  [
    [14, 23, green, -22],
    [25, 23, green, 22],
    [35, 23, green, -22],
    [46, 23, green, 22],
    [14, 55, green, 22],
    [25, 55, green, -22],
    [35, 55, green, 22],
    [46, 55, green, -22],
  ],
  [
    [16, 16],
    [30, 16, red],
    [44, 16],
    [16, 38],
    [30, 38, red],
    [44, 38],
    [16, 60],
    [30, 60, red],
    [44, 60],
  ],
];
// 最終更新: 2026-09-10 — 竹の節と両端を描き、縮小時も十字記号に見えない形にする。
function Bamboo({
  mark: [x, y, color = green, angle = 0],
  short = false,
}: {
  mark: Mark;
  short?: boolean;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) rotate(${angle}) scale(1 ${short ? 0.76 : 1})`}
      fill={color}
    >
      <path d="M-2.5-10Q0-12 2.5-10L2 10Q0 12-2 10Z" />
      <path d="M-4-10h8v2h-8zM-3.5-1h7v2h-7zM-4 8h8v2h-8z" />
      <path d="M-.7-7v5m0 4v5" stroke={face} strokeWidth=".9" />
    </g>
  );
}
// 最終更新: 2026-09-10 — 一索は冠・くちばし・翼・尾羽で孔雀の輪郭を表現する。
function Peacock() {
  return (
    <g>
      <path
        d="M27 39Q13 28 10 15Q4 40 19 60L32 67Q49 57 49 29Q35 39 27 39Z"
        fill={green}
      />
      <path
        d="M15 31Q16 49 29 60M20 29Q23 48 34 57M43 39Q39 50 34 57"
        fill="none"
        stroke={face}
        strokeWidth="1.7"
      />
      <path
        d="M29 51Q40 39 33 30Q27 25 30 18Q33 10 40 14Q45 17 41 22L37 24Q37 32 43 38Q47 49 37 56Z"
        fill={ink}
      />
      <path d="M40 18l10 4-10 2" fill={red} />
      <circle cx="38" cy="18" r="1.5" fill={face} />
      <path d="M32 13l-3-6m7 5V5m3 8 4-5" stroke={red} strokeWidth="2" />
      <path
        d="M32 56l-3 10m8-10 3 9m-15 1h8m4-1h7"
        stroke={red}
        strokeWidth="2"
      />
      <path
        d="M30 38q-9 1-6 13 9 3 14-8"
        fill={green}
        stroke={face}
        strokeWidth="1.2"
      />
    </g>
  );
}
// 最終更新: 2026-09-10 — 小型SVGで牌面を共通化。白は日本式の無地とする。
export function MahjongTile({ tile }: { tile: number }) {
  const number = (tile % 9) + 1,
    suit = Math.floor(tile / 9);
  const honor = ["東", "南", "西", "北", "白", "發", "中"][tile - 27];
  const name = tile >= 27 ? honor : `${number}${["萬", "筒", "索"][suit]}`;
  return (
    <svg
      className="mahjong-avatar"
      viewBox="0 0 60 80"
      role="img"
      aria-label={`${name}の麻雀牌`}
    >
      <rect x="2" y="5" width="56" height="74" rx="7" fill="#23765d" />
      <rect
        x="2"
        y="1"
        width="56"
        height="73"
        rx="7"
        fill={face}
        stroke="#b9aa8c"
        strokeWidth="1.5"
      />
      <path d="M8 7h44" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      {tile >= 27 ? (
        honor === "白" ? null : (
          <text
            x="30"
            y="56"
            textAnchor="middle"
            fontFamily="'Yu Mincho','Hiragino Mincho ProN','Noto Serif CJK JP',serif"
            fontSize="44"
            fontWeight="900"
            fill={honor === "中" ? red : honor === "發" ? green : ink}
          >
            {honor}
          </text>
        )
      ) : suit === 0 ? (
        <g
          textAnchor="middle"
          fontFamily="'Yu Mincho','Hiragino Mincho ProN','Noto Serif CJK JP',serif"
          fontWeight="900"
        >
          <text x="30" y="32" fontSize="31" fill={ink}>
            {["一", "二", "三", "四", "五", "六", "七", "八", "九"][number - 1]}
          </text>
          <text x="30" y="65" fontSize="34" fill={red}>
            萬
          </text>
        </g>
      ) : suit === 1 ? (
        number === 1 ? (
          <g>
            <circle
              cx="30"
              cy="38"
              r="19"
              fill="none"
              stroke={ink}
              strokeWidth="3"
            />
            {Array.from({ length: 8 }, (_, i) => (
              <ellipse
                key={i}
                cx="30"
                cy="26"
                rx="3.2"
                ry="5"
                fill={green}
                transform={`rotate(${i * 45} 30 38)`}
              />
            ))}
            <circle
              cx="30"
              cy="38"
              r="7"
              fill="none"
              stroke={red}
              strokeWidth="3"
            />
            <circle cx="30" cy="38" r="2.5" fill={red} />
          </g>
        ) : (
          <g>
            {circles[number - 1].map(([x, y, color = ink], i) => (
              <g key={i} fill="none" stroke={color}>
                <circle
                  cx={x}
                  cy={y}
                  r={number <= 2 ? 9 : 5.4}
                  strokeWidth="2.3"
                />
                <circle
                  cx={x}
                  cy={y}
                  r={number <= 2 ? 4.5 : 1.8}
                  strokeWidth="1.6"
                />
              </g>
            ))}
          </g>
        )
      ) : number === 1 ? (
        <Peacock />
      ) : (
        <g>
          {bamboo[number - 1].map((mark, i) => (
            <Bamboo
              key={i}
              mark={mark}
              short={number === 5 || number === 7 || number === 9}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
export function MahjongAvatar({ id }: { id: string }) {
  return <MahjongTile tile={memberTile(id)} />;
}
