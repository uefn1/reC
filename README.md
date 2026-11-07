# MyCaptcha v3.1 SVG - 画像は全てSVG

Google reCAPTCHA v2 完全再現 + 高精度計測
画像は全てSVGベクターで記述（写真ファイルなし、軽量・拡大しても劣化なし）

## 使い方（GitHub Pages）
1. mycaptcha フォルダをリポジトリにpush
2. Settings > Pages で公開
3. https://YOURNAME.github.io/mycaptcha/ で確認

## 埋め込み
<link rel="stylesheet" href="https://YOURNAME.github.io/mycaptcha/mycaptcha.css">
<div id="my-captcha"></div>
<script src="https://YOURNAME.github.io/mycaptcha/mycaptcha.js"></script>
<script>myCaptcha.render('my-captcha',{callback:(t,i)=>console.log(t,i.score)})</script>

## 構成
- index.html
- mycaptcha.js (画像パスは .svg)
- mycaptcha.css
- images/*.svg (6枚: バスx2, 信号機x2, 横断歩道, 空の通り)

## SVGのメリット
- 1枚 2KB前後、合計 12KB (WebP版は約4MB)
- 拡大してもボケない
- テキストで編集可能
- ダークモード対応しやすい
