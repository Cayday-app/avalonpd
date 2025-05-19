const fs = require('fs');
const path = require('path');

// Files and directories to remove
const toRemove = [
    '.next',
    'app',
    'next.config.js',
    '.next-env.d.ts',
    'tsconfig.json',
    'netlify/plugins/next',
    'netlify/edge-functions'
];

// Function to recursively remove directory
function removeDirectory(dirPath) {
    if (fs.existsSync(dirPath)) {
        fs.readdirSync(dirPath).forEach((file) => {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
                removeDirectory(curPath);
            } else {
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(dirPath);
        console.log(`Removed directory: ${dirPath}`);
    }
}

// Remove each file/directory
toRemove.forEach(item => {
    const itemPath = path.join(__dirname, item);
    if (fs.existsSync(itemPath)) {
        if (fs.lstatSync(itemPath).isDirectory()) {
            removeDirectory(itemPath);
        } else {
            fs.unlinkSync(itemPath);
            console.log(`Removed file: ${itemPath}`);
        }
    }
}); 