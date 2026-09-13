// ===============================================
// src/pages/AdminDashboard.jsx
// ===============================================
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Swal from "sweetalert2";

import Header from "../components/Header";
import { deleteStorageFile } from "../lib/storageUtils";

// ข้อมูลคณะและสาขาสำหรับการสร้าง Dropdown
const rmutiData = {
  "คณะวิศวกรรมศาสตร์และเทคโนโลยี": [
    "วิศวกรรมคอมพิวเตอร์", "วิศวกรรมคอมพิวเตอร์และระบบอัจฉริยะ", "วิศวกรรมโยธา", "วิศวกรรมไฟฟ้า", 
    "วิศวกรรมเครื่องกล", "วิศวกรรมอุตสาหการ", "วิศวกรรมอิเล็กทรอนิกส์", "วิศวกรรมโทรคมนาคม", 
    "วิศวกรรมเมคคาทรอนิกส์", "วิศวกรรมระบบราง", "เทคโนโลยีอุตสาหการ", "วิศวกรรมวัสดุและโลหการ"
  ],
  "คณะบริหารธุรกิจ": [
    "ระบบสารสนเทศ (IS)", "การบัญชี", "การตลาด", "การจัดการ", "การเงิน", 
    "การจัดการโลจิสติกส์และโซ่อุปทาน", "การจัดการธุรกิจการบิน", "เศรษฐศาสตร์ธุรกิจ", "ธุรกิจระหว่างประเทศ"
  ],
  "คณะวิทยาศาสตร์และศิลปศาสตร์": [
    "นวัตกรรมและเทคโนโลยีการเกษตร", "เทคโนโลยีอาหาร", "ฟิสิกส์ประยุกต์", "เคมีประยุกต์", "ภาษาอังกฤษเพื่อการสื่อสาร"
  ],
  "คณะสถาปัตยกรรมศาสตร์และศิลปกรรมสร้างสรรค์": [
    "สถาปัตยกรรม", "สถาปัตยกรรมภายใน", "ออกแบบนิเทศศิลป์", "ออกแบบอุตสาหกรรม", "ศิลปกรรม"
  ],
  "สถาบันสหสรรพศาสตร์": [
    "เทคโนโลยีการเกษตรและสิ่งแวดล้อม"
  ]
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  
  const [allUsers, setAllUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  
  const [activeTab, setActiveTab] = useState("pending"); 
  const [stats, setStats] = useState({ student: 0, advisor: 0, admin: 0, total: 0 });

  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // เช็คสิทธิ์ว่าเป็น Admin หรือ อาจารย์ในสาขา
  const isAdmin = user?.role === "ADMIN";
  const isBranchAdvisor = user?.role === "ADVISOR" && user?.advisor_type?.trim() === "อาจารย์ในสาขา";

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterRole, activeTab]);

  // ==========================================
  // 1. ระบบรักษาความปลอดภัย: ตรวจสอบ Admin / อาจารย์ในสาขา
  // ==========================================
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/");
        return;
      }
      
      const { data: profile } = await supabase
        .from("users")
        .select("*")
        .eq("email", session.user.email)
        .maybeSingle();

      const userIsAdmin = profile?.role === "ADMIN";
      const userIsBranchAdvisor = profile?.role === "ADVISOR" && profile?.advisor_type?.trim() === "อาจารย์ในสาขา";

      // ถ้าไม่ใช่ ADMIN และ ไม่ใช่อาจารย์ในสาขา ให้เด้งออกทันที
      if (!profile || (!userIsAdmin && !userIsBranchAdvisor)) {
        Swal.fire({
          icon: "error",
          title: "สิทธิ์ไม่เพียงพอ",
          text: "หน้านี้สำหรับแอดมินและอาจารย์ประจำสาขาเท่านั้น",
          confirmButtonColor: "#ef4444"
        });
        navigate("/dashboard");
        return;
      }

      setUser(profile);
    };
    init();
  }, [navigate]);

  const logActivity = async (action, details) => {
    if (!user) return;
    try {
      await supabase.from("activity_logs").insert([
        { admin_email: user.email, action: action, details: details }
      ]);
    } catch (err) {
      console.error("Failed to log activity:", err);
    }
  };

  // ==========================================
  // 2. ดึงข้อมูล & เช็คแจ้งเตือนจาก Log
  // ==========================================
  const fetchAllData = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      // 🌟 ดึงข้อมูลทั้งหมดมาก่อน เพื่อไม่ให้บล็อกคนละคณะ/สาขาตั้งแต่แรก
      const { data: userData, error: userError } = await supabase.from("users").select("*");
      if (userError) throw userError;

      const users = [];
      const pendingList = [];
      let studentCount = 0, advisorCount = 0, adminCount = 0;

      (userData || []).forEach((u) => {
        // ป้องกัน Error ตัวพิมพ์เล็ก/ใหญ่
        const currentRole = u.role?.toUpperCase();
        const requestedRole = u.requested_role?.toUpperCase();

        // เช็คสถานะรออนุมัติ: บัญชียังไม่รับเข้า หรือ ขออัปเกรดเป็นอาจารย์
        const isPendingNewUser = u.is_accepted === false;
        const isRoleUpgradePending = currentRole === "STUDENT" && requestedRole === "ADVISOR";
        const isNotRejected = requestedRole !== "REJECTED";
        const isPending = (isPendingNewUser || isRoleUpgradePending) && isNotRejected;

        // 🌟 กรองสิทธิ์การมองเห็นสำหรับ "แอดมิน" และ "อาจารย์ในสาขา"
        let canView = false;

        if (user?.role === "ADMIN") {
          canView = true; // แอดมินกลาง เห็นทุกคน
        } else if (user?.role === "ADVISOR" && user?.advisor_type?.trim() === "อาจารย์ในสาขา") {
          // ถ้าคำขอเป็น "อาจารย์" (ADVISOR) หรือเป็นอาจารย์อยู่แล้ว -> ให้อาจารย์สาขาเห็นทุกคน (จะได้รับคนนอกสาขา/ภายนอกได้)
          if (requestedRole === "ADVISOR" || currentRole === "ADVISOR") {
            canView = true;
          } 
          // ถ้าเป็น "นักศึกษา" -> ให้เห็นเฉพาะนักศึกษาในสาขา/คณะตัวเองเท่านั้น
          else if (u.faculty === user.faculty && u.major === user.major) {
            canView = true;
          }
        }

        // หากผ่านเงื่อนไขการมองเห็น ให้นำมานับและแสดงผล
        if (canView) {
          if (currentRole === "STUDENT") studentCount++;
          else if (currentRole === "ADVISOR") advisorCount++;
          else if (currentRole === "ADMIN") adminCount++;

          if (isPending) pendingList.push(u);
          users.push(u);
        }
      });

      setStats({ student: studentCount, advisor: advisorCount, admin: adminCount, total: users.length });
      setAllUsers(users);
      setPendingUsers(pendingList);

      // ดึงข้อมูล Activity Logs
      const { data: logsData, error: logsError } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200); 

      if (!logsError && logsData) {
        setActivityLogs(logsData);
        
        const recentDeletes = logsData.filter(log => 
          log.action === "DELETE_USER" && 
          (new Date() - new Date(log.created_at)) < 86400000
        );

        if (!isSilent && recentDeletes.length > 0 && user?.role === "ADMIN") {
          Swal.fire({
            toast: true,
            position: 'bottom-end',
            icon: 'warning',
            title: `คำเตือนความปลอดภัย!`,
            text: `มีการลบผู้ใช้งาน ${recentDeletes.length} รายการใน 24 ชั่วโมงที่ผ่านมา`,
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true,
          });
        }
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    if (user) fetchAllData();
  }, [user]);

  // ==========================================
  // Actions: Approve, Reject, Delete User
  // ==========================================
  const handleApprove = async (targetUser) => {
    const roleToApprove = targetUser.requested_role === "ADVISOR" ? "ADVISOR" : "STUDENT";
    const roleLabel = roleToApprove === "ADVISOR" ? "อาจารย์" : "นักศึกษา";

    const result = await Swal.fire({
      title: "ยืนยันการอนุมัติ?",
      text: `อนุมัติสิทธิ์${roleLabel}ให้ ${targetUser.first_name} ${targetUser.last_name}?`,
      icon: "warning",
      showCancelButton: true, reverseButtons: true,
      confirmButtonColor: "#10b981",
      confirmButtonText: "ใช่ อนุมัติ",
      cancelButtonText: "ยกเลิก",
    });

    if (result.isConfirmed) {
      try {
        Swal.fire({ title: 'กำลังดำเนินการ...', didOpen: () => Swal.showLoading() });

        const { data: updatedUser, error: updateError } = await supabase
          .from("users")
          .update({ role: roleToApprove, requested_role: roleToApprove, is_accepted: true })
          .eq("email", targetUser.email) 
          .select();

        if (updateError) throw updateError;
        if (!updatedUser || updatedUser.length === 0) throw new Error("ไม่อัปเดตข้อมูล: อาจติดสิทธิ์การเข้าถึง (RLS Policy)");

        if (roleToApprove === "ADVISOR") {
          const { data: existingProfile } = await supabase.from("advisor_profiles").select("user_id").eq("user_id", targetUser.auth_id).maybeSingle();
          if (!existingProfile) {
            await supabase.from("advisor_profiles").insert([{ 
              user_id: targetUser.auth_id,
              max_groups: 5,
              is_accepting_students: true
            }]);
          }
        } else {
          const { data: existingProfile } = await supabase.from("student_profiles").select("user_id").eq("user_id", targetUser.auth_id).maybeSingle();
          if (!existingProfile) {
            await supabase.from("student_profiles").insert([{ user_id: targetUser.auth_id }]);
          }
        }

        await logActivity(`APPROVE_${roleToApprove}`, `อนุมัติสิทธิ์${roleLabel}ให้ ${targetUser.email}`);

        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-approval-email', { 
          body: { 
            email: targetUser.email, 
            firstName: targetUser.first_name, 
            lastName: targetUser.last_name, 
            role: roleToApprove === 'ADVISOR' ? 'อาจารย์ (ADVISOR)' : 'นักศึกษา (STUDENT)',
            type: 'APPROVE'
          } 
        });

        const isEmailFailed = emailError || (emailData && emailData.error) || (emailData && emailData.statusCode >= 400);

        await fetchAllData(true);

        Swal.fire({
          icon: "success",
          title: "อนุมัติสำเร็จ!",
          html: `
            <div style="font-family: 'Kanit', sans-serif; text-align: center;">
              <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 12px 0;">
                <p style="font-size: 15px; color: #15803d; font-weight: 600; margin: 0 0 4px 0;">
                  ${targetUser.first_name} ${targetUser.last_name}
                </p>
                <p style="font-size: 13px; color: #166534; margin: 0;">${targetUser.email}</p>
              </div>
              <p style="color: #374151; font-size: 14px; margin-top: 12px;">
                ได้รับสิทธิ์ <span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:6px; font-weight:600;">${roleLabel}</span> เรียบร้อยแล้ว
              </p>
              ${isEmailFailed ? `<p style="color: #ef4444; font-size: 12px; margin-top: 8px;">* อนุมัติสำเร็จ แต่อาจเกิดปัญหาในการส่งอีเมลแจ้งเตือน</p>` : `<p style="color: #10b981; font-size: 12px; margin-top: 8px;">* ระบบได้ส่งอีเมลแจ้งเตือนผู้ใช้แล้ว</p>`}
            </div>
          `,
          confirmButtonColor: "#10b981",
          confirmButtonText: "รับทราบ",
        });

      } catch (error) {
        Swal.fire("เกิดข้อผิดพลาด!", error.message, "error");
      }
    }
  };

  const handleReject = async (targetUser) => {
    const roleToApprove = targetUser.requested_role === "ADVISOR" ? "ADVISOR" : "STUDENT";
    const roleLabel = roleToApprove === "ADVISOR" ? "อาจารย์" : "นักศึกษา";

    const { value: reason, isConfirmed } = await Swal.fire({
      title: `ปฏิเสธคำขอสิทธิ์${roleLabel}?`,
      html: `
        <div style="text-align: left; font-family: 'Kanit', sans-serif;">
          <p style="margin-bottom: 8px; font-size: 14px; color: #475569;">
            ระบบจะส่งอีเมลแจ้งเตือนและ <b>ลบบัญชีผู้ใช้นี้ออกจากระบบ</b> เพื่อให้ผู้ใช้สามารถนำอีเมลเดิมไปสมัครใหม่ด้วยข้อมูลที่ถูกต้องได้
          </p>
          <label style="font-size: 13px; font-weight: 600; color: #334155; display: block; margin-bottom: 4px;">
            ระบุเหตุผลการปฏิเสธ (จะแนบไปในอีเมล):
          </label>
        </div>
      `,
      input: 'text',
      inputPlaceholder: 'เช่น ข้อมูลคณะ/สาขาวิชาไม่ถูกต้อง หรือ เอกสารไม่ครบถ้วน',
      inputValue: `ไม่ผ่านการอนุมัติสิทธิ์${roleLabel}`,
      icon: "warning",
      showCancelButton: true, 
      reverseButtons: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "ปฏิเสธและลบบัญชี",
      cancelButtonText: "ยกเลิก",
      inputValidator: (value) => {
        if (!value || !value.trim()) {
          return 'กรุณาระบุเหตุผลการปฏิเสธ';
        }
      }
    });

    if (isConfirmed) {
      try {
        Swal.fire({ title: 'กำลังดำเนินการ...', didOpen: () => Swal.showLoading() });
        
        // 1. ส่งอีเมลแจ้งเตือนผู้ใช้พร้อมระบุเหตุผล
        const { data: emailData, error: emailError } = await supabase.functions.invoke('send-approval-email', { 
          body: { 
            email: targetUser.email, 
            firstName: targetUser.first_name, 
            lastName: targetUser.last_name, 
            role: roleToApprove === 'ADVISOR' ? 'อาจารย์ (ADVISOR)' : 'นักศึกษา (STUDENT)',
            type: 'REJECT',
            reason: reason ? reason.trim() : `ไม่ผ่านการอนุมัติสิทธิ์${roleLabel}`
          } 
        });

        const isEmailFailed = emailError || (emailData && emailData.error) || (emailData && emailData.statusCode >= 400);

        // 2. ลบข้อมูลผู้ใช้จากระบบแบบสมบูรณ์ (เพื่อให้สามารถนำอีเมลเดิมไปสมัครใหม่ได้)
        // 🧹 ลบรูป Avatar ออกจาก Storage
        if (targetUser.profile_image && targetUser.profile_image.includes('/avatars/')) {
          await deleteStorageFile('avatars', targetUser.profile_image);
        }

        const { error: rpcError } = await supabase.rpc('delete_user_completely', { 
          target_user_id: targetUser.auth_id 
        });

        // ลบจากตารางข้อมูลพื้นฐานเพิ่มเติมเพื่อความแน่ใจ
        if (rpcError) {
          console.warn("RPC Delete error, falling back to direct table delete:", rpcError);
        }
        await supabase.from("advisor_profiles").delete().eq("user_id", targetUser.auth_id);
        await supabase.from("student_profiles").delete().eq("user_id", targetUser.auth_id);
        await supabase.from("users").delete().eq("email", targetUser.email);

        await logActivity(`REJECT_${roleToApprove}`, `ปฏิเสธคำขอสิทธิ์${roleLabel} และลบบัญชี ${targetUser.email} เพื่อให้สมัครใหม่`);
        await fetchAllData(true);

        Swal.fire({
          icon: "success",
          title: "ปฏิเสธและลบบัญชีสำเร็จ",
          html: `
            <div style="font-family: 'Kanit', sans-serif; text-align: center;">
              <p>ปฏิเสธคำขอและลบบัญชีของ <b>${targetUser.first_name} ${targetUser.last_name}</b> เรียบร้อยแล้ว</p>
              <p style="color: #64748b; font-size: 13px; margin-top: 4px;">ผู้ใช้สามารถนำอีเมลเดิมไปลงทะเบียนสมัครสมาชิกใหม่ได้ทันที</p>
              ${isEmailFailed 
                ? `<p style="color: #ef4444; font-size: 12px; margin-top: 8px;">* ดำเนินการสำเร็จ แต่อาจเกิดปัญหาในการส่งอีเมลแจ้งเตือน</p>` 
                : `<p style="color: #10b981; font-size: 12px; margin-top: 8px;">* ระบบได้ส่งอีเมลแจ้งเหตุผลให้ผู้ใช้ทราบแล้ว</p>`}
            </div>
          `,
          confirmButtonColor: "#3b82f6",
        });

      } catch (error) {
        Swal.fire("เกิดข้อผิดพลาด!", error.message, "error");
      }
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (!isAdmin && !isBranchAdvisor) {
      return Swal.fire("สิทธิ์ไม่เพียงพอ", "การลบผู้ใช้งานสามารถทำได้เฉพาะผู้ดูแลระบบ (Admin) หรืออาจารย์ในสาขาเท่านั้น", "error");
    }

    if (targetUser.role === 'ADMIN' && !isAdmin) {
      return Swal.fire({
        icon: "warning",
        title: "ไม่มีสิทธิ์ลบ",
        text: "อาจารย์ไม่สามารถลบข้อมูลของผู้ดูแลระบบ (Admin) ได้",
        confirmButtonColor: "#f59e0b",
        confirmButtonText: "เข้าใจแล้ว",
        customClass: { popup: "rounded-2xl" }
      });
    }

    if (targetUser.email === user?.email) {
      return Swal.fire({
        icon: "warning",
        title: "ไม่สามารถลบบัญชีตัวเองได้",
        text: "คุณไม่สามารถลบบัญชีที่กำลังเข้าสู่ระบบอยู่ได้",
        confirmButtonColor: "#f59e0b",
        confirmButtonText: "เข้าใจแล้ว",
        customClass: { popup: "rounded-2xl" }
      });
    }

    const { value: confirmEmail } = await Swal.fire({
      title: 'ยืนยันการลบบัญชีผู้ใช้',
      html: `
        <div style="font-family: 'Kanit', sans-serif; text-align: center;">
          <p style="color: #475569; font-size: 14px; margin-bottom: 8px;">กรุณากรอกอีเมลของบัญชีเพื่อยืนยันการลบ:</p>
          <div style="background: #f1f5f9; padding: 8px 14px; border-radius: 10px; font-weight: 700; color: #0f172a; font-size: 15px; display: inline-block; margin-bottom: 12px; border: 1px solid #e2e8f0; user-select: all;">
            ${targetUser.email}
          </div>
          <p style="color: #ef4444; font-size: 12px; font-weight: 500;">⚠️ การกระทำนี้จะลบข้อมูลโปรไฟล์และบัญชีผู้ใช้งานอย่างถาวร ไม่สามารถกู้คืนได้</p>
        </div>
      `,
      input: 'text',
      inputPlaceholder: 'กรอกอีเมลเพื่อยืนยันการลบ...',
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonText: 'ยืนยันการลบ',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'ยกเลิก',
      cancelButtonColor: '#94a3b8',
      customClass: {
        popup: 'rounded-2xl shadow-2xl border border-slate-100',
        confirmButton: 'bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-xl px-4 py-2.5 shadow-sm',
        cancelButton: 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl px-4 py-2.5'
      },
      inputValidator: (value) => {
        if (!value || value.trim().toLowerCase() !== targetUser.email.trim().toLowerCase()) {
          return 'อีเมลไม่ตรงกัน กรุณากรอกอีเมลให้ถูกต้อง';
        }
      }
    });

    if (!confirmEmail) return; 
    Swal.fire({ title: 'กำลังลบข้อมูล...', didOpen: () => Swal.showLoading() });

    try {
      // 🧹 ลบรูป Avatar ออกจาก Storage
      if (targetUser.profile_image && targetUser.profile_image.includes('/avatars/')) {
        await deleteStorageFile('avatars', targetUser.profile_image);
      }

      const { error: rpcError } = await supabase.rpc('delete_user_completely', { 
        target_user_id: targetUser.auth_id 
      });

      if (rpcError) {
        console.warn("RPC Delete error, falling back to direct table delete:", rpcError);
        await supabase.from("advisor_profiles").delete().eq("user_id", targetUser.auth_id);
        await supabase.from("student_profiles").delete().eq("user_id", targetUser.auth_id);
        const { error: delError } = await supabase.from("users").delete().eq("email", targetUser.email);
        if (delError) throw delError;
      }

      await logActivity("DELETE_USER", `ลบผู้ใช้งาน ${targetUser.email} ถาวร`);
      Swal.fire({
        icon: "success",
        title: "ลบสำเร็จ!",
        text: "ลบข้อมูลและบัญชีล็อกอินเรียบร้อยแล้ว",
        confirmButtonColor: "#3b82f6",
      });
      fetchAllData(true);
    } catch (err) {
      console.error("Delete user error:", err);
      if (err.message?.includes('Foreign Key') || err.code === '23503') {
         Swal.fire("ลบไม่ได้!", "ผู้ใช้นี้มีโครงงาน หรือข้อมูลอื่นที่ผูกอยู่ กรุณาลบข้อมูลที่เกี่ยวข้องก่อน", "error");
      } else {
         Swal.fire("เกิดข้อผิดพลาด", err.message, "error");
      }
    }
  };

  // ==========================================
  // ฟังก์ชันดูข้อมูลผู้ใช้
  // ==========================================
  const handleViewUser = async (targetUser) => {
    try {
      Swal.fire({ title: 'กำลังโหลดข้อมูล...', didOpen: () => Swal.showLoading() });

      let profileHtml = '';

      if (targetUser.role === 'STUDENT' || targetUser.requested_role === 'STUDENT') {
        const { data } = await supabase.from('student_profiles').select('student_status').eq('user_id', targetUser.auth_id).maybeSingle();
        profileHtml = `
          <div class="mt-4 pt-4 border-t border-slate-200 text-sm text-left">
            <h4 class="font-bold text-slate-700 mb-2">ข้อมูลนักศึกษา</h4>
            <div class="grid grid-cols-2 gap-2">
              <p><span class="text-slate-500">คณะ:</span> ${targetUser.faculty || '-'}</p>
              <p><span class="text-slate-500">สาขา:</span> ${targetUser.major || '-'}</p>
              <p class="col-span-2"><span class="text-slate-500">ความเชี่ยวชาญ/สายที่ถนัด:</span> ${targetUser.expertise || '-'}</p>
              <p><span class="text-slate-500">สถานะ:</span> ${data?.student_status || '-'}</p>
            </div>
          </div>
        `;
      } else if (targetUser.role === 'ADVISOR' || targetUser.requested_role === 'ADVISOR') {
        const { data } = await supabase.from('advisor_profiles').select('is_accepting_students, max_groups').eq('user_id', targetUser.auth_id).maybeSingle();
        profileHtml = `
          <div class="mt-4 pt-4 border-t border-slate-200 text-sm text-left">
            <h4 class="font-bold text-slate-700 mb-2">ข้อมูลอาจารย์</h4>
            <div class="grid grid-cols-2 gap-2">
              <p><span class="text-slate-500">คณะ:</span> ${targetUser.faculty || '-'}</p>
              <p><span class="text-slate-500">สาขา:</span> ${targetUser.major || '-'}</p>
              <p class="col-span-2"><span class="text-slate-500">ความเชี่ยวชาญ/สายที่ถนัด:</span> ${targetUser.expertise || '-'}</p>
              <p><span class="text-slate-500">ประเภทอาจารย์:</span> ${targetUser.advisor_type || '-'}</p>
              <p><span class="text-slate-500">การรับนักศึกษา:</span> ${data?.is_accepting_students ? '<span class="text-green-600">รับนักศึกษา</span>' : '<span class="text-red-600">ไม่รับนักศึกษา</span>'}</p>
              <p><span class="text-slate-500">รับได้สูงสุด:</span> ${data?.max_groups || 0} กลุ่ม</p>
            </div>
          </div>
        `;
      }

      const roleBadge = targetUser.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : targetUser.role === 'ADVISOR' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700';
      const isAcceptedBadge = targetUser.is_accepted ? '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-xs">ยืนยันสิทธิ์แล้ว</span>' : '<span class="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-xs">รอการยืนยัน</span>';

      Swal.fire({
        title: 'ข้อมูลผู้ใช้งาน',
        width: '600px',
        html: `
          <div class="text-left mt-2" style="font-family: 'Kanit', sans-serif;">
            <div class="flex items-center gap-4 mb-4 bg-slate-50 p-4 rounded-xl">
              ${targetUser.profile_image 
                ? `<img src="${targetUser.profile_image}" class="w-16 h-16 rounded-full object-cover shadow-sm">` 
                : `<div class="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl font-bold shadow-sm">${targetUser.first_name?.[0] || '-'}</div>`
              }
              <div>
                <h3 class="text-lg font-bold text-slate-800">${targetUser.prefix || ''}${targetUser.first_name || ''} ${targetUser.last_name || ''}</h3>
                <p class="text-sm text-slate-500">${targetUser.email}</p>
                <div class="mt-1 flex gap-2">
                  <span class="px-2 py-0.5 ${roleBadge} rounded-md text-xs font-semibold">${targetUser.role}</span>
                  ${isAcceptedBadge}
                </div>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-y-3 gap-x-4 text-sm mt-4">
              <p><span class="text-slate-500 block text-xs">รหัสประจำตัว</span> <span class="font-medium">${targetUser.account_code || '-'}</span></p>
              <p><span class="text-slate-500 block text-xs">เบอร์โทรศัพท์</span> <span class="font-medium">${targetUser.phone || '-'}</span></p>
              <p class="col-span-2"><span class="text-slate-500 block text-xs">สิทธิ์ที่ร้องขอ (Requested)</span> <span class="font-medium">${targetUser.requested_role}</span></p>
              <div class="col-span-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span class="text-slate-500 block text-xs mb-1">Bio (แนะนำตัว)</span> 
                <span class="font-medium text-slate-700">${targetUser.bio || 'ยังไม่มีการเขียนแนะนำตัว'}</span>
              </div>
            </div>
            ${profileHtml}
          </div>
        `,
        confirmButtonText: 'ปิดหน้าต่าง',
        confirmButtonColor: '#64748b'
      });
    } catch (error) {
      Swal.fire('เกิดข้อผิดพลาด', 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้', 'error');
    }
  };

  // ==========================================
  // 3. ฟังก์ชันแก้ไขข้อมูลผู้ใช้ (อัปเดตลงตาราง users)
  // ==========================================
  const handleEditUser = async (targetUser) => {
    // 🔒 ป้องกัน: อาจารย์ไม่สามารถแก้ไขหรือเปลี่ยนแปลงข้อมูลของ Admin ได้
    if (targetUser.role === 'ADMIN' && !isAdmin) {
      return Swal.fire({
        icon: "warning",
        title: "ไม่มีสิทธิ์เข้าถึง",
        text: "อาจารย์ไม่สามารถแก้ไขหรือเปลี่ยนแปลงข้อมูลของผู้ดูแลระบบ (Admin) ได้",
        confirmButtonColor: "#f59e0b",
        confirmButtonText: "เข้าใจแล้ว",
        customClass: { popup: "rounded-2xl" }
      });
    }

    // 3.1 สร้างตัวเลือกสำหรับสาขา (Major)
    let majorOptionsHtml = '<option value="">-- เลือกสาขา --</option>';
    Object.keys(rmutiData).forEach(faculty => {
      majorOptionsHtml += `<optgroup label="${faculty}">`;
      rmutiData[faculty].forEach(major => {
        const isSelected = targetUser.major === major ? 'selected' : '';
        majorOptionsHtml += `<option value="${major}" ${isSelected}>${major}</option>`;
      });
      majorOptionsHtml += `</optgroup>`;
    });

    // 3.2 สร้างตัวเลือกสำหรับคำนำหน้า (Prefix) แยกตาม Role
    let prefixOptionsHtml = '<option value="">เลือก</option>';
    const isStudent = targetUser.role === 'STUDENT' || targetUser.requested_role === 'STUDENT';
    const prefixList = isStudent 
      ? ["ด.ช.", "ด.ญ.", "นาย", "นางสาว", "นาง"] 
      : ["นาย", "นางสาว", "นาง", "ดร.", "ผศ.", "รศ."];

    prefixList.forEach(prefix => {
      const isSelected = targetUser.prefix === prefix ? 'selected' : '';
      prefixOptionsHtml += `<option value="${prefix}" ${isSelected}>${prefix}</option>`;
    });

    const expertiseList = [
      "ฮาร์ดแวร์ (Hardware)",
      "ซอฟต์แวร์ (Software)",
      "ถนัดทั้ง 2 อย่าง (Hardware & Software)",
      "ปัญญาประดิษฐ์และข้อมูล (AI & Data)",
      "เครือข่ายและความปลอดภัย (Network & Security)",
      "อื่นๆ (โปรดระบุใน Bio)"
    ];
    let expertiseOptionsHtml = '';
    expertiseList.forEach(exp => {
      const isChecked = targetUser.expertise && targetUser.expertise.includes(exp) ? 'checked' : '';
      expertiseOptionsHtml += `
        <label class="flex items-start gap-2 cursor-pointer p-1.5 hover:bg-slate-50 rounded">
          <input type="checkbox" value="${exp}" class="swal-expertise-checkbox mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500" ${isChecked}>
          <span class="text-xs text-slate-700 select-none">${exp}</span>
        </label>
      `;
    });

    const canDeleteTarget = (isAdmin || isBranchAdvisor) && (isAdmin || targetUser.role !== 'ADMIN') && targetUser.email !== user?.email;

    const result = await Swal.fire({
      title: 'แก้ไขข้อมูลผู้ใช้งาน',
      width: '800px', 
      html: `
        <div class="text-left mt-4 px-2" style="font-family: 'Kanit', sans-serif;">
          <div class="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">คำนำหน้า</label>
              <select id="swal-prefix" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white">
                ${prefixOptionsHtml}
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">รหัสประจำตัว (Account Code)</label>
              <input id="swal-account-code" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none" value="${targetUser.account_code || ''}">
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">ชื่อจริง <span class="text-red-500">*</span></label>
              <input id="swal-fname" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none" value="${targetUser.first_name || ''}">
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">นามสกุล <span class="text-red-500">*</span></label>
              <input id="swal-lname" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none" value="${targetUser.last_name || ''}">
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">อีเมล (แก้ไม่ได้)</label>
              <input class="w-full border border-slate-200 bg-slate-100 text-slate-500 rounded-lg px-2.5 py-1.5 text-sm cursor-not-allowed" value="${targetUser.email}" disabled>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1">เบอร์โทรศัพท์</label>
              <input id="swal-phone" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none" value="${targetUser.phone || ''}">
            </div>
            
            <div class="col-span-2 grid grid-cols-2 gap-4 mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div class="col-span-2 text-slate-800 font-semibold text-sm mb-1">ข้อมูลวิชาการและความเชี่ยวชาญ</div>
              
              <div>
                <label class="block text-xs font-medium text-slate-700 mb-1">คณะ</label>
                <select id="swal-faculty" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white">
                  <option value="">-- เลือกคณะ --</option>
                  <option value="คณะวิศวกรรมศาสตร์และเทคโนโลยี" ${targetUser.faculty === 'คณะวิศวกรรมศาสตร์และเทคโนโลยี' ? 'selected' : ''}>คณะวิศวกรรมศาสตร์และเทคโนโลยี</option>
                  <option value="คณะบริหารธุรกิจ" ${targetUser.faculty === 'คณะบริหารธุรกิจ' ? 'selected' : ''}>คณะบริหารธุรกิจ</option>
                  <option value="คณะวิทยาศาสตร์และศิลปศาสตร์" ${targetUser.faculty === 'คณะวิทยาศาสตร์และศิลปศาสตร์' ? 'selected' : ''}>คณะวิทยาศาสตร์และศิลปศาสตร์</option>
                  <option value="คณะสถาปัตยกรรมศาสตร์และศิลปกรรมสร้างสรรค์" ${targetUser.faculty === 'คณะสถาปัตยกรรมศาสตร์และศิลปกรรมสร้างสรรค์' ? 'selected' : ''}>คณะสถาปัตยกรรมศาสตร์และศิลปกรรมสร้างสรรค์</option>
                  <option value="สถาบันสหสรรพศาสตร์" ${targetUser.faculty === 'สถาบันสหสรรพศาสตร์' ? 'selected' : ''}>สถาบันสหสรรพศาสตร์</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-medium text-slate-700 mb-1">สาขา</label>
                <select id="swal-major" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white">
                  ${majorOptionsHtml}
                </select>
              </div>

              <div class="col-span-2 relative">
                <label class="block text-xs font-medium text-slate-700 mb-1">ความเชี่ยวชาญ / สายที่ถนัด</label>
                <div id="swal-expertise-btn" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm bg-white cursor-pointer flex justify-between items-center transition-all hover:border-blue-400">
                  <span id="swal-expertise-text" class="text-slate-500 truncate mr-2 select-none pointer-events-none">-- เลือกความเชี่ยวชาญ --</span>
                  <svg className="shrink-0" class="w-4 h-4 text-slate-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                </div>
                <div id="swal-expertise-dropdown" class="hidden absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto p-1.5">
                  ${expertiseOptionsHtml}
                </div>
              </div>
            </div>

            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1 mt-2">สิทธิ์ปัจจุบัน (Role)</label>
              <select id="swal-role" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white">
                <option value="STUDENT" ${targetUser.role === 'STUDENT' ? 'selected' : ''}>นักศึกษา (STUDENT)</option>
                <option value="ADVISOR" ${targetUser.role === 'ADVISOR' ? 'selected' : ''}>อาจารย์ (ADVISOR)</option>
                ${isAdmin ? `<option value="ADMIN" ${targetUser.role === 'ADMIN' ? 'selected' : ''}>ผู้ดูแลระบบ (ADMIN)</option>` : ''}
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-700 mb-1 mt-2">สิทธิ์ที่ร้องขอ</label>
              <select id="swal-req-role" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white">
                <option value="STUDENT" ${targetUser.requested_role === 'STUDENT' ? 'selected' : ''}>STUDENT</option>
                <option value="ADVISOR" ${targetUser.requested_role === 'ADVISOR' ? 'selected' : ''}>ADVISOR</option>
              </select>
            </div>

            <div class="col-span-2">
              <label class="block text-xs font-medium text-slate-700 mb-1 mt-2">ประเภทอาจารย์ (Advisor Type)</label>
              <select id="swal-advisor-type" class="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm outline-none bg-white">
                <option value="" ${!targetUser.advisor_type ? 'selected' : ''}>-- ทั่วไป / ไม่ระบุ --</option>
                <option value="อาจารย์ในสาขา" ${targetUser.advisor_type === 'อาจารย์ในสาขา' ? 'selected' : ''}>อาจารย์ในสาขา (เข้าเมนูจัดการระบบได้)</option>
                <option value="อาจารย์นอกสาขา" ${targetUser.advisor_type === 'อาจารย์นอกสาขา' ? 'selected' : ''}>อาจารย์นอกสาขา</option>
                <option value="บุคลากรภายนอก" ${targetUser.advisor_type === 'บุคลากรภายนอก' ? 'selected' : ''}>บุคลากรภายนอก</option>
              </select>
            </div>
            
            <div class="col-span-2 flex items-center gap-2 mt-2">
              <input type="checkbox" id="swal-is-accepted" class="w-4 h-4 text-blue-600 rounded" ${targetUser.is_accepted ? 'checked' : ''}>
              <label for="swal-is-accepted" class="text-sm font-medium text-slate-700">ยืนยันการรับเข้าสู่ระบบ (is_accepted)</label>
            </div>
          </div>
        </div>
      `,
      focusConfirm: false,
      buttonsStyling: false,
      showDenyButton: canDeleteTarget,
      denyButtonText: 'ลบไอดี',
      showCancelButton: true,
      cancelButtonText: 'ยกเลิก',
      confirmButtonText: 'บันทึกการแก้ไข',
      reverseButtons: false,
      customClass: {
        popup: 'rounded-2xl shadow-2xl border border-slate-100',
        actions: '!flex !w-full !justify-between !items-center !px-6 !mt-6 !gap-3',
        denyButton: '!order-1 !mr-auto !ml-0 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-xl px-4 py-2.5 shadow-sm',
        cancelButton: '!order-2 !ml-auto !mr-0 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm rounded-xl px-4 py-2.5',
        confirmButton: '!order-3 !ml-0 !mr-0 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-xl px-5 py-2.5 shadow-sm shadow-blue-500/20'
      },
      didOpen: () => {
        const btn = document.getElementById('swal-expertise-btn');
        const dropdown = document.getElementById('swal-expertise-dropdown');
        const textEl = document.getElementById('swal-expertise-text');
        const checkboxes = document.querySelectorAll('.swal-expertise-checkbox');

        const updateText = () => {
          const checked = Array.from(checkboxes).filter(cb => cb.checked).map(cb => cb.value);
          if (checked.length > 0) {
            textEl.textContent = checked.join(', ');
            textEl.classList.remove('text-slate-500');
            textEl.classList.add('text-slate-800', 'font-medium');
          } else {
            textEl.textContent = '-- เลือกความเชี่ยวชาญ --';
            textEl.classList.remove('text-slate-800', 'font-medium');
            textEl.classList.add('text-slate-500');
          }
        };

        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          dropdown.classList.toggle('hidden');
        });

        document.querySelector('.swal2-popup').addEventListener('click', () => {
          dropdown.classList.add('hidden');
        });

        dropdown.addEventListener('click', (e) => e.stopPropagation());
        
        checkboxes.forEach(cb => cb.addEventListener('change', updateText));
        updateText();
      },
      preConfirm: () => {
        return {
          prefix: document.getElementById('swal-prefix').value,
          first_name: document.getElementById('swal-fname').value,
          last_name: document.getElementById('swal-lname').value,
          account_code: document.getElementById('swal-account-code').value,
          phone: document.getElementById('swal-phone').value,
          role: document.getElementById('swal-role').value,
          requested_role: document.getElementById('swal-req-role').value,
          advisor_type: document.getElementById('swal-advisor-type').value || null,
          is_accepted: document.getElementById('swal-is-accepted').checked,
          faculty: document.getElementById('swal-faculty').value || null,
          major: document.getElementById('swal-major').value || null,
          expertise: Array.from(document.querySelectorAll('.swal-expertise-checkbox:checked')).map(cb => cb.value).join(', ') || null,
        }
      }
    });

    if (result.isDenied) {
      await handleDeleteUser(targetUser);
      return;
    }

    if (!result.isConfirmed || !result.value) return;

    const formValues = result.value;
    if (targetUser.role === 'ADMIN' && !isAdmin) {
      return Swal.fire("ไม่มีสิทธิ์", "อาจารย์ไม่สามารถแก้ไขข้อมูลของผู้ดูแลระบบ (Admin) ได้", "error");
    }
    if (!isAdmin && formValues.role === 'ADMIN') {
      return Swal.fire("ไม่มีสิทธิ์", "อาจารย์ไม่สามารถแต่งตั้งหรือเปลี่ยนสิทธิ์เป็น Admin ได้", "error");
    }

      try {
        Swal.fire({ title: 'กำลังบันทึกข้อมูล...', didOpen: () => Swal.showLoading() });
        
        const { data: updatedUser, error: userError } = await supabase
            .from("users")
            .update(formValues)
            .eq("email", targetUser.email) 
            .select(); 
            
        if (userError) throw userError;
        
        if (!updatedUser || updatedUser.length === 0) {
            throw new Error("ไม่อัปเดตข้อมูล: อาจติดสิทธิ์การเข้าถึง (RLS Policy)");
        }

        let changes = [];
        if (formValues.role !== targetUser.role) changes.push(`สิทธิ์เป็น ${formValues.role}`);
        if (formValues.advisor_type !== (targetUser.advisor_type || null)) changes.push(`ประเภทอาจารย์เป็น ${formValues.advisor_type || 'ไม่มี'}`);
        if (formValues.first_name !== targetUser.first_name || formValues.last_name !== targetUser.last_name) changes.push('ชื่อ-สกุล');
        if (formValues.major !== (targetUser.major || null)) changes.push('สาขา');
        if (formValues.faculty !== (targetUser.faculty || null)) changes.push('คณะ');
        const changeText = changes.length > 0 ? ` (แก้: ${changes.join(', ')})` : '';

        await logActivity("EDIT_USER", `บันทึกแก้ไขข้อมูล ${targetUser.email}${changeText}`);
        Swal.fire("สำเร็จ!", "อัปเดตข้อมูลผู้ใช้งานเรียบร้อยแล้ว", "success");
        fetchAllData(true); 
      } catch (error) {
        Swal.fire("เกิดข้อผิดพลาด", error.message, "error");
      }
  };

  // ==========================================
  // 4. ฟังก์ชันลบ Log ทันทีแบบ Manual
  // ==========================================
  const handleClearLogs = async () => {
    if (!isAdmin) {
      return Swal.fire("สิทธิ์ไม่เพียงพอ", "การลบ Log ระบบสงวนสิทธิ์เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น", "error");
    }

    const result = await Swal.fire({
      title: "เคลียร์ประวัติทั้งหมด?",
      text: "คุณต้องการลบประวัติการทำงานทั้งหมดทันทีเลยใช่หรือไม่? (การกระทำนี้ย้อนกลับไม่ได้)",
      icon: "warning",
      showCancelButton: true, reverseButtons: true,
      confirmButtonColor: "#ef4444",
      confirmButtonText: "ลบทิ้งทั้งหมด",
      cancelButtonText: "ยกเลิก"
    });

    if(result.isConfirmed){
      try {
        await supabase.from("activity_logs").delete().neq('id', '00000000-0000-0000-0000-000000000000');
        Swal.fire("ลบสำเร็จ", "ลบประวัติระบบทั้งหมดแล้ว", "success");
        fetchAllData(true);
      } catch (error) {
        Swal.fire("Error", "ลบประวัติไม่สำเร็จ", "error");
      }
    }
  }

  // ==========================================
  // การคำนวณหน้าจอแสดงผล
  // ==========================================
  const filteredUsers = allUsers.filter((u) => {
    if (filterRole !== "ALL" && u.role !== filterRole) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const fullName = `${u.first_name} ${u.last_name}`.toLowerCase();
      if (!fullName.includes(q) && !u.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalPagesAll = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndexAll = (currentPage - 1) * itemsPerPage;
  const currentUsersAll = filteredUsers.slice(startIndexAll, startIndexAll + itemsPerPage);

  const totalPagesPending = Math.ceil(pendingUsers.length / itemsPerPage);
  const startIndexPending = (currentPage - 1) * itemsPerPage;
  const currentUsersPending = pendingUsers.slice(startIndexPending, startIndexPending + itemsPerPage);

  const totalPagesLogs = Math.ceil(activityLogs.length / itemsPerPage);
  const startIndexLogs = (currentPage - 1) * itemsPerPage;
  const currentLogs = activityLogs.slice(startIndexLogs, startIndexLogs + itemsPerPage);

  const formatDateTime = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString('th-TH', { 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  };

  return (
    <div className="min-h-screen bg-transparent text-slate-800 relative" style={{ fontFamily: "'Kanit', sans-serif" }}>
      <Header user={user} fullName={`${user?.first_name || ""} ${user?.last_name || ""}`} role={user?.role} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        <div className="mb-6 mt-2 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {isAdmin ? "แผงควบคุมผู้ดูแลระบบ (Admin)" : "แผงควบคุมอาจารย์ประจำสาขา (Branch Advisor)"}
            </h1>
            <p className="text-slate-500 mt-1">
              {isAdmin && !isBranchAdvisor
                ? "จัดการผู้ใช้งาน และดูแลความปลอดภัยระบบภาพรวม" 
                : `อนุมัติสิทธิ์และจัดการผู้ใช้งานในสาขา ${user?.major || ''} ${user?.faculty ? `(${user.faculty})` : ''}`}
            </p>
          </div>

          {isBranchAdvisor && (
            <div className="bg-orange-50 border border-orange-200 px-4 py-2 rounded-xl flex items-center gap-2 text-orange-800 text-sm font-medium">
              <span>🏢 สิทธิ์จัดการขอบเขต:</span>
              <span className="font-semibold text-orange-900">{user?.major || 'สาขาวิชา'}</span>
            </div>
          )}
        </div>

        {/* สรุปสถิติผู้ใช้งาน */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center items-center cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => { setActiveTab("all"); setFilterRole("STUDENT"); }}>
            <div className="text-slate-500 text-sm font-medium mb-1">นักศึกษา</div>
            <div className="text-3xl font-bold text-blue-600">{stats.student}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center items-center cursor-pointer hover:border-orange-400 transition-colors"
                onClick={() => { setActiveTab("all"); setFilterRole("ADVISOR"); }}>
            <div className="text-slate-500 text-sm font-medium mb-1">อาจารย์</div>
            <div className="text-3xl font-bold text-orange-500">{stats.advisor}</div>
          </div>
          <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center items-center cursor-pointer hover:border-purple-400 transition-colors"
                onClick={() => { setActiveTab("all"); setFilterRole("ADMIN"); }}>
            <div className="text-slate-500 text-sm font-medium mb-1">แอดมิน</div>
            <div className="text-3xl font-bold text-purple-600">{stats.admin}</div>
          </div>
          <div className="bg-slate-800 rounded-2xl p-5 border border-slate-700 shadow-sm flex flex-col justify-center items-center cursor-pointer hover:bg-slate-700 transition-colors"
                onClick={() => { setActiveTab("all"); setFilterRole("ALL"); }}>
            <div className="text-slate-300 text-sm font-medium mb-1">บัญชีในขอบเขต</div>
            <div className="text-3xl font-bold text-white">{stats.total}</div>
          </div>
        </div>

        {/* แท็บเมนู */}
        <div className="flex border-b border-slate-200 mb-6 gap-4 sm:gap-6 overflow-x-auto custom-scrollbar pb-1">
          <button
            onClick={() => setActiveTab("pending")}
            className={`pb-3 font-medium text-[14px] sm:text-[15px] whitespace-nowrap transition-colors relative shrink-0 ${activeTab === "pending" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            คำขอรออนุมัติ
            {pendingUsers.length > 0 && <span className="ml-2 inline-flex items-center justify-center bg-rose-500 text-white text-[11px] px-2 py-0.5 rounded-full">{pendingUsers.length}</span>}
            {activeTab === "pending" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-md"></span>}
          </button>
          
          <button
            onClick={() => setActiveTab("all")}
            className={`pb-3 font-medium text-[14px] sm:text-[15px] whitespace-nowrap transition-colors relative shrink-0 ${activeTab === "all" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            จัดการผู้ใช้ทั้งหมด
            {activeTab === "all" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-md"></span>}
          </button>

          <button
            onClick={() => setActiveTab("logs")}
            className={`pb-3 font-medium text-[14px] sm:text-[15px] whitespace-nowrap transition-colors relative shrink-0 ${activeTab === "logs" ? "text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
          >
            ประวัติระบบ (Logs)
            {activeTab === "logs" && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-600 rounded-t-md"></span>}
          </button>
        </div>

        {/* คอนเทนต์ตามแท็บที่เลือก */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-slate-500 flex flex-col items-center shrink-0">
              <svg className="animate-spin h-8 w-8 text-blue-500 mx-auto mb-4 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              กำลังโหลดข้อมูล...
            </div>
          ) : activeTab === "pending" ? (
            // ================== แท็บคำขอรออนุมัติ ==================
            pendingUsers.length === 0 ? (
              <div className="p-16 text-center text-slate-400 flex flex-col items-center shrink-0">
                <svg className="w-16 h-16 text-slate-300 mb-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-lg">ไม่มีบัญชีที่รอการอนุมัติในสาขาของคุณ</div>
              </div>
            ) : (
              <div className="flex flex-col min-h-0">
                {/* 📱 Mobile Card View */}
                <div className="block md:hidden divide-y divide-slate-100">
                  {currentUsersPending.map((u) => (
                    <div key={u.email} className="p-4 flex flex-col gap-3 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900 text-[15px]">
                            {`${u.prefix || ""} ${u.first_name} ${u.last_name}`}
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5 break-all">
                            {u.email}
                          </div>
                        </div>
                        <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide shrink-0 ${
                          u.requested_role === 'ADVISOR' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {u.requested_role === 'ADVISOR' ? (u.advisor_type || 'อาจารย์') : 'นักศึกษา'}
                        </span>
                      </div>

                      <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-600 space-y-1">
                        <div><span className="text-slate-400 font-medium">สาขา/คณะ:</span> {u.major || '-'} ({u.faculty || '-'})</div>
                        {u.account_code && <div><span className="text-slate-400 font-medium">รหัสประจำตัว:</span> {u.account_code}</div>}
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button onClick={() => handleViewUser(u)} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 font-semibold text-xs rounded-xl transition-all text-center">
                          ดูข้อมูล
                        </button>
                        <button onClick={() => handleApprove(u)} className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-xs rounded-xl transition-all shadow-sm text-center">
                          อนุมัติ
                        </button>
                        <button onClick={() => handleReject(u)} className="flex-1 py-2 bg-rose-100 hover:bg-rose-200 text-rose-600 font-semibold text-xs rounded-xl transition-all text-center">
                          ปฏิเสธ
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 💻 Desktop Table View */}
                <div className="hidden md:block overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left border-collapse min-w-full">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                        <th className="px-6 py-4 font-semibold">ชื่อ - นามสกุล</th>
                        <th className="px-6 py-4 font-semibold">อีเมล</th>
                        <th className="px-6 py-4 font-semibold">สาขา/คณะ</th>
                        <th className="px-6 py-4 font-semibold text-center">สิทธิ์ที่ขอ</th>
                        <th className="px-6 py-4 font-semibold text-center">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentUsersPending.map((u) => (
                        <tr key={u.email} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{`${u.prefix || ""} ${u.first_name} ${u.last_name}`}</td>
                          <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                          <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">{u.major || '-'} ({u.faculty || '-'})</td>
                          <td className="px-6 py-4 text-center whitespace-nowrap">
                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase inline-block whitespace-nowrap ${
                              u.requested_role === 'ADVISOR' ? 'bg-orange-100 text-orange-700' : 'bg-blue-100 text-blue-700'
                            }`}>
                              {u.requested_role === 'ADVISOR' ? (u.advisor_type || 'อาจารย์') : 'นักศึกษา'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <button onClick={() => handleViewUser(u)} className="px-4 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700 text-sm rounded-lg transition-all whitespace-nowrap"> ดูข้อมูล</button>
                              <button onClick={() => handleApprove(u)} className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm rounded-lg transition-all shadow-sm whitespace-nowrap">อนุมัติ</button>
                              <button onClick={() => handleReject(u)} className="px-4 py-1.5 bg-rose-100 text-rose-600 hover:bg-rose-200 hover:text-rose-700 text-sm rounded-lg transition-all whitespace-nowrap">ปฏิเสธ</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {pendingUsers.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 gap-4">
                    <div className="text-sm text-slate-500">
                      แสดง <span className="font-medium text-slate-700">{startIndexPending + 1}</span> ถึง <span className="font-medium text-slate-700">{Math.min(startIndexPending + itemsPerPage, pendingUsers.length)}</span> จาก <span className="font-medium text-slate-700">{pendingUsers.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white disabled:opacity-50">ก่อนหน้า</button>
                      <span className="text-sm px-2">หน้า {currentPage} / {totalPagesPending || 1}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPagesPending, p + 1))} disabled={currentPage === totalPagesPending || totalPagesPending === 0} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white disabled:opacity-50">ถัดไป</button>
                    </div>
                  </div>
                )}
              </div>
            )
          ) : activeTab === "all" ? (
            // ================== แท็บจัดการผู้ใช้ทั้งหมด ==================
            <div>
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <input type="text" placeholder="ค้นหาชื่อ หรือ อีเมล..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="block w-full px-3 py-2 border border-slate-200 rounded-xl leading-5 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all"/>
                </div>

                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
                  <button onClick={() => setFilterRole("ALL")} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterRole === "ALL" ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>ทั้งหมด</button>
                  <button onClick={() => setFilterRole("STUDENT")} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterRole === "STUDENT" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>นักศึกษา</button>
                  <button onClick={() => setFilterRole("ADVISOR")} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterRole === "ADVISOR" ? "bg-orange-100 text-orange-700 border-orange-200" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>อาจารย์</button>
                  {isAdmin && (
                    <button onClick={() => setFilterRole("ADMIN")} className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${filterRole === "ADMIN" ? "bg-purple-100 text-purple-700 border-purple-200" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>ผู้ดูแลระบบ</button>
                  )}
                </div>
              </div>

              <div className="flex flex-col min-h-0">
                {filteredUsers.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">ไม่พบผู้ใช้งานที่ตรงกับเงื่อนไขการค้นหา</div>
                ) : (
                  <>
                    {/* 📱 Mobile Card View */}
                    <div className="block md:hidden divide-y divide-slate-100">
                      {currentUsersAll.map((u) => (
                        <div key={u.email} className="p-4 flex flex-col gap-3 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-bold text-slate-900 text-[15px]">
                                {`${u.prefix || ""} ${u.first_name} ${u.last_name}`}
                              </div>
                              <div className="text-xs text-slate-500 mt-0.5 break-all">
                                {u.email}
                              </div>
                            </div>
                            <div className="shrink-0">
                              {u.role === 'STUDENT' ? (
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 inline-block whitespace-nowrap">นักศึกษา</span>
                              ) : u.role === 'ADMIN' ? (
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 inline-block whitespace-nowrap">แอดมิน</span>
                              ) : (
                                <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-block whitespace-nowrap ${u.advisor_type ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                                  {u.advisor_type || "อาจารย์"}
                                </span>
                              )}
                            </div>
                          </div>

                          {(u.faculty || u.major || u.account_code) && (
                            <div className="bg-slate-50 rounded-xl p-2.5 text-xs text-slate-600 space-y-1">
                              {(u.faculty || u.major) && (
                                <div><span className="text-slate-400 font-medium">สาขา/คณะ:</span> {u.major || '-'} {u.faculty ? `(${u.faculty})` : ''}</div>
                              )}
                              {u.account_code && (
                                <div><span className="text-slate-400 font-medium">รหัสประจำตัว:</span> {u.account_code}</div>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-1">
                            <button onClick={() => handleViewUser(u)} className="flex-1 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs rounded-xl transition-all text-center">
                              ดูข้อมูล
                            </button>
                            {(isAdmin || u.role !== 'ADMIN') ? (
                              <button onClick={() => handleEditUser(u)} className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-xl transition-all text-center">
                                แก้ไข
                              </button>
                            ) : (
                              <span className="flex-1 py-2 bg-slate-50 text-slate-300 font-semibold text-xs rounded-xl text-center cursor-not-allowed select-none">
                                แก้ไข
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 💻 Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse min-w-full">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 text-sm border-b border-slate-200">
                            <th className="px-6 py-4 font-semibold">ชื่อ - นามสกุล</th>
                            <th className="px-6 py-4 font-semibold">อีเมล</th>
                            <th className="px-6 py-4 font-semibold">สถานะ / ประเภท</th>
                            <th className="px-6 py-4 font-semibold text-center">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {currentUsersAll.map((u) => (
                            <tr key={u.email} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 font-medium text-slate-900 whitespace-nowrap">{`${u.prefix || ""} ${u.first_name} ${u.last_name}`}</td>
                              <td className="px-6 py-4 text-sm text-slate-600">{u.email}</td>
                              <td className="px-6 py-4 text-sm whitespace-nowrap">
                                {u.role === 'STUDENT' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold bg-blue-100 text-blue-700 inline-block whitespace-nowrap">นักศึกษา</span>
                                ) : u.role === 'ADMIN' ? (
                                  <span className="px-2.5 py-1 rounded-full text-[12px] font-semibold bg-purple-100 text-purple-700 inline-block whitespace-nowrap">แอดมิน</span>
                                ) : (
                                  <span className={`px-2.5 py-1 rounded-full text-[12px] font-semibold inline-block whitespace-nowrap ${u.advisor_type ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'}`}>
                                    {u.advisor_type || "NULL"}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-center whitespace-nowrap">
                                <div className="flex items-center justify-center gap-1.5">
                                  <button onClick={() => handleViewUser(u)} className="px-3 py-1.5 text-emerald-600 hover:bg-emerald-50 text-sm rounded-lg transition-all border border-transparent hover:border-emerald-200 whitespace-nowrap">ดูข้อมูล</button>
                                  {(isAdmin || u.role !== 'ADMIN') ? (
                                    <button onClick={() => handleEditUser(u)} className="px-3 py-1.5 text-blue-600 hover:bg-blue-50 text-sm rounded-lg transition-all border border-transparent hover:border-blue-200 whitespace-nowrap">แก้ไข</button>
                                  ) : (
                                    <span className="px-3 py-1.5 text-slate-300 text-sm cursor-not-allowed select-none whitespace-nowrap" title="อาจารย์ไม่สามารถแก้ไขข้อมูล Admin ได้">แก้ไข</span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Pagination */}
                {filteredUsers.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 gap-4">
                    <div className="text-sm text-slate-500">
                      แสดง <span className="font-medium text-slate-700">{startIndexAll + 1}</span> ถึง <span className="font-medium text-slate-700">{Math.min(startIndexAll + itemsPerPage, filteredUsers.length)}</span> จาก <span className="font-medium text-slate-700">{filteredUsers.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white disabled:opacity-50">ก่อนหน้า</button>
                      <span className="text-sm px-2">หน้า {currentPage} / {totalPagesAll || 1}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPagesAll, p + 1))} disabled={currentPage === totalPagesAll || totalPagesAll === 0} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white disabled:opacity-50">ถัดไป</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            // ================== แท็บประวัติระบบ (Logs) ==================
            <div>
              <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <div>
                  <h2 className="text-base font-semibold text-slate-800">บันทึกกิจกรรมล่าสุด</h2>
                  <p className="text-xs text-slate-500 mt-1">แสดงประวัติการกระทำของผู้ดูแลและอาจารย์สาขา</p>
                </div>
                {isAdmin && (
                  <button 
                    onClick={handleClearLogs}
                    className="px-4 py-2 bg-rose-100 hover:bg-rose-200 text-rose-700 text-sm font-semibold rounded-xl transition-all flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    เคลียร์ Log ทันที
                  </button>
                )}
              </div>

              <div className="flex flex-col min-h-0">
                {activityLogs.length === 0 ? (
                  <div className="p-12 text-center text-slate-500">ยังไม่มีประวัติการทำรายการในระบบ</div>
                ) : (
                  <>
                    {/* 📱 Mobile Card View */}
                    <div className="block md:hidden divide-y divide-slate-100">
                      {currentLogs.map((log) => (
                        <div key={log.id} className="p-4 flex flex-col gap-2 hover:bg-slate-50/50 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase ${
                              log.action.includes('APPROVE') ? 'bg-emerald-100 text-emerald-700' : 
                              log.action.includes('DELETE') || log.action.includes('REJECT') ? 'bg-rose-100 text-rose-700' : 
                              'bg-blue-100 text-blue-700'
                            }`}>
                              {log.action}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {formatDateTime(log.created_at)}
                            </span>
                          </div>

                          <div className="text-xs text-slate-500 break-all">
                            <span className="font-semibold text-slate-700">ผู้ทำรายการ:</span> {log.admin_email}
                          </div>

                          <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100">
                            {log.details}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 💻 Desktop Table View */}
                    <div className="hidden md:block overflow-x-auto custom-scrollbar">
                      <table className="w-full text-left border-collapse min-w-full">
                        <thead>
                          <tr className="bg-white text-slate-600 text-sm border-b border-slate-200">
                            <th className="px-6 py-4 font-semibold w-48">วัน-เวลา</th>
                            <th className="px-6 py-4 font-semibold w-1/4">ผู้ทำรายการ</th>
                            <th className="px-6 py-4 font-semibold w-32">ประเภท</th>
                            <th className="px-6 py-4 font-semibold">รายละเอียด</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {currentLogs.map((log) => (
                            <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                              <td className="px-6 py-4 text-sm font-medium text-slate-700">{log.admin_email}</td>
                              <td className="px-6 py-4 text-sm">
                                <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase
                                  ${log.action.includes('APPROVE') ? 'bg-emerald-100 text-emerald-700' : 
                                    log.action.includes('DELETE') || log.action.includes('REJECT') ? 'bg-rose-100 text-rose-700' : 
                                    'bg-blue-100 text-blue-700'}`}>
                                  {log.action}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-slate-600">{log.details}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}

                {/* Pagination */}
                {activityLogs.length > 0 && (
                  <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50 gap-4">
                    <div className="text-sm text-slate-500">
                      แสดง <span className="font-medium text-slate-700">{startIndexLogs + 1}</span> ถึง <span className="font-medium text-slate-700">{Math.min(startIndexLogs + itemsPerPage, activityLogs.length)}</span> จาก <span className="font-medium text-slate-700">{activityLogs.length}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white disabled:opacity-50">ก่อนหน้า</button>
                      <span className="text-sm px-2">หน้า {currentPage} / {totalPagesLogs || 1}</span>
                      <button onClick={() => setCurrentPage(p => Math.min(totalPagesLogs, p + 1))} disabled={currentPage === totalPagesLogs || totalPagesLogs === 0} className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm bg-white disabled:opacity-50">ถัดไป</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
