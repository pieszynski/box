/**
 * Generate PNG icons and favicon.ico from icon.svg
 * Usage: node generate-icons.mjs
 * Requires: npm install sharp png-to-ico
 */
import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = resolve(__dirname, 'public');
const svgPath = resolve(publicDir, 'icon.svg');
const svgBuffer = readFileSync(svgPath);

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function main() {
  // Generate PNGs
  for (const size of sizes) {
    const outPath = resolve(publicDir, `icons/icon-${size}x${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`✓ ${outPath}`);
  }

  // Generate favicon sizes and combine into .ico
  const faviconSizes = [16, 32, 48];
  const faviconBuffers = await Promise.all(
    faviconSizes.map((s) =>
      sharp(svgBuffer).resize(s, s).png().toBuffer()
    )
  );
  const icoBuffer = await pngToIco(faviconBuffers);
  const faviconPath = resolve(publicDir, 'favicon.ico');
  writeFileSync(faviconPath, icoBuffer);
  console.log(`✓ ${faviconPath}`);

  console.log('Done!');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
