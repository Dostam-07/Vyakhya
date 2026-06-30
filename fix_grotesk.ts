import fs from 'fs';
let content = fs.readFileSync('src/components/CanvasRenderer.tsx', 'utf8');
content = content.replace(/'Fraunces', serif/g, "'Space Grotesk', sans-serif");
fs.writeFileSync('src/components/CanvasRenderer.tsx', content);
console.log('Done Space Grotesk!');
