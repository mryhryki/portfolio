---
title: サーバーレスでURL短縮サービスを40分で作ってリリースした話
canonical: https://qiita.com/mryhryki/items/3cba6397a960d00218c8
---

この記事は [コネヒト Advent Calendar 2019 2日目](https://qiita.com/advent-calendar/2019/connehito) の記事です。

## はじめに

社内のSlackでURL短縮サービスが自社にあればよいなー、という呟きがあったので、昼休みに一人ハッカソンをしてみた時の話です。(※実運用はしていないです)

## 概要

`https://s.hyiromori.com/` にアクセスするとURL短縮用の画面が表示されて `https://s.hyiromori.com/[5文字の乱数]` のようなURLを発行できるようなWebアプリを作りました。

![30247f56-ec47-f361-a930-826730cdc916.png](https://i.gyazo.com/e54267b2a2de334209f0fb5e5af437ba.png)

ドメインが短くないと、あまり短縮された感じがないですが、まだ実験段階なのでご勘弁ください。
ソースは [GitHub](https://github.com/mryhryki/serverless-shorten) にあります。

## 技術スタック

使い慣れている [serverless](https://serverless.com/) フレームワークを使って、作ってみました。
使用しているAWSのサービスは以下のようになります。

* [API Gateway](https://aws.amazon.com/jp/api-gateway/)
* [Lambda](https://aws.amazon.com/jp/lambda/)
* [DynamoDB](https://aws.amazon.com/jp/dynamodb/)
* [CloudWatch Logs](https://aws.amazon.com/jp/cloudwatch/)

## タイムライン

コミットをサボっていたので、覚えている限りで書きます。

### 1. プロジェクトの作成

何個か作ったことがあったので、以下のファイルを別プロジェクトからコピペしました。

* [serverless.yml](https://github.com/mryhryki/serverless-shorten/blob/master/serverless.yml): Serverlessの設定ファイル
* [package.json](https://github.com/mryhryki/serverless-shorten/blob/master/package.json): nodeパッケージの定義とか

`.eslint.json` とかもコピペしましたが、本質ではないので割愛します。

### 2. serverless.yml の定義

#### DynamoDBの定義

[DynamoDB](https://aws.amazon.com/jp/dynamodb/)はAWSマネージドなNoSQLデータベースです。 serverless と相性が良いです。

`serverless` の `resource` セクションは [CloudFormation](https://aws.amazon.com/jp/cloudformation/) で書くので、[公式ドキュメント](https://docs.aws.amazon.com/ja_jp/AWSCloudFormation/latest/UserGuide/aws-resource-dynamodb-table.html) を参考に記述します。

```yaml
resources:
  Resources:
    ShortenTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: serverless-shorten
        AttributeDefinitions:
          - AttributeName: key
            AttributeType: S
        KeySchema:
          - AttributeName: key
            KeyType: HASH
        ProvisionedThroughput:
          ReadCapacityUnits: 3
          WriteCapacityUnits: 3
```

ここでは、短縮したURLのキーを `key` という名前のハッシュキーで格納する、純粋なKey-Valueストアとして定義しています。
一応ですが、IAMポリシーも定義しておかないとアクセスできないので注意してください（詳しくはGitHubリポジトリを参照してください）

#### エンドポイントの定義

`functions` セクションに `handler` (`Lambda`のエントリポイント)を記述して `events` にHTTPの設定らしきものを書くと、serverless が自動的に `API Gateway` と `Lambda` を設定してくれます。便利！

```yaml
functions:
  index:
    handler: handler/index.handler
    events:
      - http:
          method: GET
          path: ''
          cors: true
  post:
    handler: handler/post.handler
    events:
      - http:
          method: POST
          path: ''
          cors: true
  get:
    handler: handler/get.handler
    events:
      - http:
          method: GET
          path: '{key}'
          cors: true
```

ここでは、以下の３つのエンドポイントを定義しています。

- `GET /` : URL変換を実行するためのHTMLを返すエンドポイント
- `POST /` : URL変換を実行して、短縮したURLを返すAPI用エンドポイント
- `GET /{key}` : 短縮URLでアクセスして、リダイレクトするエンドポイント

### 3. エンドポイントの実装1: `GET /`

表示用の `HTML` を返却するだけのエンドポイントです。

```javascript
const html = `
<!doctype html>
<html lang="ja">
  <!-- 省略 -->
</html>
`;

module.exports.handler = async () => ({
  statusCode: 200,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'text/html',
  },
  body: html,
});
```

~~面倒くさかった~~ 時間なかったので、JSにそのままHTMLを記述してそれを返しています。
当然、別ファイルにした方が良いですので、あまり真似しないでください。
いつか暇な時に対応しようと思います。

### 4. エンドポイントの実装2: `POST /`

短縮URLを生成するエンドポイントです。
キーとなる５文字の乱数を生成して、ポストされたURLと一緒に `DynamoDB` に保存して、短縮したURLを返却しています。
ちなみに、もし乱数が衝突しても無言で上書きします😨
今回はとりあえず作ることを目的にしているので省略しますが、ちゃんと運用する時はチェックを忘れないようにしましょう！

```javascript
const crypto = require('crypto.js');
const {DynamoDB} = require('aws-sdk');

// DynamoDB のクライアントの設定
const client = new DynamoDB.DocumentClient({apiVersion: '2012-10-08', region: 'ap-northeast-1'});

module.exports.handler = async (event) => {
  const {Origin} = event.headers;
  const {url} = JSON.parse(event.body);

  // URLをチェックして、不正なURLの場合は400を返却する
  if (!url.match(/^(http|https):\/\/([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/g)) {
    return {
      statusCode: 400,
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({error: 'ERROR: Invalid URL.'}),
    };
  }

  // ランダムなキーを生成する
  const key = crypto.randomBytes(10).toString('base64').replace(/[+/]/g, '').substr(0, 5);

  // DynamoDB にキーとURL情報を保存する
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Item: {key, url},
  };
  await client.put(params).promise();

  // 短縮したURLを返却する
  const payload = {
    url: `${Origin}/${key}`,
  };
  return {
    statusCode: 200,
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  };
};
```

### 5. エンドポイントの実装3: `GET /{key}`

短縮URLでアクセスされ、元のURLにリダイレクトするためのエンドポイントです。
アクセスされたパスをキーに、元のURLを `DynamoDB` から取得して `302` でリダイレクトさせています。

```javascript
const { DynamoDB } = require('aws-sdk');

// DynamoDB のクライアントの設定
const client = new DynamoDB.DocumentClient({ apiVersion: '2012-10-08', region: 'ap-northeast-1' });

module.exports.handler = async (event) => {
  const { key } = event.pathParameters;

  // キーに該当するURLを取得する
  const params = {
    TableName: process.env.DYNAMODB_TABLE,
    Key: { key },
  };
  const res = await client.get(params).promise();

  // 該当するURLが見つからない場合は404を返却する
  if (!res || !res.Item || !res.Item.url) {
    return {
      statusCode: 404,
      headers: { 'Content-Type': 'text/plain' },
      body: '404 Not Found',
    };
  }

  // 該当のURLにリダイレクトさせる
  const { url } = res.Item;
  return {
    statusCode: 302,
    headers: {
      'Content-Type': 'text/plain',
      Location: url,
    },
    body: `Redirect to: ${url}`,
  };
};
```

※ 「DynamoDB のクライアントの設定」あたりは `PUT /` と同じ処理ですが、理解しやすくするためにワザと重複を許容しています。本来はこういう共通処理は切り出してまとめたほうが良いです。

### 6. デプロイ

AWS CLI の設定ができていれば `npm run deploy` とコマンドを打てば一発でデプロイできます！
ちなみに私は [aws-vault](https://github.com/99designs/aws-vault) をAWSの認証情報を管理しているので、こんな感じで実行しています。

```bash
aws-vault exec [profile] -- npm run deploy
```

とてもセキュアになるので、非常におすすめです。
これもいつか記事にしよう。

### 7. 完成

`https://s.hyiromori.com/` にアクセスして、動作することを確認します。

![30247f56-ec47-f361-a930-826730cdc916.png](https://i.gyazo.com/ca8a36bf72756479d39e7e55dfc380f4.png)

生成された `s.hyiromori.com/IDuhK` にアクセスすると無事 `https://example.com/` にリダイレクトされました！

## おわりに

いかがでしたか？
serverless を使うと、こんなに手軽に実装＆デプロイができますよー。
そして、インフラの管理がいらない＆費用も（アクセスがあまりないので）ほとんどかからない、と良いことたくさんです！
皆さんも、とりあえずなんかWebサービス作ってみたいと思ったら、serverless 使ってみてくださいね！

## 今後の課題

- ドメイン短くしたい！
- アクセス数とか記録しておくと良さそう。
- ついでに分析とかまでできると完璧！

## PR

コネヒトでは、一緒に働いてくれるエンジニア募集中です！興味があればこちらもみてください！
[パパも大活躍！！ママリのwebフロントエンドを支えるエンジニア募集！](https://www.wantedly.com/projects/300133)

## ※追記（2019/12/02 13:30）

~~継続的に運用するつもりはないので、アドベントカレンダー終了後にクローズ予定です。~~
クローズしました。（2019/12/27 23:00)