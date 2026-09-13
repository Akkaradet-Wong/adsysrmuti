// =============================================
// src/pages/Dashboard.jsx
// =============================================
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";

export default function Dashboard() {
  const navigate = useNavigate();

  // ================= STATE =================
  const [authUser, setAuthUser] = useState(null);
  const [fullName, setFullName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [role, setRole] = useState("");
  const [advisorType, setAdvisorType] = useState(""); // 🌟 เก็บประเภทอาจารย์
  const [expertise, setExpertise] = useState(""); // 🌟 เก็บความเชี่ยวชาญ
  const [loading, setLoading] = useState(true);

  // ================= FETCH DATA =================
  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const currentUser = authData?.user;

        if (!currentUser) {
          navigate("/login");
          return;
        }

        // ดึงข้อมูลโปรไฟล์จากตาราง users
        let { data: profile } = await supabase
          .from("users")
          .select("*")
          .ilike("email", currentUser.email)
          .maybeSingle();

        // ถ้าไม่พบข้อมูลโปรไฟล์ ให้สร้างข้อมูลเบื้องต้นให้ทันที
        if (!profile) {
          console.warn("ไม่พบโปรไฟล์ กำลังสร้างข้อมูลเริ่มต้น...");
          const fallbackName = currentUser.email.split("@")[0];
          
          const newRow = {
            auth_id: currentUser.id,
            email: currentUser.email,
            first_name: fallbackName,
            last_name: "ไม่ระบุ",
            faculty: "ไม่ระบุข้อมูล", 
            major: "ไม่ระบุข้อมูล",
            role: "STUDENT",
            is_accepted: true,
          };

          const { data: insertedData, error: insertError } = await supabase
            .from("users")
            .insert([newRow])
            .select()
            .maybeSingle();

          if (insertError) {
            console.error("สร้างโปรไฟล์อัตโนมัติไม่สำเร็จ:", insertError);
            profile = newRow; 
          } else {
            profile = insertedData;
          }
        }

        if (isMounted) {
          const prefix = profile.prefix ? `${profile.prefix}` : "";
          const fName = profile.first_name || currentUser.email.split("@")[0];
          const lName = profile.last_name !== "ไม่ระบุ" && profile.last_name !== "-" ? profile.last_name : "";
          
          const full = `${prefix}${fName} ${lName}`.trim();

          setAuthUser(currentUser);
          setFullName(full);
          setProfileImage(profile.profile_image || "");
          setAdvisorType(profile.advisor_type || ""); // 🌟 เก็บประเภทอาจารย์
          setExpertise(profile.expertise || ""); // 🌟 เก็บความเชี่ยวชาญ
          
          // ตรวจสอบว่ารออนุมัติหรือไม่ (ถ้ามี is_pending_advisor ให้แสดงสถานะรอ)
          if (profile.is_pending_advisor) {
            setRole("pending_advisor");
          } else {
            setRole(profile.role || "student");
          }
        }
      } catch (error) {
        console.error("Dashboard Error:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [navigate]);

  // ================= CONFIG UI ROLE =================
  const getRoleName = (r) => {
    if (!r) return 'ไม่ทราบสถานะ';
    
    switch(r.toLowerCase()) {
      case 'admin': return 'ผู้ดูแลระบบ (Admin)';
      case 'advisor': 
        // 🌟 แยกประเภทอาจารย์ให้ชัดเจน
        if (advisorType?.trim() === 'อาจารย์ในสาขา') return 'อาจารย์ที่ปรึกษา (ในสาขา)';
        if (advisorType?.trim() === 'อาจารย์นอกสาขา') return 'อาจารย์ที่ปรึกษา (นอกสาขา)';
        if (advisorType?.trim() === 'บุคลากรอื่น') return 'บุคลากร (ที่ปรึกษาร่วม)';
        return 'อาจารย์ที่ปรึกษา';
      case 'pending_advisor': return 'อาจารย์ (รออนุมัติสิทธิ์)';
      case 'student': return 'นักศึกษา';
      default: return 'ไม่ทราบสถานะ';
    }
  }

  // ================= MENU LIST =================
  const rawRole = role ? role.toLowerCase() : "";
  
  // ✅ แยกตัวแปรสิทธิ์ให้ชัดเจน
  const isAdmin = rawRole === "admin";
  const isBranchAdvisor = rawRole === "advisor" && advisorType?.trim() === "อาจารย์ในสาขา";
  const isAdminOrBranchAdvisor = isAdmin || isBranchAdvisor;
  const isMissingExpertise = isBranchAdvisor && (!expertise || expertise.trim() === "");

  const allMenus = [
    {
      title: "ค้นหาอาจารย์ที่ปรึกษา",
      desc: "เลือกอาจารย์ที่สนใจและดูข้อมูลได้ทันที",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
      path: "/advisorsearch",
    },
    {
      title: "โครงงานหลัก (Project)",
      desc: "จัดการคำขอ โปรเจกต์ และสถานะต่างๆ",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
        </svg>
      ),
      path: "/project",
    },
    {
      title: "ห้องเรียน (Rooms)",
      desc: "เข้าสู่ห้องเรียนเพื่อส่งงานและพูดคุย",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
        </svg>
      ),
      path: "/create-room",
    },
    {
      title: "แชท (Chat)",
      desc: "พูดคุย ปรึกษา และส่งข้อความ",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 shrink-0">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
        </svg>
      ),
      path: "/chat",
    },
    // 🌟 แทรกเมนูจัดการเฉพาะเมื่อเข้าเงื่อนไข
    ...(isAdminOrBranchAdvisor
      ? [
          {
            // เปลี่ยนชื่อและอธิบายตามสิทธิ์ที่เข้ามา
            title: isAdmin ? "จัดการผู้ใช้งาน (Admin)" : "จัดการนักศึกษา/ อาจารย์ (สาขา)",
            desc: isAdmin ? "อนุมัติคำขอ สิทธิ์ และจัดการผู้ใช้งานในระบบ" : "ดูและจัดการข้อมูลนักศึกษาภายในสาขาของคุณ",
            icon: (
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71-.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            ),
            path: "/admin",
          },
        ]
      : []),
  ];

  // ================= LOADING UI =================
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50" style={{ fontFamily: "'Kanit', sans-serif" }}>
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">กำลังเตรียมข้อมูลต้อนรับ...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex flex-col relative transition-colors duration-200" style={{ fontFamily: "'Kanit', sans-serif" }}>
      {/* ================= HEADER ================= */}
      <Header
        user={authUser}
        fullName={fullName}
        profileImage={profileImage}
        role={role}
      />

      {/* ================= MAIN CONTENT ================= */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10 relative z-10">
        
        {/* ================= WELCOME BANNER ================= */}
        <section className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-600 rounded-3xl p-8 sm:p-10 shadow-[0_12px_35px_rgba(79,70,229,0.22)] border border-white/20 flex flex-col md:flex-row items-center justify-between gap-6 mb-10 relative overflow-hidden">
          {/* Background Decor */}
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-white opacity-15 rounded-full blur-3xl -z-0 translate-x-1/3 -translate-y-1/3 pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-sky-300 opacity-20 rounded-full blur-2xl -z-0 -translate-x-1/3 translate-y-1/3 pointer-events-none"></div>
          
          <div className="flex-1 z-10 w-full text-center md:text-left">
            <div className="flex flex-col md:flex-row items-center gap-3 md:gap-4 mb-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-wide">
                สวัสดี, {fullName} 
              </h1>
              {/* ROLE BADGE */}
              <span className="px-4 py-1.5 rounded-full text-sm font-medium bg-white/20 text-white border border-white/30 backdrop-blur-md shadow-sm">
                สถานะ: {getRoleName(role)}
              </span>
            </div>
            <p className="text-indigo-100 text-base font-light max-w-2xl">
              ยินดีต้อนรับเข้าสู่ระบบจัดการและติดตามโครงงาน เลือกเมนูด้านล่างเพื่อเริ่มต้นการทำงานของคุณ
            </p>
          </div>

          {/* Graphic Element */}
          <div className="hidden md:flex items-center justify-center w-28 h-28 bg-white/15 backdrop-blur-md border border-white/25 rounded-full shrink-0 z-10 shadow-inner overflow-hidden">
            <img 
              src="/PJ.png" 
              alt="Logo" 
              fetchPriority="high"
              loading="eager"
              className="w-20 h-20 object-contain shrink-0 drop-shadow" 
            />
          </div>
        </section>

        {/* ================= WARNING MESSAGE FOR PENDING ADVISOR ================= */}
        {rawRole === "pending_advisor" && (
          <div className="bg-indigo-50/90 backdrop-blur-sm text-indigo-900 p-6 rounded-2xl mb-10 border border-indigo-100 shadow-sm flex items-start gap-4">
            <div className="text-2xl mt-0.5"></div>
            <div>
              <strong className="block text-lg font-bold mb-1 text-indigo-900">บัญชีของท่านอยู่ระหว่างรอการอนุมัติสิทธิ์อาจารย์</strong>
              <p className="text-indigo-700 text-sm md:text-base leading-relaxed">ในขณะนี้ท่านจะเห็นเมนูในฐานะนักศึกษาชั่วคราว ท่านจะไม่สามารถรับนักศึกษาได้จนกว่าผู้ดูแลระบบจะยืนยันตัวตนสำเร็จ</p>
            </div>
          </div>
        )}

        {/* ================= MISSING EXPERTISE REMINDER BANNER FOR ADVISORS ================= */}
        {isMissingExpertise && (
          <div className="bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/5 backdrop-blur-md border border-amber-300/80 rounded-3xl p-6 sm:p-7 mb-10 shadow-[0_8px_30px_rgba(245,158,11,0.08)] flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-500">
            {/* Glow decoration */}
            <div className="absolute -top-12 -right-12 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none"></div>

            <div className="flex items-start gap-4 z-10">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shrink-0 shadow-md shadow-amber-500/30">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 shrink-0">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-amber-950 flex items-center gap-2">
                  กรุณากรอกความเชี่ยวชาญ / สายที่ถนัด (Expertise)
                  <span className="text-xs font-semibold bg-amber-200/80 text-amber-900 px-2.5 py-0.5 rounded-full border border-amber-300">สำคัญ</span>
                </h3>
                <p className="text-amber-800/90 text-sm mt-1 leading-relaxed max-w-2xl font-light">
                  ท่านยังไม่ได้ระบุสายที่ถนัด กรุณาไปกรอกความเชี่ยวชาญเพื่อให้นักศึกษาสามารถค้นหาและจับคู่โครงงานได้อย่างถูกต้อง
                </p>
              </div>
            </div>

            <button
              onClick={() => navigate("/profile")}
              className="z-10 shrink-0 w-full md:w-auto px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-semibold text-sm rounded-xl shadow-md shadow-amber-500/25 hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group"
            >
              <span>ไปกรอกความเชี่ยวชาญ</span>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 group-hover:translate-x-1 transition-transform shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        )}

        {/* ================= MENU SECTION ================= */}
        <section>
          <div className="flex items-center gap-4 mb-8">
            <h2 className="text-xl font-bold text-slate-800">เมนูการทำงาน</h2>
            <div className="h-px bg-slate-200/80 flex-1"></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {allMenus.map((item, index) => (
              <div
                key={index}
                onClick={() => navigate(item.path)}
                className="group bg-white/90 backdrop-blur-md p-7 rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.03)] border border-white hover:border-indigo-300 hover:shadow-[0_12px_30px_rgba(99,102,241,0.14)] hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col h-full relative overflow-hidden"
              >
                {/* ขีดสีตกแต่งด้านล่างของการ์ดเมื่อ Hover */}
                <div className="absolute bottom-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-blue-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left"></div>

                <div className="flex items-start justify-between mb-6">
                  {/* Icon Box */}
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 bg-indigo-50 text-indigo-600 group-hover:bg-gradient-to-br group-hover:from-indigo-600 group-hover:to-blue-600 group-hover:text-white group-hover:shadow-md group-hover:shadow-indigo-500/30">
                    {item.icon}
                  </div>
                  {/* Arrow Icon */}
                  <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200 transition-all shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-indigo-700 transition-colors">{item.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed font-light">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

      </main>
    </div>
  );
} 