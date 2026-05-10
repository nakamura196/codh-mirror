# codh-mirror

ROIS-DS 人文学オープンデータ共同利用センター（CODH）が `codh.rois.ac.jp` で公開していたブラウザベースのデモアプリ群を、CODH のサイトメンテナンス期間中に利用できるよう、Wayback Machine から取得した原本を**暫定的に**ミラーホストするためのリポジトリです。

GitHub Pages で配信しています: <https://nakamura196.github.io/codh-mirror/>

> **重要 — 暫定対応です**
>
> 本リポジトリは CODH 復旧までの一時的な避難場所であり、長期運用を意図したものではありません。CODH のサイトが復旧した時点で、利用側のリンクは速やかに本家へ戻し、本ミラーは順次撤去する予定です。
> 各ツールは MIT ライセンス等で公開されており、再配布自体は許諾されていますが、Wayback の特定時点スナップショットで凍結されているため、その後の本家での修正・改善は反映されません。

## 収録ツール

| パス | ツール | 配信URL |
|---|---|---|
| `vdiff-org/` | vdiff.js — 2 枚画像の差分可視化 | <https://nakamura196.github.io/codh-mirror/vdiff-org/> |
| `vdiff-seq/` | vdiff-seq.js — 連続画像版 vdiff | <https://nakamura196.github.io/codh-mirror/vdiff-seq/> |
| `iiif-curation-viewer/` | IIIF Curation Viewer | <https://nakamura196.github.io/codh-mirror/iiif-curation-viewer/> |
| `iiif-curation-manager/` | IIIF Curation Manager | <https://nakamura196.github.io/codh-mirror/iiif-curation-manager/> |
| `iiif-curation-editor/` | IIIF Curation Editor | <https://nakamura196.github.io/codh-mirror/iiif-curation-editor/> |
| `iiif-curation-player/` | IIIF Curation Player | <https://nakamura196.github.io/codh-mirror/iiif-curation-player/> |
| `iiif-curation-board/` | IIIF Curation Board | <https://nakamura196.github.io/codh-mirror/iiif-curation-board/> |
| `soan/` | そあん（soan）ブラウザ完結版 — くずし字画像生成 | <https://nakamura196.github.io/codh-mirror/soan/> |

各ツールはクエリパラメータ付きの URL で利用します（vdiff であれば `?img1=...&img2=...` など）。元の CODH デモページの URL クエリ仕様をそのまま継承しています。

## ライセンスと出典表示

各ツールは CODH（および @2SC1815J 氏ほかコントリビュータ）が **MIT ライセンス** で公開されているものです。各ファイルの先頭コメントに含まれているライセンス・著作権表示はそのまま維持しています。

> Copyright Center for Open Data in the Humanities, Research Organization of Information and Systems
> Released under the MIT license

## 取得元のスナップショット

すべて Wayback Machine の `id_` フラグ（identity / 生バイト）で取得しました。詳細な手順は別記事をご参照ください。

| ツール | 取得日（Wayback timestamp） |
|---|---|
| vdiff-org | 2025-08-22 / 2025-10-08 |
| vdiff-seq | 2024-09-09 |
| iiif-curation-viewer | 2026-01-05 |
| iiif-curation-manager | 2025-07-03 |
| iiif-curation-editor | 2025-08-23 |
| iiif-curation-player | 2025-08-27 |
| iiif-curation-board | 2025-01-24 |
| soan | dev.2sc1815j.net（@2SC1815J 氏ホスト、相対パスのプロ版から取得） |

## CODH への謝意

本ミラーの存在自体が、CODH の長年の公開活動の上に成り立っています。CODH の活動再開を心待ちにしつつ、復旧までの間だけ本ミラーが必要な方の役に立てば幸いです。
