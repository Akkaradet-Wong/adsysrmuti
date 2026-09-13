const fs = require('fs');
const path = require('path');

const listPath = path.join(__dirname, '..', 'src', 'pages', 'ProjectList.jsx');
const detailPath = path.join(__dirname, '..', 'src', 'pages', 'ProjectDetail.jsx');
const routerPath = path.join(__dirname, '..', 'src', 'pages', 'Project.jsx');

// --- Process ProjectList.jsx ---
let listCode = fs.readFileSync(listPath, 'utf8');
listCode = listCode.replace('export default function Project() {', 'export default function ProjectList() {');

// Find the start of DETAIL VIEW and remove everything until the end of the return statement.
const detailStartIdx = listCode.indexOf('// ==================== DETAIL VIEW ====================');
const styleIdx = listCode.lastIndexOf('<style>');
if (detailStartIdx !== -1 && styleIdx !== -1) {
    listCode = listCode.slice(0, detailStartIdx) + listCode.slice(styleIdx);
}
fs.writeFileSync(listPath, listCode);


// --- Process ProjectDetail.jsx ---
let detailCode = fs.readFileSync(detailPath, 'utf8');
detailCode = detailCode.replace('export default function Project() {', 'export default function ProjectDetail() {');

const listStartIdx = detailCode.indexOf('// ==================== LIST VIEW ====================');
const detailViewIdx = detailCode.indexOf('// ==================== DETAIL VIEW ====================');
if (listStartIdx !== -1 && detailViewIdx !== -1) {
    detailCode = detailCode.slice(0, listStartIdx) + detailCode.slice(detailViewIdx);
}
fs.writeFileSync(detailPath, detailCode);


// --- Process Project.jsx (Router) ---
const routerCode = `import React from 'react';
import { useSearchParams } from 'react-router-dom';
import ProjectList from './ProjectList';
import ProjectDetail from './ProjectDetail';

export default function Project() {
  const [searchParams] = useSearchParams();
  const selectedProjectId = searchParams.get('id');

  if (selectedProjectId) {
    return <ProjectDetail />;
  }
  return <ProjectList />;
}
`;
fs.writeFileSync(routerPath, routerCode);

console.log("Splitting completed successfully.");
