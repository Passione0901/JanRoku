# GitHub Pagesの公開ニュース

`news/`は公開記事の閲覧専用です。`https://jang-roku.pages.dev/api/news-reader`から記事を取得します。`?article=<公開記事の43文字キー>`は元の公開記事と同じ名前・公開設定で、その記事だけを開きます。一覧と`?article=<匿名記事の64文字キー>`は匿名版です。匿名キーから元の公開キーや実名版を取得する経路は設けません。独自ドメインへの自動移動、グループ認証、ブラウザー内のグループ情報の読み取りは行いません。記事本文はGitへ保存しません。

GitHub ActionsのPagesワークフローで`news/`を静的出力へコピーします。`article.css`は`node cloudflare/build-pages.mjs`で生成した`dist-pages/public-news.css`の配布用コピー、`public-news-ticker.js`は同名のCloudflareソースの配布用コピーです。新聞の共通デザインを変更した際は、この2ファイルも更新します。

確認: `node github-pages/test-news-reader.mjs`、`node cloudflare/test-news-portal.mjs`。
