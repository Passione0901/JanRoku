# 一般公開の運用手順（2026-09-14）

## 実装済み

- 共有キーから保存先を決定。URL・本文のグループIDを信用しない。
- 閲覧専用URL、管理者の書き込み停止、架空ニュース表示停止。
- 参加者URL再発行と全URL再発行。管理者URLも漏れた場合は全URLを再発行。
- 同時編集の競合検出、編集取り消し、削除した対局の復元、空グループへのバックアップ復元。
- 書き込み：1グループ30回/分・300回/UTC日、サービス全体2,000回/UTC日。IP単位60回/分を追加。
- 作成：IP単位10組/UTC日、全体100組/UTC日。作成時40人まで。初期登録は通常書き込み枠と別枠。
- 1対局8KB、1組5,000対局（削除含む）、20,000履歴、記録・履歴のJSON容量20MiB/組・300MiB/全体。索引等を含むDB実容量ではない。
- DBトリガーで古いWorkerへの直接書き込みもグループ枠・停止・容量制限を適用。旧Workerはエラー表示が一般的な接続エラーになる場合あり。
- 非表示タブは定期同期せず、通常の定期同期は版番号を比較してから差分を取得。
- 入力下書きはタブ内・グループ別。復元は利用者が選択。編集元が変わっている場合は復元を拒否。
- CSP、フレーム埋め込み禁止、参照元非送信、不要なデバイス権限禁止。
- 利用案内と報告窓口：onemahjongplayer@gmail.com。個人ログインではないため監査履歴から本人特定はできない。

## 広く告知する前の未完了設定

### Turnstile
現在のMCP権限ではウィジェットの作成が認証エラー。管理画面は別途ログインが必要。
Cloudflare TurnstileでManagedウィジェットを作成し、許可ホストを `jang-roku.pages.dev` に限定。
Pagesの本番環境変数に `TURNSTILE_SITE_KEY`（公開値）、`TURNSTILE_SECRET_KEY`（Secret）、`TURNSTILE_REQUIRED=true` を登録して再デプロイする。
サーバーはSiteverifyでsuccess・hostname・action=create-groupを検証。秘密鍵未設定でもREQUIREDがtrueなら作成を拒否する。
実際のサイトキーで作成成功、期限切れ・偽トークン拒否、レスポンス喪失時の再試行を確認する。
ボット判定を有効化するまでは、作成回数の制限のみ稼働。分散ボットを完全には止めない。

### 独立した自動バックアップ
初回の全表バックアップはリポジトリ外の非公開ローカルフォルダーへ保存し、別SQLiteへ復元・整合性確認済み。
定期実行はまだ有効化していない。`.github/workflows/database-backup.yml` は以下を設定してから有効化：
- Variables: CLOUDFLARE_ACCOUNT_ID、CLOUDFLARE_DATABASE_ID、ENABLE_DATABASE_BACKUP=true
- Secrets: 対象D1読み取り専用CLOUDFLARE_BACKUP_TOKEN、ランダム32バイトをbase64化したBACKUP_ENCRYPTION_KEY
- 暗号鍵をGitHub以外にも安全に保管。無くすと復元できない。
毎日JST4:20に暗号化して30日間Artifact保存。GitHubのスケジュール遅延・停止があるため成功日時を確認。GitHubの失敗通知を運営者が受け取る設定にする。
実データの一覧・共有キーはログや公開Artifactに出力しない。復元は隔離DBで検証後、対象確認・バックアップ取得のうえ行う。
D1 Time Travelの無料枠は7日間。長期・独立バックアップの代わりにはしない。

### 監視・運営
Cloudflare/GitHubの管理者アカウントで2段階認証と復旧コードの保管を確認。本人による操作が必要。
毎日、Workersの呼び出し数・エラー、D1のread/write・容量、バックアップの最新成功を確認。
無料枠の50%で傾向確認、80%で告知規模縮小・有料化または制限強化を検討。これは目安で処理保証ではない。
管理画面のNotificationsで利用可能な通知種類とプランを確認し、運営者メールへ設定する。
Pages上のAPI到達そのものの大量アクセスはアプリ内制限だけでは防げない。独自ドメイン＋適切なWAF/レート制限、またはAPI前段の制限を別途検討。無料枠を使い切ると一時的に利用不能になり得る。
共有URLが漏れた組は管理者画面で書き込み停止→バックアップ→全URL再発行→参加者へ新URL配布→再開。
新規作成全体を止める際はPages本番環境変数CREATION_ENABLED=falseを設定し再デプロイ。既存グループの閲覧・入力には影響しない。
問い合わせの確認頻度、削除受付・本人確認方法、保管期間、サービス終了時の予告期間を運営者が決める。

## デプロイと戻し方

GitHub版を削除しない。Cloudflare用は `node cloudflare/build-pages.mjs` で別出力。
公開前に `node cloudflare/test-api.mjs`、`node cloudflare/test-create-group.mjs`、`node node_modules/vitest/vitest.mjs run` を実行。
直接アップロードのmultipartでは `_worker.js`・`_routes.json`・`_headers` のすべてにfilenameと適切なContent-Typeを付ける。通常の文字列フィールドでは設定が適用されない。
Pagesの本番デプロイ後にヘルス、認証拒否、既存組の読み取り、管理機能を確認。
不具合はPagesの以前の正常デプロイへRollback。DBは追加スキーマなので通常ロールバックでは削除しない。
復旧前に現DBをバックアップする。Time TravelはDB全体を戻すため、他グループの新しい入力も戻る。個別復元を先に検討。
現時点で分散DDoS試験・実機Android/iPhone試験・長期自動バックアップ運用の証明はない。
