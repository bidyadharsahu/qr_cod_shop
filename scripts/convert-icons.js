// Convert SVG icons to PNG
// Run: node scripts/convert-icons.js

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

async function convert() {
  const files = fs.readdirSync(iconsDir).filter(f => f.endsWith('.svg'));
  
  for (const file of files) {
    const svgPath = path.join(iconsDir, file);
    const pngPath = path.join(iconsDir, file.replace('.svg', '.png'));
    
    // Extract size from filename
    const sizeMatch = file.match(/(\d+)x(\d+)/);
    const size = sizeMatch ? parseInt(sizeMatch[1]) : 180;
    
    await sharp(svgPath)
      .resize(size, size)
      .png()
      .toFile(pngPath);
    
    console.log(`Converted: ${file} -> ${file.replace('.svg', '.png')}`);
  }
  
  // Also create apple-touch-icon.png in root of public
  const appleSvg = path.join(iconsDir, 'apple-touch-icon.svg');
  const applePng = path.join(__dirname, '..', 'public', 'apple-touch-icon.png');
  if (fs.existsSync(appleSvg)) {
    await sharp(appleSvg).resize(180, 180).png().toFile(applePng);
    console.log('Created: public/apple-touch-icon.png');
  }

  // Create favicon
  const faviconSvg = path.join(iconsDir, 'icon-72x72.svg');
  const faviconPng = path.join(__dirname, '..', 'public', 'favicon.png');
  if (fs.existsSync(faviconSvg)) {
    await sharp(faviconSvg).resize(32, 32).png().toFile(faviconPng);
    console.log('Created: public/favicon.png');
  }
  
  console.log('\n✅ All icons converted to PNG!');
}

convert().catch(console.error);
