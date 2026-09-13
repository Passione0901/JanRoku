# 共有URL版の保存基盤

2026-09-13：共有URL版。既存のGitHubリポジトリ・Pages・暗号化データ・同期処理を維持したまま追加。

- Worker: `janroku-api`
- D1: `janroku-shared`（作成リージョン APAC）
- 接続確認: `https://janroku-api.janroku-one.workers.dev/health`
- 設定: `wrangler.jsonc`、スキーマ: `migrations/0001_initial.sql`

共有URL版は `shared.html` から起動する。従来の `index.html` とGitHub同期は維持する。共有データはD1へ独立して保存し、旧データとの双方向同期は行わない。

全クエリを認証済みgroup_idで分離する。256bitのランダム共有キーはURLフラグメントで受け取り、このタブのsessionStorageに保存する。APIにはAuthorizationヘッダーで送信し、D1にはSHA-256ハッシュのみを保存する。参加者キーは全記録の閲覧・編集が可能。管理者キーは参加者キーの失効・再発行も可能。共有URLは公開ファイルに含めない。

`GET /sync?since=N` は最大200件の変更を返す。未読ページを読み終えてから描画する。通常は表示中だけ30秒間隔。`POST /mutation` は入力検証、対象レコードのrevision、group revisionの比較を行い、データ・変更履歴・revisionをD1 batchで一括確定する。mutation_guardのCHECK違反で競合時は全体をロールバックする。操作IDでレスポンス喪失後の再送を重複処理しない。新規入力日時はサーバー時刻。過去の対局日・移行時の入力日時・ルールスナップショットは保持する。

削除は論理削除。`GET /trash` とrestore操作で復元する。対局参照があるメンバーの削除は拒否する。更新前後の内容は変更履歴に保持する。移行用の平文バックアップと共有リンクは管理者の端末だけに置く。

検証: `node cloudflare/test-api.mjs`（Node 22.13以上）。SQLiteで認可・別会へのアクセス拒否・同時編集・再送・復元・ルール競合・キー失効を検証する。Webは `npm run build`。Workerのentryは `api.js`（デプロイ時にTypeScript依存をbundleする）。DB変更はmigrationsを適用してからWorkerを配置する。

このWorkerはCloudflare APIから配置した。ソース変更時はこのディレクトリを対象にデプロイすること。現在のGitHub PagesワークフローはWorkerをデプロイしない。
