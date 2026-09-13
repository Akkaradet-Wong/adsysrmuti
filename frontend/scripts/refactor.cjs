const fs = require('fs');
const path = require('path');
const targetPath = path.resolve(__dirname, '../src/pages/AdvisorRequests.jsx');
let content = fs.readFileSync(targetPath, 'utf8');

// replace openEditModal
content = content.replace(/const openEditModal = \(request\) => \{.*?(?=\n  const handleEditChange)/s, 
`const openEditModal = (request) => {
    setSelected(request);
    setIsEditModalOpen(true);
  };`);

content = content.replace(/const handleEditChange = \(field, value\) => \{[^}]+\};\n/s, '');
content = content.replace(/const handleEditMemberChange = \(index, value\) => \{[^}]+\};\n/s, '');
content = content.replace(/const submitEditRequest = async \(e\) => \{.*?(?=\n  const revokeProject)/s, '');
content = content.replace(/const \[editFormData, setEditFormData\] = useState\([^;]+\);\n/s, '');

const startStr = '{/* ================= MODAL แก้ไขคำขอ (สำหรับนักศึกษา) ================= */}';
const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf('    </div>\n  );\n}', startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const newModal = `{/* ================= MODAL แก้ไขคำขอ (สำหรับนักศึกษา) ================= */}
      <EditProjectRequestModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        projectData={null}
        originalRequest={selected}
        projectId={null}
        onSuccess={loadUser}
        showMembers={true}
        user={user}
      />\n`;
  content = content.substring(0, startIndex) + newModal + content.substring(endIndex);
}

// Ensure the import exists
if (!content.includes('EditProjectRequestModal')) {
    content = content.replace('import ProjectScopeViewer from "../components/ProjectScopeViewer";', 'import ProjectScopeViewer from "../components/ProjectScopeViewer";\nimport EditProjectRequestModal from "../components/modals/EditProjectRequestModal";');
}

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Cleaned up AdvisorRequests');
