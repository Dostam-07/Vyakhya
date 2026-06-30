import fs from 'fs';
let content = fs.readFileSync('src/components/CanvasRenderer.tsx', 'utf8');
content = content.replace(/#6366f1/g, "#3D3A8C");
content = content.replace(/#06060c/g, "#15131A"); // Replace default bg with Ink
content = content.replace(/#0d0d0f/g, "#15131A"); // Replace default bg with Ink
fs.writeFileSync('src/components/CanvasRenderer.tsx', content);
console.log('Done replace colors!');
