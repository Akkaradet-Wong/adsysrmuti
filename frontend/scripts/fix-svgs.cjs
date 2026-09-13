const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  let updatedCount = 0;
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      updatedCount += processDir(fullPath);
    } else if (fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      const original = content;
      
      content = content.replace(/(<svg[^>]*?className=)(['"])(.*?)\2([^>]*?>)/g, (match, p1, quote, classes, p4) => {
        if (!classes.includes('shrink-0')) {
          return p1 + quote + classes + ' shrink-0' + quote + p4;
        }
        return match;
      });
      content = content.replace(/(<svg(?![^>]*?className=)[^>]*?>)/g, (match) => {
        return match.replace('<svg', '<svg className="shrink-0"');
      });
      
      // Also fix <img that has w- and h- classes but no shrink-0
      content = content.replace(/(<img[^>]*?className=)(['"])(.*?)\2([^>]*?>)/g, (match, p1, quote, classes, p4) => {
        if (!classes.includes('shrink-0') && classes.match(/w-\d+/) && classes.match(/h-\d+/)) {
          return p1 + quote + classes + ' shrink-0' + quote + p4;
        }
        return match;
      });

      if (content !== original) {
        fs.writeFileSync(fullPath, content);
        updatedCount++;
      }
    }
  }
  return updatedCount;
}

const updated = processDir(path.resolve(__dirname, '../src'));
console.log('Updated ' + updated + ' files.');
