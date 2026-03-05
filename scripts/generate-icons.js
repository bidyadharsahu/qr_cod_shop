// Generate PWA icons for Netrik XR Shop
// Run: node scripts/generate-icons.js

const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

// Create icons directory
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Generate a simple SVG icon
function generateSVG(size, isMaskable = false) {
  const padding = isMaskable ? size * 0.1 : 0;
  const innerSize = size - (padding * 2);
  const centerX = size / 2;
  const centerY = size / 2;
  const fontSize = Math.round(innerSize * 0.28);
  const smallFont = Math.round(innerSize * 0.12);
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0a"/>
      <stop offset="100%" style="stop-color:#1a1a1a"/>
    </linearGradient>
    <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f4e4bc"/>
      <stop offset="50%" style="stop-color:#d4af37"/>
      <stop offset="100%" style="stop-color:#996515"/>
    </linearGradient>
    <linearGradient id="xr" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#38bdf8"/>
      <stop offset="50%" style="stop-color:#3b82f6"/>
      <stop offset="100%" style="stop-color:#ec4899"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)" rx="${Math.round(size * 0.18)}"/>
  <text x="${centerX}" y="${centerY - fontSize * 0.15}" font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" font-weight="900" fill="url(#gold)" text-anchor="middle" dominant-baseline="middle" letter-spacing="${Math.round(size * 0.01)}">N</text>
  <text x="${centerX}" y="${centerY + fontSize * 0.75}" font-family="Arial, Helvetica, sans-serif" font-size="${smallFont}" font-weight="700" fill="url(#xr)" text-anchor="middle" dominant-baseline="middle">XR</text>
</svg>`;
}

// Write SVG files (browsers can use these, and you can convert to PNG)
sizes.forEach(size => {
  const svg = generateSVG(size);
  const svgPath = path.join(iconsDir, `icon-${size}x${size}.svg`);
  fs.writeFileSync(svgPath, svg);
  console.log(`Created: icon-${size}x${size}.svg`);
});

// Maskable icons
[192, 512].forEach(size => {
  const svg = generateSVG(size, true);
  const svgPath = path.join(iconsDir, `icon-maskable-${size}x${size}.svg`);
  fs.writeFileSync(svgPath, svg);
  console.log(`Created: icon-maskable-${size}x${size}.svg`);
});

// Also create apple-touch-icon
const appleSvg = generateSVG(180);
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.svg'), appleSvg);
console.log('Created: apple-touch-icon.svg');

console.log('\n✅ SVG icons generated!');
console.log('\n📋 To convert SVGs to PNGs, use one of:');
console.log('   - https://cloudconvert.com/svg-to-png');
console.log('   - sharp library: sharp("icon.svg").png().toFile("icon.png")');
console.log('   - Or install sharp: npm install sharp --save-dev && node scripts/convert-icons.js');
