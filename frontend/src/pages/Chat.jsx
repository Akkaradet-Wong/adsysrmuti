// =============================================
// src/pages/Chat.jsx
// =============================================
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Header from "../components/Header";
import Swal from "sweetalert2";
import ProjectScopeViewer from "../components/ProjectScopeViewer";

// 🌟 ฟังก์ชันแปลงเวลาสำหรับข้อความแชท (บังคับเวลาไทย)
const formatMessageTime = (utcDateStr) => {
  if (!utcDateStr) return "";
  
  let dateString = utcDateStr;
  if (!dateString.endsWith('Z') && !dateString.includes('+')) {
    dateString += 'Z'; 
  }

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  
  const datePart = date.toLocaleDateString("th-TH", {
    timeZone: "Asia/Bangkok",
    year: "numeric", 
    month: "long", 
    day: "numeric",
  });
  
  const timePart = date.toLocaleTimeString("th-TH", { 
    timeZone: "Asia/Bangkok",
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  });

  return `${datePart} เวลา ${timePart} น.`;
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result.split(',')[1]);
  reader.onerror = error => reject(error);
});

// 🌟 ฟังก์ชันแยกและแสดงผลข้อความ (และรูปภาพที่แนบ)
const renderMessageContent = (msg, isMe, openLightbox) => {
  let content = msg.content;
  if (!content) return null;

  if (content.startsWith("#ANNOUNCEMENT# ")) {
    content = content.replace("#ANNOUNCEMENT# ", "");
  }

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);

  const createdDate = msg.created_at ? new Date(msg.created_at) : new Date();
  const now = new Date();
  const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
  const isExpired = diffDays > 30;

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, index) => {
        if (part.match(urlRegex)) {
          const isImage = /\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(part) || part.includes('supabase.co/storage');
          if (isImage) {
            if (isExpired) {
              return (
                <span key={index} className="block mt-2 mb-1">
                  <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-center max-w-[280px] shrink-0">
                    <svg className="w-6 h-6 mx-auto text-slate-400 mb-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-[13px] font-medium text-slate-600">รูปภาพหมดอายุแล้ว</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">ระบบจะเก็บรูปภาพไว้เพียง 30 วัน</p>
                  </div>
                </span>
              );
            }
            return (
              <span key={index} className="block mt-2 mb-1">
                <button 
                  type="button"
                  onClick={() => openLightbox && openLightbox(part)}
                  className="block text-left"
                >
                  <img 
                    src={part} 
                    alt="attachment preview" 
                    className="max-w-full rounded-xl shadow-sm border border-slate-200 max-h-60 object-contain hover:opacity-90 transition-opacity bg-white cursor-zoom-in"
                  />
                </button>
              </span>
            );
          }
          return (
            <a 
              key={index} 
              href={part} 
              target="_blank" 
              rel="noopener noreferrer" 
              className={`underline font-bold break-all transition-colors ${
                isMe 
                  ? "text-slate-900 bg-white/60 px-1.5 py-0.5 rounded hover:bg-white/60" 
                  : "text-slate-900 hover:text-black"
              }`}
            >
              {part}
            </a>
          );
        }
        return <span key={index}>{part}</span>;
      })}
    </span>
  );
};

