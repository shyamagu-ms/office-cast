# Office Cast

**AIにテーマと尺を伝えて、説明動画を作るテンプレートです。**
会社員・ロボット・小物・音楽を使い、台本から音声付きMP4まで制作します。
GitHub Copilotなど、ファイル編集とコマンド実行ができるAIエージェントで使います。

人間は環境を準備し、完成動画を見てフィードバック。台本・演出・ビルドはAIに任せます。
SHU WORKSは制作ブランド、Office Castはこのキャスト／素材セットです。

## 人間パート：初回の準備

### 1. 制作環境を用意する

このリポジトリをテンプレートまたはクローンで取得し、AIエージェントで開きます。
**Python 3.14.8以降の3.14系・Node.js 24.21.0以降の24 LTS系・Microsoft Edge・Azure CLI** を用意してください。
Python・Node・ブラウザのインストールとPATH設定はPC側の準備です。
セットアップスクリプトはPCのランタイムやnpmの取得元を変更しません。

リポジトリのルートでセットアップします。AIに実行を任せても構いません。

Windows（PowerShell）:

```powershell
.\tools\setup.ps1
```

macOS／Linux（sh）:

```sh
sh tools/setup.sh
```

Python・Node依存関係とFFmpegを導入します。初回はネット接続が必要です。
Windowsでは `py -3.14`、macOS／Linuxでは `python3.14` でプロジェクト専用venvを作成します。
別のPython実行ファイルを指定する方法は[制作ガイド](docs/PRODUCTION.md#制作環境と依存版)を参照してください。
対応していないランタイムや既存venvは、依存導入前にエラーになります。既存venvは自動で置き換えません。
**制作確認済みはWindows＋Edge。macOS／Linuxの全工程は未検証です。**
ブラウザは別途インストールし、venvはOSごとに作成してください。

### 2. Azure Speechを設定する

Azure AI Speechリソースと、対象リソースの **Cognitive Services Speech User** 相当の権限を用意します。
`settings.example.json` を `settings.local.json` にコピーし、次の2項目を設定してください。
既存のローカル設定は上書きしないでください。

| 設定 | Azure Portalで確認する値 |
|---|---|
| `speech.region` | リージョン識別子（例：`japaneast`） |
| `speech.resourceId` | リソースのプロパティにある完全なリソースID |

Windows:

```powershell
Copy-Item -LiteralPath settings.example.json -Destination settings.local.json
az login
```

macOS／Linux:

```sh
cp -i settings.example.json settings.local.json
az login
```

認証にはAzure CLIを使います。**APIキーやトークンをファイルやチャットに書く必要はありません。**
`settings.local.json` はGitから除外されます。
許可された別環境の同ファイルを再利用できますが、アクセス権とログインは別途必要です。

**音声合成はAzureの従量課金対象です。** 変更のないナレーションはキャッシュを再利用します。

### 3. AIに動画を依頼する

> 公開鍵と非公開鍵に関する30秒〜1分程度の動画を作成してください。

これだけで始められます。制作ルールを依頼文に毎回書く必要はありません。
標準は落ち着いた説明映像で、**タイトル → 本編 → エンディング** を指定尺内に収めます。
構成やトーンに希望があれば、その指定を優先します。ロゴは任意です。

## AIパート：制作と修正

AIは [AGENTS.md](AGENTS.md) と [制作ガイド](docs/PRODUCTION.md) に従い、
新作を `productions\<作品ID>` に作成します。台本・字幕・演出・音声・BGMを制作し、
MP4・静止画・品質確認（QC）・制作記録（manifest）まで出力します。

**完成動画：`productions\<作品ID>\out\<作品ID>.mp4`**

人間は動画を再生して、内容・読み方・見やすさ・音を確認します。
修正も短く伝えれば十分です。

> 鍵が移動する場面を、もう少しゆっくりにしてください。

ナレーションを変えない修正では、AIは `--offline` で既存音声を再利用します。
品質確認の合格と、人による視聴の判断は別です。

## ファイルの場所

| 場所 | 内容 |
|---|---|
| `productions\<作品ID>\story\narration.json` | 台本・字幕・シーン構成 |
| `productions\<作品ID>\src` | 作品固有の演出・プレビュー |
| `productions\<作品ID>\audio` | 音声キャッシュ・BGM |
| `productions\<作品ID>\out` | 完成MP4・静止画・QC・manifest |
| `shared`／`catalog` | 共通素材／素材の見本 |
| `tools`／`templates` | 制作ツール／新作のひな型 |

標準出力は **1920×1080・30fps・H.264／AAC** です。
台本・演出はGitに保存できますが、音声・完成動画・ローカル設定はGit除外です。
**確定作品はMP4・音声キャッシュ・manifest・対応するソースと依存版を別途保管してください。**

## 詳しい使い方・公開

- [制作ガイド](docs/PRODUCTION.md)：ビルド、プレビュー、音声、動き、品質確認
- [素材ガイド](docs/ASSETS.md)：キャスト、小物、ロゴ、共通版
- [AGENTS.md](AGENTS.md)：AI向けの制作・改修ルール

GitHubでの公開に専用の書き出し処理は不要です。
公開前に、Gitの追跡ファイルと履歴に非公開の作品・ローカル設定・認証情報が含まれていないか確認してください。
`.gitignore` は、すでに追跡されたファイルや履歴から情報を削除するものではありません。
追加した素材や作品の公開範囲と利用条件は、人間が確認してください。

オリジナル素材・コードは [MIT License](LICENSE)。
フォント・外部素材・依存ライブラリの条件は [NOTICE.md](NOTICE.md) を参照してください。
SHU Worksロゴは任意。GitHub Copilotアイコンは同梱しません。
