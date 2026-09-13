import React, { useState, useEffect } from "react";
import Swal from "sweetalert2";
import { supabase } from "../../lib/supabaseClient";

export default function EditProjectRequestModal({
  isOpen,
  onClose,
  projectData,
  originalRequest,
  projectId,
  onSuccess,
  showMembers = false,
  user
}) {
  const [editFormData, setEditFormData] = useState({
    project_title: "",
    project_scope: "",
    diagram_url: "",
    language_used: "",
    description: "",
    members: [""],
  });

  useEffect(() => {
    if (isOpen) {
      let scopeStr = originalRequest?.project_scope || "";
      if (typeof scopeStr !== 'string') scopeStr = JSON.stringify(scopeStr);
      
      let initialMembers = [""];
      if (showMembers && originalRequest?.message) {
        const msgStr = originalRequest.message;
        const memberMatch = msgStr.match(/\[สมาชิกในกลุ่ม\]:\s*(.*)/);
        if (memberMatch && memberMatch[1]) {
           initialMembers = memberMatch[1].split(',').map(e => e.trim()).filter(Boolean);
           if (initialMembers.length === 0) initialMembers = [""];
        }
        
        let descWithoutMembers = msgStr.replace(/(\n)*\[สมาชิกในกลุ่ม\]:.*$/g, '').trim();
        // also remove system notes
        descWithoutMembers = descWithoutMembers.replace(/\[หมายเหตุระบบ\]:[^\n]*/g, '').trim();

        setEditFormData({
          project_title: projectData?.title || originalRequest?.project_title || "",
          project_scope: scopeStr,
          diagram_url: originalRequest?.diagram_url || "",
          language_used: originalRequest?.language_used || "",
          description: descWithoutMembers,
          members: initialMembers,
        });
      } else {
        setEditFormData({
          project_title: projectData?.title || originalRequest?.project_title || "",
          project_scope: scopeStr,
          diagram_url: originalRequest?.diagram_url || "",
          language_used: originalRequest?.language_used || "",
          description: originalRequest?.message ? originalRequest.message.replace(/\[หมายเหตุระบบ\]:[^\n]*/g, '').trim() : "",
          members: [""],
        });
      }
    }
  }, [isOpen, originalRequest, projectData, showMembers]);

  const handleEditChange = (field, value) => {
    setEditFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEditMemberChange = (index, value) => {
    const newMembers = [...editFormData.members];
    newMembers[index] = value;
    setEditFormData(prev => ({ ...prev, members: newMembers }));
  };

  const submitEditRequest = async (e) => {
    e.preventDefault();
    if (!editFormData.project_title.trim()) return Swal.fire("แจ้งเตือน", "กรุณาระบุชื่อโปรเจกต์", "warning");

    Swal.fire({ title: 'กำลังบันทึกข้อมูล...', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    try {
      let finalMessage = editFormData.description;
      if (showMembers && editFormData.members) {
        const friendEmails = editFormData.members.map(m => m.trim().toLowerCase()).filter(m => m !== "" && (!user || m !== user.email));
        if (friendEmails.length > 0) finalMessage += `\n\n[สมาชิกในกลุ่ม]: ${friendEmails.join(', ')}`;
      }

      if (originalRequest?.request_id) {
        await supabase.from('requests').update({
          project_title: editFormData.project_title.trim(),
          project_scope: editFormData.project_scope.trim(),
          diagram_url: editFormData.diagram_url.trim(),
          language_used: editFormData.language_used.trim(),
          message: finalMessage.trim()
        }).eq('request_id', originalRequest.request_id);
      }

      if (projectId) {
        await supabase.from('projects').update({ 
          title: editFormData.project_title.trim(),
          description: finalMessage.trim(),
          scopes: editFormData.project_scope.trim()
        }).eq('project_id', projectId);
      }

      Swal.fire("สำเร็จ", "แก้ไขข้อมูลคำขอเรียบร้อยแล้ว", "success");
      onSuccess();
      onClose();
    } catch (error) {
      Swal.fire("ข้อผิดพลาด", error.message, "error");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-r from-blue-600 to-sky-500 px-5 py-4 flex items-center justify-between shrink-0">
          <h2 className="text-[15px] font-bold text-white flex items-center gap-2">
            <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            แก้ไขข้อมูลคำขอโครงงาน
          </h2>
          <button onClick={onClose} className="text-blue-100 hover:text-white bg-white/10 hover:bg-white/20 p-1 rounded-full transition-colors"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
        </div>

        <div className="p-4 md:p-5 overflow-y-auto custom-scrollbar flex-1">
          <form id="editForm" onSubmit={submitEditRequest} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">ชื่อโปรเจกต์ <span className="text-rose-500">*</span></label>
              <input type="text" required value={editFormData.project_title} onChange={(e) => handleEditChange("project_title", e.target.value)} placeholder="ระบุชื่อหรือหัวข้อโปรเจกต์" className="w-full px-3 py-2.5 bg-[#F8FAFC] border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-[13px]" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ขอบเขตของงาน</label>
                <input type="text" value={editFormData.project_scope} onChange={(e) => handleEditChange("project_scope", e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-200 rounded-lg focus:ring-blue-500/20 focus:border-blue-500 text-[13px]" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">ภาษาที่ใช้พัฒนา</label>
                <input type="text" value={editFormData.language_used} onChange={(e) => handleEditChange("language_used", e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-200 rounded-lg focus:ring-blue-500/20 focus:border-blue-500 text-[13px]" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">ลิงก์ Google Drive / Diagram</label>
              <input type="url" value={editFormData.diagram_url} onChange={(e) => handleEditChange("diagram_url", e.target.value)} className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-200 rounded-lg focus:ring-blue-500/20 focus:border-blue-500 text-[13px]" />
            </div>
            {showMembers && (
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <label className="block text-xs font-bold text-slate-700 mb-2">สมาชิกในกลุ่ม (อีเมล)</label>
                <div className="space-y-2">
                  {editFormData.members.map((member, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input type="email" value={member} onChange={e => handleEditMemberChange(index, e.target.value)} className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-[13px]" />
                      {editFormData.members.length > 1 && (
                        <button type="button" onClick={() => setEditFormData(prev => ({ ...prev, members: prev.members.filter((_, i) => i !== index) }))} className="w-8 h-8 text-rose-500 bg-white hover:bg-rose-50 rounded-lg border border-slate-200 shadow-sm flex justify-center items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setEditFormData(prev => ({ ...prev, members: [...prev.members, ""] }))} className="mt-2 text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors px-2 py-1 hover:bg-blue-50 rounded w-fit">
                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                  เพิ่มช่องกรอกอีเมล
                </button>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">คำอธิบายเพิ่มเติม</label>
              <textarea value={editFormData.description} onChange={(e) => handleEditChange("description", e.target.value)} rows="2" className="w-full px-3 py-2 bg-[#F8FAFC] border border-slate-200 rounded-lg text-[13px] resize-none"></textarea>
            </div>
          </form>
        </div>
        <div className="bg-slate-50 border-t border-slate-100 p-4 shrink-0 flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100 transition-colors text-[12px] shadow-sm">ยกเลิก</button>
          <button form="editForm" type="submit" disabled={!editFormData.project_title?.trim()} className={`px-5 py-2 rounded-lg font-bold text-white flex items-center gap-1.5 text-[12px] transition-all shadow-sm ${!editFormData.project_title?.trim() ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 hover:shadow-sm"}`}>
            บันทึกการแก้ไข
          </button>
        </div>
      </div>
    </div>
  );
}
