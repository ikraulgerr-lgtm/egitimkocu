const fs = require('fs');
const path = require('path');

const srcPath = 'C:\\Users\\ikrau\\.gemini\\antigravity\\brain\\4b50025b-12b8-40cd-9ded-9e5cb0ff097d\\.user_uploaded\\media_1786967445008.png';
const rootDir = path.resolve(__dirname, '..');

if (!fs.existsSync(srcPath)) {
  console.error('Source icon does not exist at:', srcPath);
  process.exit(1);
}

const fileBuffer = fs.readFileSync(srcPath);

// Target destinations in web public folder
const publicTargets = [
  path.join(rootDir, 'public', 'app-icon.png'),
  path.join(rootDir, 'public', 'icon-192.png'),
  path.join(rootDir, 'public', 'icon-512.png'),
  path.join(rootDir, 'public', 'favicon.png'),
  path.join(rootDir, 'public', 'favicon.ico'),
];

// Target destinations in Android res folders
const androidResDir = path.join(rootDir, 'android', 'app', 'src', 'main', 'res');
const mipmapFolders = [
  'mipmap-mdpi',
  'mipmap-hdpi',
  'mipmap-xhdpi',
  'mipmap-xxhdpi',
  'mipmap-xxxhdpi',
];

const androidTargets = [];

mipmapFolders.forEach((folder) => {
  const fPath = path.join(androidResDir, folder);
  if (fs.existsSync(fPath)) {
    androidTargets.push(path.join(fPath, 'ic_launcher.png'));
    androidTargets.push(path.join(fPath, 'ic_launcher_round.png'));
    androidTargets.push(path.join(fPath, 'ic_launcher_foreground.png'));
  }
});

// Splash screen targets
const drawableFolders = [
  'drawable',
  'drawable-land-hdpi',
  'drawable-land-mdpi',
  'drawable-land-xhdpi',
  'drawable-land-xxhdpi',
  'drawable-land-xxxhdpi',
  'drawable-port-hdpi',
  'drawable-port-mdpi',
  'drawable-port-xhdpi',
  'drawable-port-xxhdpi',
  'drawable-port-xxxhdpi',
];

drawableFolders.forEach((folder) => {
  const fPath = path.join(androidResDir, folder);
  if (fs.existsSync(fPath)) {
    androidTargets.push(path.join(fPath, 'splash.png'));
  }
});

const allTargets = [...publicTargets, ...androidTargets];

allTargets.forEach((target) => {
  const dir = path.dirname(target);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(target, fileBuffer);
  console.log('Updated icon:', target);
});

console.log(`Successfully updated ${allTargets.length} icon locations!`);
