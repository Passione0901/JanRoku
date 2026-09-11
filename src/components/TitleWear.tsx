import "./TitleWear.css";

// 最終更新: 2026-09-11 — 下位の小さな失敗は装飾だけで表現し、名前や称号の文字を動かさない。
export function TitleWear({ rank }: { rank: number }) {
  return (
    <span className="rank-wear" aria-hidden="true">
      <span className="wear-frame" />
      {rank === 30 && (
        <>
          <i className="wear-rock" />
          <i className="wear-chip wear-chip--second" />
        </>
      )}
      {rank === 36 && (
        <>
          <i className="wear-screw" />
          <i className="wear-screw wear-screw--fixed" />
        </>
      )}
      {rank === 39 && (
        <>
          <i className="wear-crack" />
          <span className="wear-bandage">
            <i />
            <i />
          </span>
        </>
      )}
      {rank === 42 && (
        <>
          <span className="wear-sprout">
            <i />
            <i />
          </span>
          <i className="wear-leaf" />
        </>
      )}
      {rank === 45 && (
        <>
          <i className="wear-plank" />
          <i className="wear-tape wear-tape--fixed" />
          <i className="wear-tape wear-tape--peel" />
        </>
      )}
      {rank === 48 && <i className="wear-speck" />}
      <span className="wear-dust" />
      <span className="wear-grains">
        <i />
        <i />
        {rank !== 48 && (
          <>
            <i />
            <i />
          </>
        )}
      </span>
    </span>
  );
}
