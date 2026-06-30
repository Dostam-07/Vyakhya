import fs from 'fs';
let content = fs.readFileSync('src/components/CanvasRenderer.tsx', 'utf8');
content = content.replace(/'Outfit', sans-serif/g, "'Fraunces', serif");
content = content.replace(/'JetBrains Mono', monospace/g, "'Inter', sans-serif");
content = content.replace(/'Playfair Display', serif/g, "'Fraunces', serif");
fs.writeFileSync('src/components/CanvasRenderer.tsx', content);
console.log('Done!');
