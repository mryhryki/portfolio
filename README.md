# portfolio

[Moriya Hiroyuki (ID: mryhryki)](https://github.com/mryhryki) のポートフォリオ関連のソースコードです。

主に以下のコードを管理しています。

- [ポートフォリオサイト](https://mryhryki.com/)
  - `site/`
- [Zenn](https://zenn.dev/mryhryki) の記事データ ([公式ドキュメント](https://zenn.dev/zenn/articles/connect-to-github))
  - `articles/`
- [ブログデータ](https://mryhryki.com/blog/)
  - `articles/` (Zennの投稿をこちらでも公開）
  - `blog/`
- 過去のブログのバックアップデータ
  - `backup/`

## Setup

```bash
# 依存パッケージのダウンロード
$ npm i
```

## ポートフォリオサイト

### ブログデータのビルド

```bash
$ npm run blog:build
```

### プレビュー

```bash
$ npm run site:preview
```

### 更新

```bash
$ npm run site:update
```


## Zenn

[article/](./article) ディレクトリは以下に記事データを管理しています。
`main` ブランチと同期しています。

### ローカルでの執筆のCLIサンプル。

```bash
# 記事の追加
$ npm run article:add

# ブラウザでのプレビュー
$ npm run article:preview
```
