# Gaming Disorder Research Daily Report

> 遊戲障礙（Gaming Disorder）研究文獻每日自動彙整

## 網站

https://u8901006.github.io/gaming-disorder/

## 運作方式

1. 每天 GMT+8 08:20 自動從 PubMed 抓取最新遊戲障礙研究文獻
2. 使用 NVIDIA API (nvidia/nemotron-3-super-120b-a12b) 進行繁體中文摘要、分類
3. 生成靜態 HTML 報告並部署至 GitHub Pages
4. 自動追蹤已總結的文獻，避免重複報導

## 技術

- Node.js 24
- PubMed E-utilities API
- NVIDIA API (nvidia/nemotron-3-super-120b-a12b)
- GitHub Actions + GitHub Pages

## 相關連結

- [李政洋身心診所](https://www.leepsyclinic.com/)
- [訂閱電子報](https://blog.leepsyclinic.com/)
- [Buy Me a Coffee](https://buymeacoffee.com/CYlee)