export default function Chat() {
  const navigate = useNavigate();
  const location = useLocation();
  const { chatPartnerId, projectTitle, targetId } = location.state || {};

  // ================= STATE =================
  const [authUser, setAuthUser] = useState(null); 
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // แชท State
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [roomMembers, setRoomMembers] = useState({ advisor: null, coAdvisor: null, students: [] });
  const [projectDetails, setProjectDetails] = useState(null);
  
  // State สำหรับเก็บห้องที่มีข้อความใหม่ที่ยังไม่ได้อ่าน
  const [unreadRooms, setUnreadRooms] = useState(new Set());

  // Modal ข้อมูลโปรเจกต์
  const [isProjectInfoModalOpen, setIsProjectInfoModalOpen] = useState(false);

  // Image Paste & Upload State
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const fileInputRef = useRef(null);

  // Sidebar Toggles สำหรับ Mobile
  const [showList, setShowList] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // State สำหรับเปิด-ปิด Accordion กลุ่มสมาชิก
  const [isAdvisorsOpen, setIsAdvisorsOpen] = useState(true);
  const [isStudentsOpen, setIsStudentsOpen] = useState(true);

  // Lightbox State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Search State
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Mute State
  const [mutedRooms, setMutedRooms] = useState(() => {
    try {
      const stored = localStorage.getItem("chat_muted_rooms");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  });

  const toggleMuteRoom = (roomId) => {
    if (!roomId) return;
    const updated = { ...mutedRooms, [roomId]: !mutedRooms[roomId] };
    setMutedRooms(updated);
    localStorage.setItem("chat_muted_rooms", JSON.stringify(updated));
  };

  // Media, Files, Links Modal
  const [activeAttachmentTab, setActiveAttachmentTab] = useState(null); // 'media', 'file', 'link', or null

  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // ================= FUNCTIONS =================
  const openLightbox = (targetUrl) => {
    const allImages = [];
    const now = new Date();
    
    messages.forEach(m => {
      const createdDate = m.created_at ? new Date(m.created_at) : new Date();
      const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
      const isExpired = diffDays > 30;
      
      if (isExpired) return;

      if (m.file_url && (/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(m.file_url) || m.file_url.includes('storage'))) {
        allImages.push(m.file_url);
      }
      if (m.content) {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = m.content.match(urlRegex) || [];
        parts.forEach(p => {
          if (/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(p) || p.includes('supabase.co/storage')) {
            allImages.push(p);
          }
        });
      }
    });
    const uniqueImages = [...new Set(allImages)];
    const index = uniqueImages.indexOf(targetUrl);
    setLightboxImages(uniqueImages.length > 0 ? uniqueImages : [targetUrl]);
    setLightboxIndex(index !== -1 ? index : 0);
    setLightboxOpen(true);
  };

  const fetchRooms = async (profile) => {
    try {
      let chatList = [];
      let myProjects = [];
      
      if (profile.role?.toUpperCase() === "STUDENT") {
        const { data: projData } = await supabase
          .from("project_members")
          .select("projects(project_id, title, advisor_id, co_advisor_id, status, co_advisor_status)")
          .eq("student_id", profile.auth_id);
          
        if (projData) {
          myProjects = projData.map(d => d.projects).filter(p => p && (p.status === "in_progress" || p.status === "ongoing" || p.status === "completed"));
        }

        const { data: roomData } = await supabase
          .from("room_members")
          .select("project_rooms(room_id, title)")
          .eq("user_id", profile.auth_id)
          .eq("status", "approved");

        if (roomData) {
           const myClassrooms = roomData.map(d => d.project_rooms).filter(Boolean);
           chatList = [...chatList, ...myClassrooms.map(c => ({ ...c, chat_type: 'classroom', display_id: c.room_id }))];
        }

      } else {
        const { data: projData } = await supabase
          .from("projects")
          .select("project_id, title, advisor_id, co_advisor_id, status, co_advisor_status")
          .or(`advisor_id.eq.${profile.auth_id},co_advisor_id.eq.${profile.auth_id}`)
          .in("status", ["in_progress", "ongoing", "completed"]); 
          
        if (projData) {
          myProjects = projData.filter(p => {
            if (p.advisor_id === profile.auth_id) return true;
            if (p.co_advisor_id === profile.auth_id) {
              const coStatus = p.co_advisor_status?.toLowerCase();
              return coStatus === "accepted" || coStatus === "co_advisor_accepted";
            }
            return false;
          });
        }

        const { data: roomData } = await supabase
          .from("project_rooms")
          .select("room_id, title")
          .eq("advisor_id", profile.auth_id);
          
        if (roomData) {
          chatList = [...chatList, ...roomData.map(c => ({ ...c, chat_type: 'classroom', display_id: c.room_id }))];
        }
      }
      
      if (myProjects.length > 0) {
        const mappedProjects = myProjects.map(p => ({
          ...p,
          chat_type: 'project',
          display_id: p.project_id
        }));
        chatList = [...mappedProjects, ...chatList]; 
      }
      
      setRooms(chatList);
      
      if (chatList.length > 0) {
        if (targetId) {
           const match = chatList.find(c => c.display_id === targetId);
           if (match) handleSelectRoom(match);
           else handleSelectRoom(chatList[0]);
        } else if (!activeRoom) {
           handleSelectRoom(chatList[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching rooms", err);
    }
  };

  // ================= INIT USER & DATA =================
  useEffect(() => {
    let isMounted = true;
    const initData = async () => {
      try {
        const { data: { user: auth } } = await supabase.auth.getUser();
        if (!auth) return navigate("/login");

        const { data: profile } = await supabase
          .from("users")
          .select("*")
          .eq("email", auth.email)
          .maybeSingle();

        if (profile && isMounted) {
          setAuthUser(auth);
          setCurrentUser(profile);
          fetchRooms(profile);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    initData();
    return () => { isMounted = false; };
  }, [navigate]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSelectRoom = (roomObj) => {
    setActiveRoom(roomObj);
    loadMessages(roomObj);
    fetchRoomDetails(roomObj);
    setShowList(false);
    
    setUnreadRooms(prev => {
      const newSet = new Set(prev);
      newSet.delete(roomObj.display_id);
      return newSet;
    });
  };

  const fetchRoomDetails = async (roomObj) => {
    try {
      if (roomObj.chat_type === 'classroom') {
        const { data: cr } = await supabase.from("project_rooms").select("*").eq("room_id", roomObj.display_id).single();
        setProjectDetails({ description: "ห้องสนทนาหลักของรายวิชานี้", ...cr });

        const { data: members } = await supabase.from("room_members").select("user_id").eq("room_id", roomObj.display_id).eq("status", "approved");
        const userIds = [];
        if (cr?.advisor_id) userIds.push(cr.advisor_id);
        if (members) members.forEach(m => userIds.push(m.user_id));

        if (userIds.length > 0) {
          const { data: usersData } = await supabase.from("users").select("auth_id, first_name, last_name, profile_image, role").in("auth_id", userIds);
          const advisor = usersData.find(u => u.auth_id === cr.advisor_id);
          const studentList = members?.map(m => usersData.find(u => u.auth_id === m.user_id)).filter(Boolean);
          setRoomMembers({ advisor, coAdvisor: null, students: studentList || [] });
        }
      } else if (roomObj.is_request) {
        const { data: req } = await supabase.from("requests").select("*").eq("request_id", roomObj.display_id).single();
        
        let cleanDescription = req?.message || "";
        const emailRegex = /\[สมาชิกในกลุ่ม\]:[\s\S]*/;
        cleanDescription = cleanDescription.replace(emailRegex, "").trim();
        const systemNoteRegex = /\[หมายเหตุระบบ\]:[^\n]*/g;
        cleanDescription = cleanDescription.replace(systemNoteRegex, "").trim();

        setProjectDetails({ 
          ...req, 
          description: cleanDescription || "ไม่มีรายละเอียด",
          project_scope: req?.project_scope,
          language_used: req?.language_used,
          diagram_url: req?.diagram_url
        });

        const userIds = [];
        if (req?.advisor_id) userIds.push(req.advisor_id);
        if (req?.student_id) userIds.push(req.student_id);

        if (userIds.length > 0) {
          const { data: usersData } = await supabase.from("users").select("auth_id, first_name, last_name, profile_image, role").in("auth_id", userIds);
          const advisor = usersData.find(u => u.auth_id === req?.advisor_id);
          const studentList = usersData.filter(u => u.auth_id === req?.student_id).map(u => ({ ...u, project_role: 'leader' }));
          setRoomMembers({ advisor, coAdvisor: null, students: studentList || [] });
        }
      } else {
        const { data: project } = await supabase.from("projects").select("*").eq("project_id", roomObj.display_id).single();
        
        let reqData = null;
        if (project?.leader_id && project?.advisor_id) {
          const { data: rd } = await supabase.from("requests")
            .select("project_scope, language_used, diagram_url")
            .eq("student_id", project.leader_id)
            .eq("advisor_id", project.advisor_id)
            .eq("project_title", project.title)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          reqData = rd;
        }

        setProjectDetails({
          ...project,
          project_scope: reqData?.project_scope || project?.scopes,
          language_used: reqData?.language_used,
          diagram_url: reqData?.diagram_url
        });

        const { data: members } = await supabase.from("project_members").select("student_id, role").eq("project_id", roomObj.display_id);
        const userIds = [];
        if (project?.advisor_id) userIds.push(project.advisor_id);
        if (project?.co_advisor_id) userIds.push(project.co_advisor_id);
        if (project?.leader_id && !userIds.includes(project.leader_id)) userIds.push(project.leader_id);
        if (members) members.forEach(m => { if (!userIds.includes(m.student_id)) userIds.push(m.student_id); });

        if (userIds.length > 0) {
          const { data: usersData } = await supabase.from("users").select("auth_id, first_name, last_name, profile_image, role").in("auth_id", userIds);
          const advisor = usersData?.find(u => u.auth_id === project?.advisor_id);
          const coAdvisor = usersData?.find(u => u.auth_id === project?.co_advisor_id);
          
          let studentList = (members || []).map(m => {
            const uData = usersData?.find(u => u.auth_id === m.student_id);
            return { ...uData, project_role: m.role || (m.student_id === project?.leader_id ? 'leader' : 'member') };
          }).filter(u => u && u.auth_id);

          if (project?.leader_id && !studentList.some(s => s.auth_id === project.leader_id)) {
            const leaderUser = usersData?.find(u => u.auth_id === project.leader_id);
            if (leaderUser) {
              studentList.unshift({ ...leaderUser, project_role: 'leader' });
            }
          }

          setRoomMembers({ advisor, coAdvisor, students: studentList || [] });
        }
      }
    } catch (err) {
      console.error("Error fetching room details", err);
    }
  };

  const loadMessages = async (roomObj) => {
    if (!roomObj) return; 
    try {
      const colName = roomObj.chat_type === 'classroom' ? 'room_id' : (roomObj.is_request ? 'request_id' : 'project_id');
      
      const { data: chatData, error: chatError } = await supabase
        .from("project_messages")
        .select(`
          message_id, content, created_at, sender_id, file_url,
          users!project_messages_sender_id_fkey(first_name, last_name, profile_image)
        `)
        .eq(colName, roomObj.display_id)
        .order("created_at", { ascending: true });

      if (chatError) throw chatError;
      
      let allItems = chatData ? [...chatData] : [];

      allItems.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      setMessages(allItems);
    } catch (err) {
      console.error("Error loading messages:", err);
    }
  };

  const uploadFileToDrive = async (file) => {
    const rawGas = import.meta.env.VITE_GAS_URL;
    const rawFolder = import.meta.env.VITE_DRIVE_FOLDER_ID;

    const SCRIPT_URL = (rawGas && rawGas.startsWith("http")) 
      ? rawGas 
      : (rawFolder && rawFolder.startsWith("http")) 
        ? rawFolder 
        : "https://script.google.com/macros/s/AKfycbwoUKTZc4n4p4FXdGDv2ZulyoItCRchlotQXl7zeYpumOAQpVUoowU9qM_oP-fsAEs3/exec";

    const isValidFolderId = (id) => id && !id.startsWith("http") && !id.startsWith("AKfycb") && id.length < 45;

    const FOLDER_ID = isValidFolderId(rawFolder) 
      ? rawFolder 
      : isValidFolderId(rawGas) 
        ? rawGas 
        : "1aGWh1P0Ry2yEI90NgZTCHz_SiSn7vLBG";
    
    if (!SCRIPT_URL || !FOLDER_ID) {
      throw new Error("ระบบยังไม่ได้ตั้งค่า VITE_GAS_URL หรือ VITE_DRIVE_FOLDER_ID");
    }

    const fileExt = file.name ? file.name.split('.').pop() : 'png';
    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
    // จัดกลุ่มไฟล์เข้าโฟลเดอร์ตามชื่อห้อง
    const subfolderName = `Chat - ${activeRoom.title || activeRoom.display_id}`;

    const base64 = await fileToBase64(file);
    if (base64.length > 35 * 1024 * 1024) {
      throw new Error(`ไฟล์มีขนาดใหญ่เกินไป (รองรับสูงสุด 35MB)`);
    }

    const payload = {
      folderId: FOLDER_ID,
      filename: fileName,
      mimeType: file.type || "application/octet-stream",
      subfolderName: subfolderName,
      base64: base64
    };

    const response = await fetch(SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      credentials: "omit",
      redirect: "follow"
    });

    const responseText = await response.text();
    let result;
    try {
      result = JSON.parse(responseText);
    } catch (e) {
      console.error("GAS raw response in Chat:", responseText);
      throw new Error(`ไม่สามารถอ่านข้อมูลตอบกลับจาก Google Drive ได้ (${responseText.substring(0, 80) || "Empty"}) โปรดตรวจสอบการตั้งค่า Deploy ใน Google Apps Script`);
    }

    if (!result || !result.success) throw new Error(result?.error || 'อัปโหลดไฟล์ไม่สำเร็จ');
    
    return result.url;
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !selectedImage) || !activeRoom || isSending) return;

    setIsSending(true);
    const msgText = newMessage.trim();

    try {
      let uploadedFileUrl = null;
      if (selectedImage) {
        Swal.fire({
          title: "กำลังส่งไฟล์...",
          text: "โปรดรอสักครู่ ระบบกำลังอัปโหลดไฟล์ไปยัง Google Drive",
          allowOutsideClick: false,
          didOpen: () => {
            Swal.showLoading();
          }
        });
        const baseFileUrl = await uploadFileToDrive(selectedImage);
        uploadedFileUrl = baseFileUrl + (selectedImage?.name ? '#' + encodeURIComponent(selectedImage.name) : '');
        Swal.close();
      }

      const insertData = {
        sender_id: currentUser.email,
        content: msgText || (selectedImage?.type?.startsWith('image/') ? "ส่งรูปภาพ" : "ส่งไฟล์"),
        file_url: uploadedFileUrl
      };
      
      if (activeRoom.chat_type === 'classroom') {
        insertData.room_id = activeRoom.display_id;
      } else if (activeRoom.is_request) {
        insertData.request_id = activeRoom.display_id;
      } else {
        insertData.project_id = activeRoom.display_id;
      }

      const { error } = await supabase.from("project_messages").insert(insertData);
      if (error) throw error;
      
      setNewMessage("");
      clearImageSelection();
      loadMessages(activeRoom);
    } catch (err) {
      console.error(err);
      Swal.fire("ข้อผิดพลาด", err.message || "ส่งข้อความไม่สำเร็จ", "error");
    } finally {
      setIsSending(false);
    }
  };

  const handleDeleteMessage = async (msg) => {
    const result = await Swal.fire({
      title: "ลบข้อความ?",
      text: "คุณต้องการลบข้อความนี้ออกจากระบบใช่หรือไม่?",
      icon: "warning",
      showCancelButton: true, reverseButtons: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#cbd5e1",
      confirmButtonText: "ลบข้อความ",
      cancelButtonText: "ยกเลิก"
    });

    if (result.isConfirmed) {
      try {
        // ลบไฟล์ใน Google Drive ถ้ามี
        if (msg.file_url && msg.file_url.includes("drive.google.com")) {
          const match = msg.file_url.match(/[?&]id=([^&]+)/);
          if (match && match[1]) {
            const SCRIPT_URL = import.meta.env.VITE_GAS_URL;
            if (SCRIPT_URL) {
              await fetch(SCRIPT_URL, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({ action: "delete", fileId: match[1] })
              }).catch(e => console.error("Error deleting from Drive:", e));
            }
          }
        }

        const { error } = await supabase
          .from("project_messages")
          .delete()
          .eq("message_id", msg.message_id);
        
        if (error) throw error;
        setMessages(prev => prev.filter(m => m.message_id !== msg.message_id));
      } catch (err) {
        Swal.fire("ข้อผิดพลาด", "ไม่สามารถลบข้อความได้", "error");
      }
    }
  };

  const handleEditMessage = async (msg) => {
    // Helper to safely inject content into HTML string
    const escapeHtml = (unsafe) => {
      return (unsafe || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    };

    const { value: newContent } = await Swal.fire({
      html: `
        <div class="text-left font-['Kanit']">
          <div class="flex justify-between items-center mb-3">
            <h3 class="text-[17px] font-bold text-slate-800 m-0 pl-1">แก้ไขข้อความ</h3>
            <button id="edit-close-btn" class="w-8 h-8 rounded-full bg-slate-200/80 text-slate-800 flex items-center justify-center hover:bg-slate-300 transition-colors">
              <svg className="shrink-0" width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"></path></svg>
            </button>
          </div>
          <div class="flex items-center gap-3">
            <input id="edit-input-field" type="text" value="${escapeHtml(msg.content)}" class="flex-1 bg-[#f3f4f6] border-none rounded-full px-5 py-3 text-[15px] text-slate-700 focus:ring-0 focus:outline-none" placeholder="พิมพ์ข้อความที่ต้องการแก้ไข..." autocomplete="off" />
            <button id="edit-save-btn" class="w-10 h-10 shrink-0 rounded-full bg-[#d1d5db] text-white flex items-center justify-center hover:bg-emerald-400 transition-colors shadow-sm">
              <svg className="shrink-0" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"></path></svg>
            </button>
          </div>
        </div>
      `,
      showConfirmButton: false,
      showCancelButton: false,
      showCloseButton: false,
      focusConfirm: false,
      position: 'bottom',
      width: '100%',
      backdrop: 'rgba(255, 255, 255, 0.4)', // Light transparent backdrop
      customClass: {
        container: '!p-0 !items-end',
        popup: '!bg-white !rounded-t-3xl !rounded-b-none !p-5 md:!p-6 !m-0 !w-full !max-w-2xl !mx-auto shadow-[0_-10px_40px_rgba(0,0,0,0.08)] border-t border-slate-100'
      },
      didOpen: () => {
        const input = document.getElementById('edit-input-field');
        const saveBtn = document.getElementById('edit-save-btn');
        const closeBtn = document.getElementById('edit-close-btn');

        if (input) {
          input.focus();
          const len = input.value.length;
          input.setSelectionRange(len, len);

          // Change save button color when typing
          input.addEventListener('input', () => {
            if (input.value.trim() !== msg.content && input.value.trim().length > 0) {
              saveBtn.classList.remove('bg-[#d1d5db]');
              saveBtn.classList.add('bg-emerald-500');
            } else {
              saveBtn.classList.remove('bg-emerald-500');
              saveBtn.classList.add('bg-[#d1d5db]');
            }
          });
        }

        const handleSave = () => {
          const val = input.value.trim();
          if (!val) {
             input.focus();
             return;
          }
          Swal.clickConfirm();
        };

        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') handleSave();
        });
        
        saveBtn.addEventListener('click', handleSave);
        closeBtn.addEventListener('click', () => Swal.close());
      },
      preConfirm: () => {
        const input = document.getElementById('edit-input-field');
        return input ? input.value.trim() : null;
      }
    });

    if (newContent && newContent !== msg.content) {
      try {
        const { error } = await supabase
          .from("project_messages")
          .update({ content: newContent.trim() })
          .eq("message_id", msg.message_id);
          
        if (error) throw error;
        setMessages(prev => prev.map(m => m.message_id === msg.message_id ? { ...m, content: newContent.trim() } : m));
      } catch (err) {
        Swal.fire("ข้อผิดพลาด", "ไม่สามารถแก้ไขข้อความได้", "error");
      }
    }
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        handleImageSelect(file);
        e.preventDefault(); 
        break;
      }
    }
  };

  const handleImageSelect = (file) => {
    if (!file) return;
    setSelectedImage(file);
    setImagePreviewUrl(URL.createObjectURL(file));
  };

  const clearImageSelection = () => {
    setSelectedImage(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault(); 
      handleSendMessage(e);
    }
  };

  useEffect(() => {
    const channel = supabase
      .channel('chat_messages')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'project_messages' }, payload => {
          if (payload.eventType === 'INSERT') {
            const roomId = payload.new.room_id || payload.new.project_id || payload.new.request_id;
            
            if (activeRoom && roomId === activeRoom.display_id) {
              loadMessages(activeRoom);
            } else if (roomId) {
              setUnreadRooms(prev => new Set(prev).add(roomId));
            }
          } else {
            if (activeRoom) {
              const roomId = payload.new?.room_id || payload.new?.project_id || payload.new?.request_id || payload.old?.room_id || payload.old?.project_id || payload.old?.request_id;
              if (roomId === activeRoom.display_id) {
                loadMessages(activeRoom);
              }
            }
          }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeRoom]);

  const closePanels = () => {
    setShowList(false);
    setShowDetail(false);
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50/60 flex items-center justify-center">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );

  const advisorCount = (roomMembers.advisor ? 1 : 0) + (roomMembers.coAdvisor ? 1 : 0);

  return (
    <div className="h-screen flex flex-col bg-transparent relative overflow-hidden transition-colors duration-200" style={{ fontFamily: "'Kanit', sans-serif" }}>
      {/* ================= HEADER ================= */}
      <Header 
        user={authUser} 
        role={currentUser?.role} 
        fullName={`${currentUser?.first_name || ''} ${currentUser?.last_name || ''}`}
        profileImage={currentUser?.profile_image}
      />

      {/* ================= MAIN CHAT LAYOUT ================= */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative z-10 w-full">
        
        {/* Backdrop สำหรับ Mobile */}
        {(showList || showDetail) && (
          <div 
            className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-all" 
            onClick={closePanels}
          />
        )}

        {/* ================= PANEL ซ้าย: รายการห้องแชท ================= */}
        <aside className={`absolute lg:relative w-72 lg:w-80 h-full bg-white border-r border-slate-200 z-50 transform transition-transform duration-300 ${showList ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'} flex flex-col`}>
          <div className="h-[72px] px-5 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">แชทของฉัน</h2>
            <button onClick={() => setShowList(false)} className="lg:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div className="p-4 shrink-0">
            <div className="relative">
              <input type="text" placeholder="ค้นหาห้องแชท..." className="w-full pl-10 pr-4 py-2.5 bg-slate-100/70 border border-slate-200/60 rounded-xl text-sm focus:outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-100 transition-all placeholder:text-slate-400" />
              <svg className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-1.5 custom-scrollbar">
            {rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center mt-12 px-4 text-center">
                <div className="w-12 h-12 bg-blue-50 text-blue-300 rounded-full flex items-center justify-center mb-3 shrink-0">
                  <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                </div>
                <p className="text-slate-500 font-medium text-sm">ยังไม่มีประวัติการแชท</p>
                <p className="text-slate-400 text-xs mt-1">โครงงานอาจยังไม่อนุมัติ หรือยังไม่ได้ถูกเชิญเข้าห้อง</p>
              </div>
            ) : (
              rooms.map((room, idx) => {
                const isActive = activeRoom?.display_id === room.display_id;
                const hasUnread = unreadRooms.has(room.display_id);

                return (
                  <button 
                    key={idx}
                    onClick={() => handleSelectRoom(room)}
                    className={`group relative w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all duration-200 ${isActive ? 'bg-blue-50 border border-blue-200 shadow-sm' : 'hover:bg-slate-100 border border-transparent'}`}
                  >
                    <div className="relative shrink-0">
                      <div className={`w-12 h-12 text-white rounded-full flex items-center justify-center text-lg font-bold shadow-sm ${room.chat_type === 'classroom' ? 'bg-sky-500' : 'bg-blue-600'}`}>
                        {room.chat_type === 'classroom' ? 'C' : (room.title?.charAt(0) || "P")}
                      </div>
                      {hasUnread && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 border-2 border-white rounded-full"></span>
                      )}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <h4 className={`text-[15px] truncate pr-4 transition-colors ${isActive ? 'font-bold text-blue-900' : 'font-semibold text-slate-700 group-hover:text-slate-900'}`}>
                        {room.title}
                      </h4>
                      <p className={`text-[12px] truncate mt-0.5 ${isActive ? 'text-blue-600/80 font-medium' : (hasUnread ? 'text-blue-600 font-semibold' : 'text-slate-500')}`}>
                        {room.chat_type === 'classroom' ? 'แชทห้องเรียนรวม' : 'แชทกลุ่มโครงงาน'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* ================= PANEL กลาง: พื้นที่แชท ================= */}
        <main className="flex-1 flex flex-col h-full bg-blue-50/30 relative w-full min-w-0">
          {activeRoom ? (
            <>
              {/* Chat Header */}
              <div className="h-[72px] px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 z-10">
                <div className="flex items-center gap-3.5">
                  <button onClick={() => setShowList(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-xl transition-colors -ml-2">
                    <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                  </button>
                  <div className="hidden sm:flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-slate-800 text-lg leading-tight truncate max-w-xs sm:max-w-md md:max-w-xl">
                        {activeRoom.title}
                      </h3>
                    </div>
                    <p className="text-xs text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
                      <span className={`w-2 h-2 rounded-full ${activeRoom.chat_type === 'classroom' ? 'bg-sky-500' : 'bg-blue-500'}`}></span> 
                      {activeRoom.chat_type === 'classroom' ? 'ห้องเรียน' : 'โครงงาน'}
                    </p>
                  </div>
                  {/* Mobile Title View */}
                  <div className="sm:hidden flex flex-col justify-center">
                     <h3 className="font-bold text-slate-800 text-[15px] leading-tight truncate w-[180px]">{activeRoom.title}</h3>
                     <p className="text-[11px] text-slate-500 mt-0.5">{activeRoom.chat_type === 'classroom' ? 'ห้องเรียน' : 'โครงงาน'}</p>
                  </div>
                </div>

                <button onClick={() => setShowDetail(true)} className="xl:hidden p-2.5 text-blue-600 hover:bg-blue-50 bg-white border border-blue-100 rounded-xl shadow-sm transition-all">
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </button>
              </div>

              {/* Search Bar UI */}
              {isSearchActive && (
                <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center gap-3 z-10 shrink-0 animate-in slide-in-from-top-2 duration-200">
                  <div className="relative flex-1 shrink-0">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                    <input 
                      type="text" 
                      placeholder="ค้นหาข้อความ..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[13px] outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                      autoFocus
                    />
                    {searchQuery && (
                      <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                  <button onClick={() => { setIsSearchActive(false); setSearchQuery(""); }} className="text-[13px] font-semibold text-slate-500 hover:text-slate-700">
                    ยกเลิก
                  </button>
                </div>
              )}

              {/* Chat Messages */}
              <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <div className="bg-blue-50 text-blue-400 p-4 rounded-full shadow-sm mb-3 shrink-0">
                      <svg className="w-8 h-8 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                    </div>
                    <p className="text-sm font-medium">เริ่มต้นบทสนทนาในห้องนี้</p>
                  </div>
                ) : (
                  messages.filter(msg => !searchQuery || msg.content?.toLowerCase().includes(searchQuery.toLowerCase())).map((msg) => {
                    const isMe = msg.sender_id === currentUser?.email || msg.sender_id === currentUser?.auth_id;
                    const senderName = isMe ? "คุณ" : `${msg.users?.first_name || ""} ${msg.users?.last_name || ""}`;
                    
                    return (
                      <div key={msg.message_id} className={`group w-full flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        {!isMe && (
                           <div className="flex items-center gap-2 mb-1.5 pl-1">
                             {msg.users?.profile_image ? (
                               <img src={msg.users.profile_image} className="w-5 h-5 rounded-full object-cover shadow-sm border border-slate-200 shrink-0" alt="avatar"/>
                             ) : (
                               <div className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold">
                                 {msg.users?.first_name?.charAt(0) || "U"}
                               </div>
                             )}
                             <span className="text-[11px] text-slate-500 font-medium">{senderName}</span>
                           </div>
                        )}
                        
                        <div className={`flex items-start gap-2 max-w-[90%] md:max-w-[75%] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                          
                          <div className={`relative px-4 py-3 rounded-2xl shadow-sm text-[14px] leading-relaxed 
                            ${isMe 
                              ? "bg-blue-600 text-white rounded-tr-sm" 
                              : "bg-white text-slate-800 rounded-tl-sm border border-slate-200"
                            }`}>
                            
                            {/* 🌟 โยน Object msg ทั้งก้อนลงไปประมวลผล */}
                            {renderMessageContent(msg, isMe, openLightbox)}
                            
                            {msg.file_url && (
                              <div className="mt-2">
                                {(/\.(jpeg|jpg|gif|png|webp|svg)(\?.*)?$/i.test(msg.file_url) || msg.file_url === "EXPIRED_IMAGE") ? (
                                  (() => {
                                    const createdDate = msg.created_at ? new Date(msg.created_at) : new Date();
                                    const now = new Date();
                                    const diffDays = (now - createdDate) / (1000 * 60 * 60 * 24);
                                    const isExpired = diffDays > 30 || msg.file_url === "EXPIRED_IMAGE";
                                    
                                    if (isExpired) {
                                      return (
                                        <div className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-center max-w-[280px] shrink-0">
                                          <svg className="w-6 h-6 mx-auto text-slate-400 mb-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                          <p className="text-[13px] font-medium text-slate-600">รูปภาพหมดอายุแล้ว</p>
                                          <p className="text-[11px] text-slate-500 mt-0.5">ระบบจะเก็บรูปภาพไว้เพียง 30 วัน</p>
                                        </div>
                                      );
                                    }
                                    
                                    return (
                                      <button type="button" onClick={() => openLightbox(msg.file_url)} className="block">
                                        <img 
                                          src={msg.file_url} 
                                          alt="Uploaded attachment" 
                                          className="max-w-full sm:max-w-[280px] max-h-60 rounded-2xl object-cover border border-slate-200 shadow-sm hover:opacity-90 transition-opacity bg-white cursor-pointer" 
                                        />
                                      </button>
                                    );
                                  })()
                                ) : (
                                  <a 
                                    href={msg.file_url} 
                                    target="_blank" 
                                    rel="noopener noreferrer" 
                                    className="inline-flex items-center gap-3 px-4 py-3 bg-[#2b2d31] hover:bg-[#313338] text-gray-200 rounded-[14px] shadow-sm transition-all max-w-full"
                                  >
                                    <div className="flex items-center justify-center shrink-0">
                                      <svg className="w-8 h-8 text-gray-300 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M6 2C4.895 2 4 2.895 4 4V20C4 21.105 4.895 22 6 22H18C19.105 22 20 21.105 20 20V8L14 2H6ZM13 3.5L18.5 9H14C13.448 9 13 8.552 13 8V3.5ZM8 14H16V15H8V14ZM8 17H13V18H8V17Z" />
                                      </svg>
                                    </div>
                                    <div className="flex flex-col text-left overflow-hidden">
                                      <span className="font-semibold text-gray-200 text-[14px] truncate" title={msg.file_url.includes('#') ? decodeURIComponent(msg.file_url.split('#').pop()) : (msg.file_url.includes('drive.google.com') ? 'ไฟล์แนบ' : decodeURIComponent(msg.file_url.split('/').pop().split('?')[0]))}>
                                        {msg.file_url.includes('#') ? decodeURIComponent(msg.file_url.split('#').pop()) : (msg.file_url.includes('drive.google.com') ? 'ไฟล์แนบ' : decodeURIComponent(msg.file_url.split('/').pop().split('?')[0]))}
                                      </span>
                                      <span className="text-[12px] text-gray-400 font-normal mt-0.5">ไฟล์เอกสาร</span>
                                    </div>
                                  </a>
                                )}
                              </div>
                            )}
                          </div>

                          {isMe && (
                            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 mt-1 px-1">
                              <button 
                                onClick={() => handleEditMessage(msg)} 
                                className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-all" 
                                title="แก้ไขข้อความ"
                              >
                                <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                              </button>
                              <button 
                                onClick={() => handleDeleteMessage(msg)} 
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all" 
                                title="ลบข้อความ"
                              >
                                <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          )}

                        </div>

                        {/* แสดงผลเวลาแบบ วัน เดือน ปี เวลา HH:mm น. ตามเวลาไทย */}
                        <div className={`text-[10px] text-slate-400 mt-1 font-medium ${isMe ? 'pr-1' : 'pl-1'}`}>
                          {formatMessageTime(msg.created_at)}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 sm:p-5 bg-white border-t border-slate-200 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
                <form onSubmit={handleSendMessage} className="flex gap-2.5 max-w-5xl mx-auto items-end relative">
                  
                  <textarea
                    rows={1}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="พิมพ์ข้อความ ส่งลิงก์..."
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-[15px] resize-none h-[48px] min-h-[48px] max-h-[120px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                  />
                  
                  <button
                    type="submit"
                    disabled={(!newMessage.trim() && !selectedImage) || isSending}
                    className="px-5 sm:px-6 h-[48px] bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-sm transition-all shrink-0 flex items-center justify-center gap-2"
                  >
                    {isSending ? (
                      <svg className="animate-spin w-5 h-5 text-white shrink-0" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    ) : (
                      <>
                        <span className="hidden sm:block">ส่ง</span>
                        <svg className="w-4 h-4 transform rotate-45 -mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      </>
                    )}
                  </button>
                </form>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl m-6 border border-dashed border-slate-200 shadow-sm">
              <div className="w-20 h-20 bg-blue-50 text-blue-400 rounded-3xl flex items-center justify-center mb-5 rotate-3 hover:rotate-0 transition-transform shrink-0">
                <svg className="w-10 h-10 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <p className="font-semibold text-lg text-slate-700">ยินดีต้อนรับสู่ระบบแชท</p>
              <p className="text-sm mt-1.5">เลือกโครงงานหรือห้องเรียนจากเมนูด้านซ้ายเพื่อเริ่มสนทนา</p>
            </div>
          )}
        </main>

        {/* ================= PANEL ขวา: รายละเอียด ================= */}
        <aside className={`absolute right-0 xl:relative w-72 sm:w-80 xl:w-96 h-full bg-white border-l border-slate-200 z-50 transform transition-transform duration-300 ${showDetail ? 'translate-x-0 shadow-2xl' : 'translate-x-full xl:translate-x-0'} flex flex-col`}>
          <div className="h-[72px] px-5 border-b border-slate-200 flex justify-between items-center bg-white shrink-0">
            <h2 className="text-lg font-bold text-slate-800">รายละเอียดกลุ่ม</h2>
            <button onClick={() => setShowDetail(false)} className="xl:hidden p-2 text-slate-400 hover:bg-slate-100 rounded-full">
              <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          {activeRoom ? (
             <div className="flex-1 overflow-y-auto pb-8 flex flex-col items-center custom-scrollbar w-full">
               {/* Avatar Group */}
               <div className="mt-8 mb-3 relative">
                 <div className={`w-[72px] h-[72px] rounded-full flex items-center justify-center font-bold text-3xl shadow-sm border border-slate-200 shrink-0 ${activeRoom.chat_type === 'classroom' ? 'bg-sky-100 text-sky-600' : 'bg-blue-100 text-blue-600'}`}>
                   {activeRoom.chat_type === 'classroom' ? 'C' : (activeRoom.title?.charAt(0) || "P")}
                 </div>
                 {/* Online indicator dot */}
                 <div className="absolute bottom-0 right-0 w-[15px] h-[15px] bg-[#31A24C] border-[2.5px] border-white rounded-full"></div>
               </div>
               
               <h3 className="text-[17px] font-extrabold text-slate-800 text-center leading-snug px-4">
                 {activeRoom.title}
               </h3>
               <span className="text-[12.5px] text-slate-500 mt-0.5 mb-5 font-medium">
                 กำลังใช้งาน
               </span>
               
               {/* Action Buttons */}
               <div className="flex items-start justify-center gap-5 mb-5 w-full">
                 <button onClick={() => navigate(activeRoom.chat_type === 'classroom' ? `/classroom/${activeRoom.display_id}` : `/project?id=${activeRoom.display_id}`)} className="flex flex-col items-center gap-1.5 group">
                   <div className="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-slate-200 text-slate-800 flex items-center justify-center transition-colors shrink-0">
                     <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M4 13h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1zm-1 7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v4zm10 0a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v7zm1-10h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1z"></path></svg>
                   </div>
                   <span className="text-[11px] font-semibold text-slate-600">แดชบอร์ด</span>
                 </button>

                 <button onClick={() => setIsSearchActive(!isSearchActive)} className="flex flex-col items-center gap-1.5 group">
                   <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-colors ${isSearchActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 group-hover:bg-slate-200 text-slate-800'}`}>
                     <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M10 18a7.952 7.952 0 0 0 4.897-1.688l4.396 4.396 1.414-1.414-4.396-4.396A7.952 7.952 0 0 0 18 10c0-4.411-3.589-8-8-8s-8 3.589-8 8 3.589 8 8 8zm0-14c3.309 0 6 2.691 6 6s-2.691 6-6 6-6-2.691-6-6 2.691-6 6-6z"></path></svg>
                   </div>
                   <span className="text-[11px] font-semibold text-slate-600">ค้นหา</span>
                 </button>
               </div>

               {/* Accordions */}
               <div className="w-full mt-2">
                  
                  {/* ข้อมูลแชท / รายละเอียด */}
                  <details className="group [&_summary::-webkit-details-marker]:hidden" open>
                    <summary className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors cursor-pointer list-none select-none">
                      <span className="font-semibold text-[14px] text-slate-700">
                        {activeRoom.chat_type === 'classroom' ? 'รายละเอียดห้องเรียน' : 'ข้อมูลโครงงาน'}
                      </span>
                      <svg className="w-4 h-4 text-slate-400 transform transition-transform group-open:rotate-180 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"></path></svg>
                    </summary>
                    <div className="px-3 pb-3 space-y-2 mt-1">
                      {activeRoom.chat_type === 'classroom' ? (
                        <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 space-y-2 text-left">
                          {projectDetails?.room_code && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 font-medium">รหัสห้องเรียน:</span>
                              <span className="font-bold text-slate-700 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">{projectDetails.room_code}</span>
                            </div>
                          )}
                          {(projectDetails?.semester || projectDetails?.academic_year) && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-slate-400 font-medium">ภาคเรียน/ปีการศึกษา:</span>
                              <span className="font-bold text-slate-700">{projectDetails.semester || '-'}/{projectDetails.academic_year || '-'}</span>
                            </div>
                          )}
                          <div className="text-xs text-slate-600 pt-1 border-t border-slate-200/60 leading-relaxed">
                            <span className="text-slate-400 block mb-0.5 font-medium">คำอธิบาย:</span>
                            {projectDetails?.description || "ห้องสนทนาหลักสำหรับรายวิชา"}
                          </div>
                          <button 
                            onClick={() => navigate(`/classroom/${activeRoom.display_id}`)}
                            className="w-full mt-2 flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-sky-50 text-sky-600 text-xs font-bold rounded-lg border border-sky-200 transition-colors shadow-2xs"
                          >
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                            <span>ไปยังหน้าห้องเรียน</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <button 
                            onClick={() => setIsProjectInfoModalOpen(true)} 
                            className="w-full flex items-center gap-3 p-2.5 bg-blue-50/50 hover:bg-blue-100/60 text-blue-700 rounded-xl transition-colors border border-blue-100 font-semibold text-xs"
                          >
                            <svg className="w-4 h-4 text-blue-600 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.486 2 2 6.486 2 12s4.486 10 10 10 10-4.486 10-10S17.514 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"></path></svg>
                            <span>ดูข้อมูลโปรเจกต์แบบเต็ม</span>
                          </button>
                          {projectDetails?.description && (
                            <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-100 text-left text-xs text-slate-600 leading-relaxed">
                              <span className="text-slate-400 block mb-0.5 font-medium">รายละเอียด:</span>
                              <div className="line-clamp-3 text-slate-700 font-medium" dangerouslySetInnerHTML={{ __html: projectDetails.description }} />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </details>
                  
                  {/* สมาชิกในแชท */}
                  <details className="group [&_summary::-webkit-details-marker]:hidden" open>
                    <summary className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors cursor-pointer list-none select-none">
                      <span className="font-semibold text-[14px] text-slate-700">สมาชิกในแชท</span>
                      <svg className="w-4 h-4 text-slate-400 transform transition-transform group-open:rotate-180 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"></path></svg>
                    </summary>
                    <div className="px-4 pb-2 space-y-1 mt-1">
                      {roomMembers.advisor ? (
                        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                          <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0 font-bold text-slate-600">
                            {roomMembers.advisor.profile_image ? (
                              <img src={roomMembers.advisor.profile_image} className="w-full h-full object-cover" alt="Advisor" />
                            ) : (roomMembers.advisor.first_name?.charAt(0))}
                          </div>
                          <div className="overflow-hidden flex-1 text-left">
                            <p className="text-[14px] font-semibold text-slate-800 truncate">{roomMembers.advisor.first_name} {roomMembers.advisor.last_name}</p>
                            <p className="text-[12px] text-slate-500 font-medium">{activeRoom.chat_type === 'classroom' ? 'อาจารย์ประจำวิชา' : 'ที่ปรึกษาหลัก'}</p>
                          </div>
                        </div>
                      ) : null}

                      {roomMembers.coAdvisor ? (
                        <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                          <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0 font-bold text-slate-600">
                            {roomMembers.coAdvisor.profile_image ? (
                              <img src={roomMembers.coAdvisor.profile_image} className="w-full h-full object-cover" alt="CoAdvisor" />
                            ) : (roomMembers.coAdvisor.first_name?.charAt(0))}
                          </div>
                          <div className="overflow-hidden flex-1 text-left">
                            <p className="text-[14px] font-semibold text-slate-800 truncate">{roomMembers.coAdvisor.first_name} {roomMembers.coAdvisor.last_name}</p>
                            <p className="text-[12px] text-slate-500 font-medium">ที่ปรึกษาร่วม</p>
                          </div>
                        </div>
                      ) : null}

                      {roomMembers.students.map((std, i) => (
                        <div key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                          <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden shrink-0 font-bold text-slate-600">
                            {std.profile_image ? (
                              <img src={std.profile_image} className="w-full h-full object-cover" alt="Student" />
                            ) : (std.first_name?.charAt(0))}
                          </div>
                          <div className="overflow-hidden flex-1 text-left">
                            <p className="text-[14px] font-semibold text-slate-800 truncate">{std.first_name} {std.last_name}</p>
                            <p className="text-[12px] text-slate-500 font-medium">
                              {activeRoom.chat_type === 'classroom' ? 'นักศึกษา' : (std.project_role === 'leader' ? 'หัวหน้า (Leader)' : 'สมาชิก')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>

                  {/* ลิงก์ */}
                  <details className="group [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex items-center justify-between p-3.5 hover:bg-slate-50 transition-colors cursor-pointer list-none select-none">
                      <span className="font-semibold text-[14px] text-slate-700">ลิงก์</span>
                      <svg className="w-4 h-4 text-slate-400 transform transition-transform group-open:rotate-180 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"></path></svg>
                    </summary>
                    <div className="px-3 pb-2 space-y-0.5 mt-1">
                      <button onClick={() => setActiveAttachmentTab('link')} className="w-full flex items-center gap-3.5 p-2 hover:bg-slate-50 rounded-xl transition-colors">
                        <svg className="w-5 h-5 text-slate-600 ml-1 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M8.465 11.293c1.133-1.133 3.109-1.133 4.242 0l.707.707 1.414-1.414-.707-.707c-1.91-1.911-5.161-1.911-7.071 0l-2.829 2.828c-1.91 1.911-1.91 5.161 0 7.071l2.829 2.828c1.91 1.911 5.161 1.911 7.071 0l1.414-1.414-1.414-1.414-1.414 1.414c-1.133 1.133-3.109 1.133-4.242 0l-2.829-2.828c-1.133-1.133-1.133-3.109 0-4.242l2.829-2.828z"></path><path d="M15.535 12.707c-1.133 1.133-3.109 1.133-4.242 0l-.707-.707-1.414 1.414.707.707c1.91 1.911 5.161 1.911 7.071 0l2.829-2.828c1.91-1.911 1.91-5.161 0-7.071l-2.829-2.828c-1.91-1.911-5.161-1.911-7.071 0l-1.414 1.414 1.414 1.414 1.414-1.414c1.133-1.133 3.109-1.133 4.242 0l2.829 2.828c1.133 1.133 1.133 3.109 0 4.242l-2.829 2.828z"></path></svg>
                        <span className="text-[14px] font-semibold text-slate-700">ลิงก์</span>
                      </button>
                    </div>
                  </details>
               </div>
             </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-6 text-center text-slate-400 text-sm">
                โปรดเลือกห้องแชทเพื่อดูข้อมูล
            </div>
          )}
        </aside>

      </div>

      {/* ================= MODAL ข้อมูลโปรเจกต์แบบเต็ม (ตามแบบภาพ) ================= */}
      {isProjectInfoModalOpen && activeRoom && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsProjectInfoModalOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div className="bg-white px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
              <div className="flex-1 min-w-0 w-full">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md w-fit uppercase tracking-wide">หัวข้อโครงงาน</div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 leading-tight break-words whitespace-normal">{activeRoom.title}</h3>
              </div>
              <button onClick={() => setIsProjectInfoModalOpen(false)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 bg-slate-50 hover:bg-rose-50 rounded-full transition-colors border border-slate-100 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-4 md:p-5 overflow-y-auto flex flex-col lg:flex-row gap-4 bg-slate-50/50 custom-scrollbar">
              
              {/* ซ้าย: ข้อมูลโปรเจกต์ */}
              <div className="flex-[3] space-y-4">
                
                {/* คู่สนทนา & สถานะ */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 border-2 border-white shadow-sm overflow-hidden shrink-0 flex items-center justify-center font-bold text-slate-400 text-lg">
                      {(() => {
                        const p = currentUser?.role?.toUpperCase() === 'STUDENT' ? roomMembers.advisor : roomMembers.students?.[0];
                        return p?.profile_image ? <img src={p.profile_image} className="w-full h-full object-cover" alt="" /> : (p?.first_name?.charAt(0) || "U");
                      })()}
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold text-slate-400 mb-0.5 uppercase tracking-wider">คู่สนทนา / ผู้เกี่ยวข้อง</p>
                      <p className="text-sm font-bold text-slate-800">
                        {(() => {
                          const p = currentUser?.role?.toUpperCase() === 'STUDENT' ? roomMembers.advisor : roomMembers.students?.[0];
                          return p ? `${p.first_name} ${p.last_name}` : "ไม่ระบุ";
                        })()}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-slate-500 font-medium bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                          {currentUser?.role?.toUpperCase() === 'STUDENT' ? 'อาจารย์' : 'นักศึกษา'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-left sm:text-right border-t sm:border-t-0 sm:border-l border-slate-100 pt-2 sm:pt-0 sm:pl-4">
                    <p className="text-[11px] font-semibold text-slate-400 mb-1 uppercase tracking-wider">สถานะ</p>
                    <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      อนุมัติแล้ว
                    </span>
                  </div>
                </div>

                {/* ขอบเขต */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm col-span-1 md:col-span-2">
                  <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                    <div className="p-1 bg-indigo-50 text-indigo-600 rounded-md shrink-0">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                    </div>
                    ขอบเขตโปรเจกต์
                  </div>
                  <div className="text-[13px] text-slate-700 font-medium relative">
                    <ProjectScopeViewer scopeString={projectDetails?.project_scope} />
                  </div>
                </div>

                {/* ภาษา/เครื่องมือ */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                      <div className="p-1 bg-sky-50 text-sky-600 rounded-md shrink-0">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                      </div>
                      ภาษา / เครื่องมือที่ใช้
                    </div>
                    <div className="text-[13px] font-bold text-slate-800 break-words leading-relaxed">
                      {projectDetails?.language_used || <span className="text-slate-400 italic font-medium">ไม่ได้ระบุ</span>}
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-center">
                    <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                      <div className="p-1 bg-emerald-50 text-emerald-600 rounded-md shrink-0">
                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>
                      </div>
                      เอกสารอ้างอิง / ลิงก์แนบ
                    </div>
                    <div className="text-[13px] font-bold break-all">
                      {(projectDetails?.diagram_url || projectDetails?.file_url || projectDetails?.document_url || projectDetails?.proposal_url || projectDetails?.drive_link) ? (
                        <a href={projectDetails?.diagram_url || projectDetails?.file_url || projectDetails?.document_url || projectDetails?.proposal_url || projectDetails?.drive_link} target="_blank" rel="noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline flex items-start gap-1.5 bg-blue-50/50 p-2 rounded-lg border border-blue-100 transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0 mt-0.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
                          <span>คลิกเปิดลิงก์</span>
                        </a>
                      ) : <span className="text-slate-400 font-medium italic">- ไม่มีเอกสารแนบ -</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* ขวา: รายละเอียดเพิ่มเติม & ทีม */}
              <div className="flex-[2] flex flex-col gap-4">
                
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col flex-1 min-h-[120px]">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5 shrink-0">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    รายละเอียดเพิ่มเติม
                  </div>
                  <div className={`text-[13px] text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 flex-1 overflow-y-auto custom-scrollbar ${!projectDetails?.description ? 'flex items-center justify-center text-center' : 'whitespace-pre-wrap break-words leading-relaxed'}`}>
                    {projectDetails?.description ? (
                      <span dangerouslySetInnerHTML={{ __html: projectDetails.description }} />
                    ) : (
                      <span className="text-slate-400 italic font-medium">ไม่มีรายละเอียดเพิ่มเติม</span>
                    )}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="text-xs font-bold text-slate-400 mb-3 flex items-center gap-1.5">
                    <div className="p-1 bg-violet-50 text-violet-600 rounded-md shrink-0">
                      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                    </div>
                    สมาชิกในทีม
                  </div>
                  <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                    {roomMembers.students.length > 0 ? roomMembers.students.map((std, index) => (
                      <div key={index} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {std.profile_image ? (
                            <img src={std.profile_image} alt="" className="w-8 h-8 rounded-full object-cover shrink-0 border border-slate-200" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 shrink-0 border border-slate-300 font-bold text-xs">
                              {std.first_name?.charAt(0)}
                            </div>
                          )}
                          <div className="truncate">
                            <div className="text-xs font-bold text-slate-700 truncate">{std.first_name} {std.last_name}</div>
                            <div className="text-[10px] text-slate-500 font-medium truncate">{std.project_role === 'leader' ? 'หัวหน้าทีม' : 'สมาชิก'}</div>
                          </div>
                        </div>
                        {std.project_role === 'leader' && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap border bg-amber-50 text-amber-600 border-amber-200 ml-2 shrink-0">Leader</span>
                        )}
                      </div>
                    )) : (
                      <div className="text-center py-4 text-slate-400 text-xs font-medium italic border-2 border-dashed border-slate-200 rounded-lg">
                        ไม่มีข้อมูลสมาชิก
                      </div>
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Attachment Modal (แสดงเฉพาะลิงก์) */}
      {activeAttachmentTab && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setActiveAttachmentTab(null)}>
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-slate-100" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100 shadow-xs">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8.465 11.293c1.133-1.133 3.109-1.133 4.242 0l.707.707 1.414-1.414-.707-.707c-1.91-1.911-5.161-1.911-7.071 0l-2.829 2.828c-1.91 1.911-1.91 5.161 0 7.071l2.829 2.828c1.91 1.911 5.161 1.911 7.071 0l1.414-1.414-1.414-1.414-1.414 1.414c-1.133 1.133-3.109 1.133-4.242 0l-2.829-2.828c-1.133-1.133-1.133-3.109 0-4.242l2.829-2.828z"></path><path d="M15.535 12.707c-1.133 1.133-3.109 1.133-4.242 0l-.707-.707-1.414 1.414.707.707c1.91 1.911 5.161 1.911 7.071 0l2.829-2.828c1.91-1.911 1.91-5.161 0-7.071l-2.829-2.828c-1.91-1.911-5.161-1.911-7.071 0l-1.414 1.414 1.414 1.414 1.414-1.414c1.133-1.133 3.109-1.133 4.242 0l2.829 2.828c1.133 1.133 1.133 3.109 0 4.242l-2.829 2.828z"></path></svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 tracking-tight">ลิงก์ในห้องแชท</h3>
                  <p className="text-xs text-slate-400 font-medium">รายการลิงก์และเว็บไซต์ที่แชร์ในบทสนทนานี้</p>
                </div>
              </div>
              <button onClick={() => setActiveAttachmentTab(null)} className="p-2.5 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700 rounded-full transition-colors">
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {/* Content */}
            <div className="p-5 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/40">
              {(() => {
                const linkMessages = messages.filter(m => m.content && /(https?:\/\/[^\s]+)/g.test(m.content));

                if (linkMessages.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                      <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-3">
                        <svg className="w-7 h-7 text-slate-400" fill="currentColor" viewBox="0 0 24 24"><path d="M8.465 11.293c1.133-1.133 3.109-1.133 4.242 0l.707.707 1.414-1.414-.707-.707c-1.91-1.911-5.161-1.911-7.071 0l-2.829 2.828c-1.91 1.911-1.91 5.161 0 7.071l2.829 2.828c1.91 1.911 5.161 1.911 7.071 0l1.414-1.414-1.414-1.414-1.414 1.414c-1.133 1.133-3.109 1.133-4.242 0l-2.829-2.828c-1.133-1.133-1.133-3.109 0-4.242l2.829-2.828z"></path><path d="M15.535 12.707c-1.133 1.133-3.109 1.133-4.242 0l-.707-.707-1.414 1.414.707.707c1.91 1.911 5.161 1.911 7.071 0l2.829-2.828c1.91-1.911 1.91-5.161 0-7.071l-2.829-2.828c-1.91-1.911-5.161-1.911-7.071 0l-1.414 1.414 1.414 1.414 1.414-1.414c1.133-1.133 3.109-1.133 4.242 0l2.829 2.828c1.133 1.133 1.133 3.109 0 4.242l-2.829 2.828z"></path></svg>
                      </div>
                      <p className="text-sm font-bold text-slate-700">ไม่พบลิงก์ในห้องแชทนี้</p>
                      <p className="text-xs text-slate-400 mt-1">ลิงก์ที่ถูกส่งในข้อความจะถูกรวบรวมไว้ที่นี่</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {linkMessages.map(m => {
                      const urls = m.content.match(/(https?:\/\/[^\s]+)/g) || [];
                      const isMe = m.sender_id === currentUser?.email || m.sender_id === currentUser?.auth_id;
                      const senderName = isMe ? "คุณ" : `${m.users?.first_name || ""} ${m.users?.last_name || ""}`.trim();
                      return urls.map((url, i) => (
                        <div 
                          key={`${m.message_id}-${i}`} 
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200/80 rounded-2xl hover:border-indigo-300 hover:shadow-md transition-all group shadow-xs"
                        >
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0 mt-0.5 border border-indigo-100/60">
                              <svg className="w-5 h-5 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M8.465 11.293c1.133-1.133 3.109-1.133 4.242 0l.707.707 1.414-1.414-.707-.707c-1.91-1.911-5.161-1.911-7.071 0l-2.829 2.828c-1.91 1.911-1.91 5.161 0 7.071l2.829 2.828c1.91 1.911 5.161 1.911 7.071 0l1.414-1.414-1.414-1.414-1.414 1.414c-1.133 1.133-3.109 1.133-4.242 0l-2.829-2.828c-1.133-1.133-1.133-3.109 0-4.242l2.829-2.828z"></path><path d="M15.535 12.707c-1.133 1.133-3.109 1.133-4.242 0l-.707-.707-1.414 1.414.707.707c1.91 1.911 5.161 1.911 7.071 0l2.829-2.828c1.91-1.911 1.91-5.161 0-7.071l-2.829-2.828c-1.91-1.911-5.161-1.911-7.071 0l-1.414 1.414 1.414 1.414 1.414-1.414c1.133-1.133 3.109-1.133 4.242 0l2.829 2.828c1.133 1.133 1.133 3.109 0 4.242l-2.829 2.828z"></path></svg>
                            </div>
                            <div className="min-w-0 flex-1">
                              <a 
                                href={url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-[13.5px] font-semibold text-indigo-600 hover:text-indigo-800 break-all leading-snug hover:underline block"
                              >
                                {url}
                              </a>
                              <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                <span className={`font-semibold ${isMe ? 'text-indigo-600' : 'text-slate-600'}`}>{senderName}</span>
                                <span>•</span>
                                <span>{formatMessageTime(m.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          
                          <a 
                            href={url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-50 group-hover:bg-indigo-50 text-slate-600 group-hover:text-indigo-600 text-xs font-bold rounded-xl border border-slate-200 group-hover:border-indigo-200 transition-all shrink-0 self-end sm:self-center shadow-2xs"
                          >
                            <span>เปิดลิงก์</span>
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </a>
                        </div>
                      ));
                    })}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Lightbox Viewer */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col backdrop-blur-md">
          {/* Top Bar */}
          <div className="flex justify-between items-center p-4 text-white/80 bg-gradient-to-b from-black/60 to-transparent">
             <div className="text-sm font-medium tracking-wide">
               {lightboxImages.length > 0 ? `รูปภาพที่ ${lightboxIndex + 1} จาก ${lightboxImages.length}` : 'รูปภาพ'}
             </div>
             <div className="flex gap-4">
                <a 
                  href={lightboxImages[lightboxIndex]} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  download 
                  className="p-2 hover:text-white hover:bg-white/10 rounded-full transition-colors" 
                  title="เปิดรูปภาพในแท็บใหม่ / ดาวน์โหลด"
                >
                  <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </a>
                <button 
                  onClick={() => setLightboxOpen(false)} 
                  className="p-2 hover:text-white hover:bg-white/10 rounded-full transition-colors" 
                  title="ปิด"
                >
                  <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
             </div>
          </div>
          
          {/* Main Image */}
          <div className="flex-1 relative flex items-center justify-center p-4 min-h-0">
            {lightboxImages.length > 1 && (
              <button 
                onClick={() => setLightboxIndex(prev => prev > 0 ? prev - 1 : lightboxImages.length - 1)} 
                className="absolute left-2 sm:left-6 p-2 sm:p-3 rounded-full bg-black/50 text-white/70 hover:bg-black/80 hover:text-white hover:scale-110 transition-all backdrop-blur z-10"
              >
                 <svg className="w-5 h-5 sm:w-7 sm:h-7 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
              </button>
            )}
            
            <img 
              src={lightboxImages[lightboxIndex]} 
              alt="fullscreen view" 
              className="max-w-full max-h-full object-contain drop-shadow-2xl transition-transform duration-300 select-none" 
              draggable={false}
            />
            
            {lightboxImages.length > 1 && (
              <button 
                onClick={() => setLightboxIndex(prev => prev < lightboxImages.length - 1 ? prev + 1 : 0)} 
                className="absolute right-2 sm:right-6 p-2 sm:p-3 rounded-full bg-black/50 text-white/70 hover:bg-black/80 hover:text-white hover:scale-110 transition-all backdrop-blur z-10"
              >
                 <svg className="w-5 h-5 sm:w-7 sm:h-7 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" /></svg>
              </button>
            )}
          </div>
          
          {/* Thumbnails */}
          {lightboxImages.length > 1 && (
             <div className="h-28 bg-gradient-to-t from-black/80 to-transparent p-4 flex justify-center gap-3 overflow-x-auto custom-scrollbar shrink-0">
               {lightboxImages.map((img, idx) => (
                 <button 
                   key={idx} 
                   onClick={() => setLightboxIndex(idx)}
                   className={`shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all duration-200 ${idx === lightboxIndex ? 'border-blue-400 opacity-100 scale-110 shadow-[0_0_15px_rgba(96,165,250,0.5)]' : 'border-transparent opacity-40 hover:opacity-80'}`}
                 >
                   <img src={img} alt={`thumb ${idx}`} className="w-full h-full object-cover pointer-events-none" />
                 </button>
               ))}
             </div>
          )}
        </div>
      )}
    </div>
  );
}