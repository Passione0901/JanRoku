import { CircleUserRound, ThumbsUp } from "lucide-react";
import type { ReaderThread } from "../domain/news/discussion";

// 最終更新: 2026-09-12 — 架空の反響は読取専用。返信は親コメントの直下で開閉できる。
export function NewsCommentThread({ thread, index }: { thread: ReaderThread; index: number }) {
  return <article className="news-reader-comment" aria-label={`${thread.author}の架空コメント`}>
    <span className={`news-reader-avatar news-reader-avatar-${index % 3}`} aria-hidden="true"><CircleUserRound size={28} /></span>
    <div className="news-comment-body">
      <div className="news-comment-author">{thread.author}<span>創作</span></div>
      <p>{thread.text}</p>
      <span className="news-comment-likes" aria-label={`架空のいいね ${thread.likes}件`}><ThumbsUp size={15} aria-hidden="true" />いいね <b>{thread.likes}</b></span>
      {thread.replies.length > 0 && <details className="news-comment-replies">
        <summary>返信を見る（{thread.replies.length}件）</summary>
        <div className="news-reply-list">{thread.replies.map(reply => <article className="news-reader-reply" key={reply.id} aria-label={`${reply.author}からの架空の返信`}>
          <div className="news-comment-author"><CircleUserRound size={19} aria-hidden="true" />{reply.author}<span>創作</span></div>
          <p>{reply.text}</p>
          <span className="news-comment-likes" aria-label={`架空のいいね ${reply.likes}件`}><ThumbsUp size={14} aria-hidden="true" />いいね <b>{reply.likes}</b></span>
        </article>)}</div>
      </details>}
    </div>
  </article>;
}
