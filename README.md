# codh-mirror

ROIS-DS 人文学オープンデータ共同利用センター（CODH）が `codh.rois.ac.jp` で公開していたブラウザベースのデモアプリ群を、CODH 公式サイトが長期メンテナンス中（2026 年 2 月 16 日夕方よりサービス停止、再開時期未定）の間に利用できるよう、Wayback Machine から取得した原本を**暫定的に**ミラーホストするためのリポジトリです。

GitHub Pages で配信しています: <https://nakamura196.github.io/codh-mirror/>

> **重要 — 暫定対応です**
>
> 本リポジトリは CODH のサービス再開までの一時的な避難場所であり、長期運用を意図したものではありません。CODH 公式サイトが再開した時点で、利用側のリンクは速やかに本家へ戻し、本ミラーは順次撤去する予定です。
> 各ツールは MIT ライセンス等で公開されており、再配布自体は許諾されていますが、Wayback の特定時点スナップショットで凍結されているため、その後の本家での修正・改善は反映されません。

## 収録ツール

| パス | ツール | 配信URL |
|---|---|---|
| `vdiff/` | vdiff.js — 2 枚画像の差分可視化 | <https://nakamura196.github.io/codh-mirror/vdiff/> |
| `vdiff-seq/` | vdiff-seq.js — 連続画像版 vdiff | <https://nakamura196.github.io/codh-mirror/vdiff-seq/> |
| `iiif-curation-viewer/` | IIIF Curation Viewer | <https://nakamura196.github.io/codh-mirror/iiif-curation-viewer/> |
| `iiif-curation-manager/` | IIIF Curation Manager | <https://nakamura196.github.io/codh-mirror/iiif-curation-manager/> |
| `iiif-curation-editor/` | IIIF Curation Editor | <https://nakamura196.github.io/codh-mirror/iiif-curation-editor/> |
| `iiif-curation-player/` | IIIF Curation Player | <https://nakamura196.github.io/codh-mirror/iiif-curation-player/> |
| `iiif-curation-board/` | IIIF Curation Board | <https://nakamura196.github.io/codh-mirror/iiif-curation-board/> |
| `soan/` | そあん（soan）ブラウザ完結版 — くずし字画像生成 | <https://nakamura196.github.io/codh-mirror/soan/> |

各ツールはクエリパラメータ付きの URL で利用します（vdiff であれば `?img1=...&img2=...` など）。元の CODH デモページの URL クエリ仕様をそのまま継承しています。

## ⚠️ 制約：認証・保存系の機能は動きません

IIIF Curation Viewer / Manager / Editor / Board は、内部で **Firebase 認証** と **JSONkeeper**（CODH が運用していたキュレーション JSON 保存用バックエンド）に依存しています。本ミラーはあくまで静的アセットだけを置いたものなので、以下の機能は本ミラー経由では利用できません。

| 機能 | 状態 | 備考 |
|---|---|---|
| Firebase ログイン（Google / Facebook / Twitter / Email） | ❌ 不可 | バンドルに CODH の Firebase プロジェクト `codh-81041` がハードコードされており、`nakamura196.github.io` は authDomain として登録されていないため、ログインポップアップが開いてもエラーになります |
| キュレーションの新規作成 / 編集 / 保存 | ❌ 不可 | 認証に通っても、保存先 JSONkeeper API（`/api/...`）が CODH 側で停止中 |
| 既存 Curation JSON の URL を渡しての**閲覧** | ✅ 可 | `?curation=<url>` 形式で公開されている JSON を渡せば Viewer / Player は読み取り専用で動作します |
| 既存 Manifest の URL を渡しての**閲覧** | ✅ 可 | `?manifest=<url>&canvas=<id>&xywh=...` で領域強調表示も含めて Viewer は動作します |

別ドメイン用の Firebase プロジェクトを立てて authFirebase.js を差し替えることは技術的には可能ですが、結局 JSONkeeper 側も自前で立てる必要があり、スコープが大きく膨らむ割に「CODH のサービス再開までの暫定対応」という本リポジトリの趣旨から外れるため、本ミラーでは行っていません。

本ミラーで動作確認できる用途は以下の通りです。

| ツール | 想定用途 |
|---|---|
| `vdiff/`, `vdiff-seq/` | 画像比較（クエリパラメータで2 画像 URL を指定） |
| `soan/` | くずし字画像生成（フロントエンド完結、kuromoji 辞書同梱） |
| `iiif-curation-viewer/` | `?manifest=...` または `?curation=...` 付きの閲覧 |
| `iiif-curation-player/` | `?curation=...` 付きの閲覧（スライドショー） |
| `iiif-curation-manager/` `iiif-curation-editor/` `iiif-curation-board/` | UI 確認程度（認証・保存は不可） |

## ライセンスと出典表示

本ミラーに含まれる成果物は権利関係が一様ではないので、構成要素ごとに以下のとおり整理しています。各ファイルの先頭コメントに含まれているライセンス・著作権表示はすべてそのまま維持しています。

### CODH 提供のソフトウェア（vdiff / vdiff-seq / IIIF Curation 各種 / そあんの UI・バンドル等）

