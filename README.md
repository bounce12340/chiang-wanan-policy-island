# 臺北施政島｜蔣萬安市政與政見資訊地圖（非官方整理）

以 3D 島嶼互動方式，整理臺北市長蔣萬安 2022–2026 任期的施政項目，以及市府已公布的規劃。每一項都附上公開來源與日期。

> **非官方資訊整理。** 本站與蔣萬安本人、其競選團隊、臺北市政府或任何政黨均無關聯，也未接受任何委託或資助。

## 內容

- 9 座政策島：交通、城市發展、產業科技、居住、育兒教育、長者醫療、安全韌性、環境永續、文化運動
- 每個項目標示狀態：已完成／進行中／規劃中／連任政見
- 三種檢視：3D 島嶼、清單、時間軸
- 資料集中在 [`data/policies.json`](data/policies.json)，資料截至 2026-10-23

## 技術

- 原生 ES modules，沒有建置步驟
- [Three.js](https://threejs.org/) r180（MIT，放在 `vendor/three/`）
- 3D 模型全部以程式碼產生，沒有外部模型檔
- 不支援 WebGL 的裝置會自動改用清單檢視

本機預覽：

```bash
python3 -m http.server 8000
# 開啟 http://localhost:8000
```

## 部署

靜態網站，部署在 Cloudflare Pages。`_headers` 設定基本安全標頭。

## 資料更正

發現錯誤或過時資訊，請開 issue 並附上來源連結。

## 授權

- 程式碼：MIT License
- 資料整理（`data/policies.json`）：CC BY 4.0；各項原始內容的權利屬於各來源
- Three.js：MIT License（見 `vendor/three/LICENSE`）
