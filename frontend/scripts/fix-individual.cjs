const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../src/pages/Classroom.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

const target1 = '<div className="md:col-span-2 flex lg:justify-start justify-center">\n                             {getStatusBadge(stu.project_status)}';
const replace1 = '<div className="md:col-span-2 flex justify-start lg:justify-start mt-2 md:mt-0">\n                             {getStatusBadge(stu.project_status)}';

content = content.replace(target1, replace1);

fs.writeFileSync(targetPath, content);
console.log('Fixed individual case properly!');
