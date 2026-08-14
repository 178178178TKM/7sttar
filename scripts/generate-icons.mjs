#!/usr/bin/env node
// scripts/generate-icons.mjs
//
// public/favicon.svg（紺地に金のサメ）と同じサメの形（12点ポリゴン＋目、
// SHARK_SHAPE 定数）・金色（#C9A227）を使って、PWA用のラスタアイコン(PNG)を
// sharp で生成する。
//
// 注意（favicon.svg との関係）: このスクリプトは favicon.svg ファイルを
// 直接読み込むのではなく、同じポリゴン座標を SHARK_SHAPE として複製保持して
// いる。理由は、favicon.svg（ブラウザタブ用・角丸背景・背景色 #16233A）と
// ここで生成する PNG（ホーム画面用・角丸なし正方形・背景色 #0B1420、
// maskable 版はさらに縮小配置）とで背景の扱いが異なり、favicon.svg の
// マークアップをそのまま使い回せないため。
// **サメの形そのもの（ポリゴンの座標）を変更する場合は、
// public/favicon.svg と、このファイルの SHARK_SHAPE の両方を
// 手動で揃えて更新すること。**
//
// 実行: npm run icons
// 依存: sharp（devDependency。ビルド時には使わず、開発者が手動で実行する想定）

import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public');

const NAVY = '#0B1420'; // manifest.webmanifest の background_color / theme_color と一致
const GOLD = '#C9A227';

// favicon.svg と同一の座標・形状（12点ポリゴン＋目）。
// 元のbounding boxは x:[2,62] y:[0,28]（幅60, 高さ28、中心は(32,14)）。
const SHARK_SHAPE = `
  <polygon points="2,14 10,8 18,0 24,8 46,10 62,2 52,14 62,22 46,18 20,22 14,28 10,20" fill="${GOLD}" />
  <circle cx="9" cy="12" r="1.4" fill="${NAVY}" />
`;

// --- 標準アイコン（pwa-192 / pwa-512 / apple-touch-icon） ---
// favicon.svg と同じ配置（translate(6.4,20.8) scale(0.8)）を踏襲する。
// ただし favicon.svg 自体は角丸(rx=10)の背景だが、ホーム画面用のPNGは
// OS/ランチャー側が独自にマスク（角丸・円形など）を適用する前提のため、
// 二重に丸めて隅に不自然な余白が出ないよう、背景は角丸なしの正方形にする。
// 背景は透過にせず紺で塗りつぶす（透過だと端末の背景色次第で金が沈んで見える）。
function standardIconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="0" y="0" width="64" height="64" fill="${NAVY}" />
  <g transform="translate(6.4,20.8) scale(0.8)">${SHARK_SHAPE}</g>
</svg>`;
}

// --- maskableアイコン（pwa-maskable-512、purpose: "maskable"） ---
// Android のアダプティブアイコンは外周を切り落とすため、コンテンツは
// 「中央80%の円（セーフゾーン、半径 = アイコン半分の40%）」に収める必要がある。
// viewBox 0-64 の座標系では、セーフゾーン半径 = 64 * 0.4 = 25.6。
//
// サメのbounding box（幅60×高さ28、中心(32,14)）をスケールsで縮小したとき、
// bboxの四隅のうち中心から最も遠い点までの距離（半対角線）が
// セーフゾーン半径以下になるようにする（bbox全体を円に内接させる、やや
// 保守的だが確実な基準）。
//   半対角線 = sqrt((60/2)^2 + (28/2)^2) = sqrt(30^2 + 14^2) ≈ 33.106
//   scale ≤ 25.6 / 33.106 ≈ 0.773
// ここでは余裕を持たせて scale = 0.7 を採用する。
//   縮小後の半対角線 ≈ 33.106 * 0.7 ≈ 23.17
//   セーフゾーン半径 25.6 に対し ≈ 2.4（アイコン全体の約3.8%）の余白を確保。
const MASKABLE_SCALE = 0.7;

function maskableIconSvg() {
  const scale = MASKABLE_SCALE;
  const bboxCenterX = 32; // (2 + 62) / 2
  const bboxCenterY = 14; // (0 + 28) / 2
  // bboxの中心をキャンバス中心(32,32)に一致させるための平行移動量。
  const tx = 32 - bboxCenterX * scale;
  const ty = 32 - bboxCenterY * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect x="0" y="0" width="64" height="64" fill="${NAVY}" />
  <g transform="translate(${tx},${ty}) scale(${scale})">${SHARK_SHAPE}</g>
</svg>`;
}

const targets = [
  { name: 'pwa-192.png', svg: standardIconSvg(), size: 192 },
  { name: 'pwa-512.png', svg: standardIconSvg(), size: 512 },
  { name: 'apple-touch-icon.png', svg: standardIconSvg(), size: 180 },
  { name: 'pwa-maskable-512.png', svg: maskableIconSvg(), size: 512 },
];

async function main() {
  await mkdir(outDir, { recursive: true });
  for (const target of targets) {
    const svgBuffer = Buffer.from(target.svg);
    await sharp(svgBuffer)
      .resize(target.size, target.size)
      .png()
      .toFile(path.join(outDir, target.name));
    console.log(`generated: public/${target.name} (${target.size}x${target.size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
