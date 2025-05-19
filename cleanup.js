const fs = require('fs');
const path = require('path');

const dirsToRemove = [
  '.next',
  'app',
  'api',
  'my_website',
  'netlify'
];

const filesToRemove = [
  'netlify.dev.toml',
  'tailwind.config.js'
];

// Remove directories
dirsToRemove.forEach(dir => {
  const dirPath = path.join(__dirname, dir);
  if (fs.existsSync(dirPath)) {
    console.log(`Removing directory: ${dir}`);
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
});

// Remove files
filesToRemove.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`Removing file: ${file}`);
    fs.unlinkSync(filePath);
  }
}); 