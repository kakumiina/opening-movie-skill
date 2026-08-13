# opening-movie

A Claude Code skill for making short opening videos — photos, titles and names cutting in on the beat — **without ever opening a video editor**. Built on [HyperFrames](https://github.com/heygen-com/hyperframes) (HTML → MP4).

動画編集ソフトを使わずに、**写真と文字がテンポよく切り替わるオープニング映像**を作るための Claude Code スキルです。

団体や会社の期初オープニング、新体制の紹介、イベント冒頭の映像などを想定しています。

## できること

- 1920x1080 / 音声つきの MP4
- 濃紺のデジタル背景（グリッド・光の筋・粒子）に、人物が斜めのマスクで左から入り、右に役職と名前が出る構成
- シーンの切り替わりを音楽の小節頭にぴったり合わせる
- 写真と文字を差し替えれば、同じ型で何本でも作れる

尺は10秒でも20秒でも同じ型で組めます。BPM120（4拍子）なら1小節=2秒なので、切り替えを2秒の倍数に置くと映像と音のキメが揃います。

## 必要なもの

- Node.js 22以上
- FFmpeg
- 画像生成の手段（何でも構いません）
- 日本語フォント（macOS同梱のもので足ります）

`npx hyperframes doctor` が全部緑になってから始めてください。

## インストール

Claude Code のスキルとして使う場合:

```bash
git clone https://github.com/kakumiina/opening-movie-skill.git
cp -r opening-movie-skill ~/.claude/skills/opening-movie
```

`SKILL.md` が読み込まれ、「オープニング動画作って」などで起動します。

スキルとして使わず、テンプレートだけ流用しても構いません。

## 使い方

```bash
# 1. プロジェクトを作る
npx --yes hyperframes init my-opening --non-interactive --example blank
cd my-opening && mkdir -p assets

# 2. テンプレートを置く
cp /path/to/opening-movie-skill/templates/opening.html index.html

# 3. 素材を assets/ に入れる
#    background.png / person1.png / person2.png / person3.png / bgm.m4a

# 4. BGMを作る（既成の音源があれば不要）
node /path/to/opening-movie-skill/scripts/make_bgm.mjs --duration 20 --bpm 120 --out assets/bgm.wav
ffmpeg -y -i assets/bgm.wav -c:a aac -b:a 192k assets/bgm.m4a

# 5. 検査してから書き出す
npm run check
npm run render
```

`index.html` の中で書き換えるのは、組織名・役職・氏名・スローガン・各シーンの `data-start` / `data-duration` です。

## 素材づくりで守ること

**画像に文字を焼き込まないこと。** 画像生成AIに日本語を書かせると誤字が出ますし、あとから名前を差し替えるときに画像ごと作り直す羽目になります。文字は動画側で乗せます。

- 人物は「バストアップ・やや左寄せ・右に余白」で統一する（文字を置く場所を空けるため）
- 背景の色調を全カットで揃える。素材がバラバラでも一本の映像に見えます
- 画像生成は1枚ずつ順番に。並列で走らせると出力を取り違えます

## HyperFrames の制約

1コマずつ時刻を指定して描画するため、「同じ時刻なら必ず同じ絵になる」ことが絶対条件です。

- `Math.random()` をそのまま使わない（シード固定の疑似乱数を同期処理で回す）
- `Date.now()` や `setTimeout` を使わない
- 無限ループのアニメーションを使わない（繰り返し回数を有限で指定する）
- `class="clip"` が付いた要素そのものを動かさない（中のラッパーを動かす）
- 退場アニメの後には `tl.set(セレクタ, { opacity: 0 }, 退場完了時刻)` を添える

テンプレートはこれらを守った状態で `hyperframes check` が全緑になることを確認済みです。

## 実測値

1920x1080 / 20秒 / 300フレーム超の書き出しが **23.4秒**（Apple M4 Mac mini）。作って、見て、直して、また作るサイクルが軽いのがこの作り方の利点です。

初めてで30〜45分、2本目からは10分ほどで作れます。

## ファイル構成

```
SKILL.md              Claude Code 用のスキル定義（手順・落とし穴・checkの対処表）
templates/opening.html  3人構成のテンプレート（20秒版・プレースホルダ入り）
scripts/make_bgm.mjs    BGM合成（尺とBPMを指定、外部依存なし）
```

## ライセンス

MIT