**MIT License** — Copyright Center for Open Data in the Humanities, Research Organization of Information and Systems（core contributor: Jun HOMMA / [@2SC1815J](https://github.com/2SC1815J)）

```
Copyright Center for Open Data in the Humanities,
  Research Organization of Information and Systems
Released under the MIT license
```

### そあん同梱の古活字 PNG（`soan/dataset/001/*.png`、36,869 枚）

CODH 公開の **「古活字データセット」**（『徒然草』 国立国会図書館蔵が原資料）の一部です。データセットそのもののライセンス詳細は CODH のデータセット紹介ページ (`https://codh.rois.ac.jp/soan/` 配下) に依存します。CODH 停止中のため詳細ページは参照できませんが、同センターによる従来の CC 系オープンデータポリシーに従って取り扱う前提です。CODH のサービス再開時に最新の表記を確認してください。

なお、これらの画像バイナリは（CODH 停止中のため Wayback で全数取得が困難な事情で）@2SC1815J 氏が個人運用する `dev.2sc1815j.net` から取得して再配置しています。同氏ホストは中継配信であり、原権利者は変わりません。

### そあん同梱の kuromoji 形態素解析辞書（`soan/kuromoji/dict/*.dat.gz`、12 ファイル）

[kuromoji.js](https://github.com/takuyaa/kuromoji.js) プロジェクトに含まれる標準辞書ファイルで、原典は **mecab-ipadic**（修正 BSD 相当）。kuromoji.js 自体は **Apache License 2.0** です。

### Pro 版バンドルは本ミラーに含まれていない

そあんには `dev.2sc1815j.net/soan/` で公開されている拡張版（Soan Pro / Copyright 2023 Jun HOMMA）がありますが、Pro 版バンドル自体は明示的な再配布条件が公表されていないため、本ミラーには **含めていません**（CODH デモ版の MIT ライセンスのバンドルだけを利用）。dev.2sc1815j.net 由来のものは画像・辞書ファイルのバイナリのみで、これらの原権利は前述のとおり別出所です。

### 生成画像のライセンス（参考）

CODH の[そあんトップページ](https://codh.rois.ac.jp/soan/)には「そあんソフトウェアを利用して生成した画像は自由に利用可能、出所明示は不要」との記載があります（CODH のサービス停止中につき本記載は Wayback 経由での確認）。

## 取得元のスナップショット

すべて Wayback Machine の `id_` フラグ（identity / 生バイト）で取得しました。詳細な手順は別記事をご参照ください。

| ツール | 取得日（Wayback timestamp） |
|---|---|
| vdiff | 2025-08-22 / 2025-10-08 |
| vdiff-seq | 2024-09-09 |
| iiif-curation-viewer | 2026-01-05 |
| iiif-curation-manager | 2025-07-03 |
| iiif-curation-editor | 2025-08-23 |
| iiif-curation-player | 2025-08-27 |
| iiif-curation-board | 2025-01-24 |
| soan | UI / バンドル / dataset/001.json は CODH デモ版（Wayback 2025）／古活字 PNG 36,869 枚と kuromoji 辞書はバイナリ同一の dev.2sc1815j.net（@2SC1815J 氏ホスト）から取得 |

## 公式情報・参考

- CODH ホームページに関するお知らせ（ROIS-DS）: <https://ds.rois.ac.jp/news/2026/post-12061/>
  > 人文学オープンデータ共同利用センター（CODH） ホームページ(http://codh.rois.ac.jp/) は、ただいま長期メンテナンス中のため、サービスを一時停止しております。再開時期は未定ですが、できるだけ早く復旧できるように作業を進めています。

## CODH 再開後のリポジトリ撤収手順（メモ）

CODH のサービスが再開した時点で、以下の段階で本ミラーを役目から外していく予定です。

1. 利用先サイト（依存していたデジタルアーカイブ等）の `https://nakamura196.github.io/codh-mirror/...` 参照を、CODH の本家 URL に戻す
2. 本 README の冒頭に「CODH のサービスが再開しました。本家 <https://codh.rois.ac.jp/> をご利用ください」の案内を追記
3. 2〜4 週間ほどはこのまま配信を継続（外部キャッシュ・古いブックマーク・論文中の URL 等のロングテールアクセス対策）
4. `gh repo archive nakamura196/codh-mirror` でリポジトリをアーカイブ（read-only 化／URL は引き続き有効）
5. その後、配信ログがほぼゼロになった時点で GitHub Pages 無効化、必要ならリポジトリ削除

URL を生かしたまま archive で止めるのが、第三者の被リンクを壊さない無難な落とし所です。

## 謝意

本ミラーの存在は、CODH と core contributor の Jun HOMMA（[@2SC1815J](https://github.com/2SC1815J)）氏が、長年にわたりソフトウェア・データセットをオープンに公開してこられたことの上に成り立っています。とりわけ、CODH 停止中に古活字 PNG と kuromoji 辞書を `dev.2sc1815j.net` から流用させていただいた件については、@2SC1815J 氏のホスト運営のおかげで本ミラー作業がそもそも成立した形であり、感謝に堪えません。

サービス再開までの間だけ、本ミラーが必要な方の役に立てば幸いです。
