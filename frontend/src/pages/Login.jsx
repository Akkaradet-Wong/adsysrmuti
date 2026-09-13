// ===============================================
// src/pages/Login.jsx
// ===============================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { logoutAll } from "../lib/authUtils";
import Swal from "sweetalert2";

export default function Login() {
  const navigate = useNavigate();
  const isMountedRef = useRef(true);

  // ดึงอีเมลที่เคยบันทึกไว้ใน localStorage
  const [email, setEmail] = useState(() => {
    try {
      return localStorage.getItem("rememberedEmail") || "";
    } catch {
      return "";
    }
  });
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // State สำหรับ Checkbox "จดจำฉันไว้"
  const [remember, setRemember] = useState(() => {
    try {
      return localStorage.getItem("auth_remember_me") === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // 🌟 ฟังก์ชันแยกเส้นทางตาม Role และตรวจสอบการอนุมัติ
  const checkUserAccess = useCallback(async (authUser) => {
    let userData = null;
    let lastError = null;

    // 🚀 ระบบ Auto-Retry สูงสุด 3 ครั้ง (ป้องกันปัญหา Clock Skew หรือเน็ตกระตุก)
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // 1. ค้นหาด้วย auth_id ก่อน (ตรงและเร็วที่สุด)
        let { data, error: dbError } = await supabase
          .from("users")
          .select("role, requested_role, is_accepted")
          .eq("auth_id", authUser.id)
          .maybeSingle();

        // 2. ถ้าไม่เจอด้วย auth_id ให้ fallback ค้นหาด้วย email แบบ case-insensitive
        if (!data && authUser.email) {
          const { data: dataByEmail, error: emailError } = await supabase
            .from("users")
            .select("role, requested_role, is_accepted")
            .ilike("email", authUser.email.trim().toLowerCase())
            .maybeSingle();

          if (emailError) throw emailError;
          data = dataByEmail;
        }

        if (dbError) throw dbError;
        userData = data;
        break; // ดึงสำเร็จ ออกจากลูปทันที
      } catch (err) {
        lastError = err;
        console.warn(`checkUserAccess attempt ${attempt} failed:`, err.message);
        if (attempt < 3) {
          await new Promise((res) => setTimeout(res, 600 * attempt));
        }
      }
    }

    // กรณีหาข้อมูลใน DB ไม่เจอ แต่ล็อกอินผ่าน Auth แล้ว ให้เข้า Dashboard ได้
    if (!userData) {
      console.warn("Falling back to /dashboard due to:", lastError?.message);
      return "/dashboard";
    }

    // 1. 🚨 ตรวจสอบสิทธิ์อาจารย์ที่สมัครใหม่และยังรอ Admin อนุมัติ
    if (userData.requested_role === "ADVISOR" && !userData.is_accepted) {
      await logoutAll(); // บังคับออกจากระบบทันที
      
      Swal.fire({
        icon: "warning",
        title: "อยู่ระหว่างรออนุมัติสิทธิ์",
        text: "บัญชีอาจารย์ของท่านกำลังรอผู้ดูแลระบบตรวจสอบ (ประมาณ 1-2 วัน) จึงจะสามารถเข้าสู่ระบบได้ครับ",
        confirmButtonColor: "#f59e0b",
      });
      
      return false; // ไม่อนุญาตให้เข้าสู่ระบบ
    }

    // 2. นำทางตาม Role ของผู้ใช้งาน
    if (userData.role === "ADMIN") {
      return "/admin";
    }

    return "/dashboard";
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();

    // ป้องกันการกดซ้ำขณะกำลังประมวลผล
    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    if (!cleanEmail || !cleanPassword) {
      return Swal.fire({
        icon: "warning",
        title: "ข้อมูลไม่ครบถ้วน",
        text: "กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน",
        confirmButtonColor: "#f59e0b",
      });
    }

    setLoading(true);

    try {
      // 1. จัดการ Checkbox "จดจำฉันไว้" ก่อนล็อกอินเพื่อให้ Storage จัดการ Session ถูกต้อง (localStorage vs sessionStorage)
      try {
        if (remember) {
          localStorage.setItem("auth_remember_me", "true");
          localStorage.setItem("rememberedEmail", cleanEmail);
        } else {
          localStorage.removeItem("auth_remember_me");
          localStorage.removeItem("rememberedEmail");
          Object.keys(localStorage).forEach((k) => {
            if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
              localStorage.removeItem(k);
            }
          });
        }
      } catch (storageErr) {
        console.warn("Storage access failed:", storageErr);
      }

      // 2. ล็อกอินผ่าน Supabase Auth (พร้อมระบบ Auto-Retry เผื่อ Clock Skew / Network)
      let authData = null;
      let authError = null;

      for (let attempt = 1; attempt <= 2; attempt++) {
        const res = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });
        authData = res.data;
        authError = res.error;

        if (!authError) break;

        // หากติดเรื่องเวลาเครื่อง (JWT future) ให้รอสักครู่แล้วลองใหม่
        if (
          attempt < 2 &&
          (authError.message?.includes("future") || authError.message?.includes("JWT"))
        ) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (authError) throw authError;

      if (!authData?.user) {
        throw new Error("ไม่พบข้อมูลผู้ใช้งาน กรุณาลองใหม่อีกครั้ง");
      }

      // 3. ตรวจสอบสิทธิ์การเข้าใช้งาน
      const targetPath = await checkUserAccess(authData.user);

      // 4. หากผ่านเงื่อนไขความปลอดภัย ให้นำทางไปยังหน้าที่ถูกต้อง
      if (targetPath && isMountedRef.current) {
        await Swal.fire({
          icon: "success",
          title: "เข้าสู่ระบบสำเร็จ",
          showConfirmButton: false,
          timer: 1200,
        });

        navigate(targetPath, { replace: true });
      }

    } catch (error) {
      console.error("Login Error:", error);

      let errorTitle = "เข้าสู่ระบบไม่สำเร็จ";
      let errorMessage = "เกิดข้อผิดพลาด: " + (error.message || "กรุณาลองใหม่อีกครั้ง");

      const errLower = (error.message || "").toLowerCase();

      if (
        errLower.includes("invalid login credentials") ||
        errLower.includes("invalid_grant") ||
        errLower.includes("invalid_credentials")
      ) {
        errorTitle = "ข้อมูลไม่ถูกต้อง";
        errorMessage = "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง";
      } else if (
        errLower.includes("jwt issued at future") ||
        errLower.includes("issued in the future")
      ) {
        errorTitle = "เวลาเครื่องไม่ตรงกับระบบ";
        errorMessage =
          "<b>วิธีแก้ง่ายๆ ใน 5 วินาที:</b><br/>1. คลิกขวาที่ <b>นาฬิกามุมขวาล่างของจอคอม</b><br/>2. เลือก <b>'Adjust date and time'</b><br/>3. กดปุ่ม <b>'Sync now'</b> แล้วลองเข้าสู่ระบบใหม่อีกครั้งครับ";
      } else if (errLower.includes("email not confirmed")) {
        errorTitle = "กรุณายืนยันอีเมล";
        errorMessage = "โปรดตรวจสอบกล่องข้อความของคุณและกดยืนยันอีเมลก่อนเข้าสู่ระบบ";
      } else if (errLower.includes("rate limit") || error.status === 429) {
        errorTitle = "เข้าสู่ระบบบ่อยเกินไป";
        errorMessage = "คุณพยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่ (ประมาณ 1 นาที) แล้วลองใหม่อีกครั้ง";
      } else if (
        errLower.includes("network") ||
        errLower.includes("failed to fetch") ||
        !navigator.onLine
      ) {
        errorTitle = "ปัญหาการเชื่อมต่อ";
        errorMessage = "ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาตรวจสอบสัญญาณอินเทอร์เน็ตของคุณ";
      }

      Swal.fire({
        icon: "error",
        title: errorTitle,
        html: errorMessage,
        confirmButtonColor: "#ef4444",
      });

    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const inputClass =
    "w-full pl-11 pr-4 py-3 sm:py-3.5 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400 text-[15px] disabled:opacity-60 disabled:cursor-not-allowed";

  return (
    <div
      className="min-h-[100dvh] bg-transparent flex flex-col justify-center relative overflow-y-auto overflow-x-hidden"
      style={{ fontFamily: "'Kanit', sans-serif" }}
    >
      <div className="flex-grow flex flex-col justify-center p-4 relative w-full z-10">
        {/* Login Card */}
        <div className="relative z-10 w-full max-w-[420px] bg-white/90 backdrop-blur-md rounded-[2rem] p-6 sm:p-10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white m-auto">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 mb-4 bg-white rounded-full shadow-sm border border-slate-100 overflow-hidden relative">
              <img 
                src="https://qrqusnleuanrjvmiqtbn.supabase.co/storage/v1/object/public/assets/PA.png" 
                alt="Logo" 
                fetchPriority="high"
                loading="eager"
                className="w-24 h-24 sm:w-24 sm:h-24 object-contain shrink-0" 
              />
            </div>
            
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-800 mb-2">
              เข้าสู่ระบบ
            </h2>
            <p className="text-slate-500 font-light text-sm sm:text-base">
              ระบบจัดการโครงงานนักศึกษา
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5" noValidate>
            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-[13px] font-medium text-slate-700 mb-1.5 pl-1"
              >
                อีเมล
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  spellCheck="false"
                  disabled={loading}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="กรอกอีเมลของคุณ"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-[13px] font-medium text-slate-700 mb-1.5 pl-1"
              >
                รหัสผ่าน
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 shrink-0">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  autoComplete="current-password"
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่าน"
                  required
                  className={`${inputClass} pr-12`}
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={loading}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-blue-600 transition-colors focus:outline-none"
                  tabIndex="-1"
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex justify-between items-center py-2">
              <label className="flex items-center text-slate-500 cursor-pointer font-light hover:text-slate-800 transition-colors group select-none">
                <input
                  type="checkbox"
                  name="remember"
                  checked={remember}
                  disabled={loading}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="mr-2 w-4 h-4 rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 focus:ring-2 cursor-pointer transition-all disabled:opacity-50"
                />
                <span className="text-sm">จดจำฉันไว้</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-sm text-blue-600 font-medium hover:text-blue-800 transition-colors"
              >
                ลืมรหัสผ่าน?
              </Link>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 mt-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/30 transition-all shadow-md shadow-blue-500/30 flex justify-center items-center gap-2 disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  <span>กำลังเข้าสู่ระบบ...</span>
                </>
              ) : (
                <span>เข้าสู่ระบบ</span>
              )}
            </button>
          </form>

          {/* Register Link */}
          <div className="text-center mt-8 text-sm text-slate-500 font-light border-t border-slate-100 pt-6">
            ยังไม่มีบัญชีใช่หรือไม่?{" "}
            <Link
              to="/register"
              className="text-blue-600 font-medium hover:text-blue-800 transition-colors"
            >
              สร้างบัญชีใหม่
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}