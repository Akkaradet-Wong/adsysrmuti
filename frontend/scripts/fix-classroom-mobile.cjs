const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../src/pages/Classroom.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Add pb-24 to main on mobile
content = content.replace(
  '<main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-6 relative items-start">',
  '<main className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 pb-24 sm:pb-8 flex flex-col lg:flex-row gap-6 relative items-start">'
);

// 2. Fix the flex alignment and three dots for groups (around line 1409)
content = content.replace(
  /<div className="md:col-span-2 flex lg:justify-start justify-center">\s*\{getStatusBadge\(item\.project_status\)\}\s*<\/div>\s*<div className="md:col-span-2 flex justify-center items-center gap-2">/g,
  `<div className="md:col-span-2 flex justify-start lg:justify-start mt-2 md:mt-0">
                             {getStatusBadge(item.project_status)}
                          </div>

                          <div className="absolute top-4 right-4 md:static md:col-span-2 flex justify-end items-center gap-2">`
);

// 3. Fix the flex alignment and three dots for individuals (around line 1475)
// Need to find the block for individuals
const indStatusStart = content.indexOf('<div className="md:col-span-2 flex lg:justify-start justify-center">', content.indexOf('// Individual without project'));
const indStatusEnd = content.indexOf('</div>', indStatusStart) + 6;
const indMenuStart = content.indexOf('<div className="md:col-span-2 flex justify-center items-center">', indStatusEnd);

if (indStatusStart !== -1 && indMenuStart !== -1) {
  content = content.substring(0, indStatusStart) + 
    content.substring(indStatusStart, indMenuStart)
      .replace('<div className="md:col-span-2 flex lg:justify-start justify-center">', '<div className="md:col-span-2 flex justify-start lg:justify-start mt-2 md:mt-0">') +
    content.substring(indMenuStart)
      .replace('<div className="md:col-span-2 flex justify-center items-center">', '<div className="absolute top-4 right-4 md:static md:col-span-2 flex justify-end items-center">');
}

fs.writeFileSync(targetPath, content);
console.log('Fixed Classroom mobile layout!');
