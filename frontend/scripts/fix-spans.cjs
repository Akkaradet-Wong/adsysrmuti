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
      
      content = content.replace(/(<(?:span|a|button)[^>]*?className=)(['"])(.*?)\2([^>]*?>\s*<(?:svg|Icon)[^>]*>)/g, (match, p1, quote, classes, p4) => {
        if (!classes.includes('shrink-0') && classes.match(/w-\d+/) && classes.match(/h-\d+/)) {
          return p1 + quote + classes + ' shrink-0' + quote + p4;
        }
        return match;
      });

      // Emojis in heading
      content = content.replace(/(<span[^>]*?className=)(['"])(.*?)\2([^>]*?>[\u2600-\u27BF\u1F300-\u1F9FF\u1F600-\u1F64F\u1F680-\u1F6FF]+\s*<\/span>)/g, (match, p1, quote, classes, p4) => {
        if (!classes.includes('shrink-0')) {
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
console.log('Updated spans/buttons in ' + updated + ' files.');
