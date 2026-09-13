// ===============================================
// src/pages/UpdatePassword.jsx
// ===============================================

import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { logoutAll } from "../lib/authUtils";
import Swal from "sweetalert2";

// นำเข้า Header component
import Header from "../components/Header";

export default function UpdatePassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    // 🌟 ตรวจสอบ Session เบื้องต้น 
    // เมื่อผู้ใช้คลิกลิงก์รีเซ็ตจากอีเมล Supabase จะล็อกอินแบบชั่วคราวให้โดยอัตโนมัติ เพื่อให้มีสิทธิ์อัปเดตรหัสผ่านใหม่
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        Swal.fire({
          icon: "error",
          title: "ลิงก์หมดอายุหรือไม่ถูกต้อง",
          text: "กรุณาทำรายการลืมรหัสผ่านใหม่อีกครั้ง",
          confirmButtonColor: "#ef4444",
        });
        navigate("/forgot-password");
      }
    };
    checkSession();
  }, [navigate]);

  // 🌟 ดักจับการพิมพ์: ห้ามพิมพ์ช่องว่างในช่องรหัสผ่าน
  const handlePasswordChange = (e) => {
    const val = e.target.value;
    if (val.includes(" ")) return; // ถ้ามีช่องว่าง ไม่รับค่า
    setPassword(val);
  };

  // 🌟 ดักจับการพิมพ์: ห้ามพิมพ์ช่องว่างในช่องยืนยันรหัสผ่าน
  const handleConfirmPasswordChange = (e) => {
    const val = e.target.value;
    if (val.includes(" ")) return; // ถ้ามีช่องว่าง ไม่รับค่า
    setConfirmPassword(val);
  };

  // ฟังก์ชันอัปเดตรหัสผ่านใหม่
  const handleUpdatePassword = async (e) => {
    e.preventDefault();

    // 🌟 ดักจับที่ 1: ห้ามเป็นค่าว่าง (เผื่อกรณีคัดลอกมาวาง)
    if (!password.trim() || !confirmPassword.trim()) {
      return Swal.fire({
        icon: "warning",
        title: "ข้อมูลไม่ถูกต้อง",
        text: "กรุณากรอกรหัสผ่านให้ครบถ้วน",
        confirmButtonColor: "#3b82f6",
      });
    }

    // 🌟 ดักจับที่ 2: ตรวจสอบความยาวรหัสผ่าน (ใช้ .trim() ตัดช่องว่างหัวท้ายทิ้งก่อนนับ)
    if (password.trim().length < 6) {
      return Swal.fire({
        icon: "warning",
        title: "รหัสผ่านสั้นเกินไป",
        text: "กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร",
        confirmButtonColor: "#3b82f6",
      });
    }

    // 🌟 ดักจับที่ 3: ตรวจสอบความถูกต้องว่าตรงกันไหม
    if (password !== confirmPassword) {
      return Swal.fire({
        icon: "error",
        title: "รหัสผ่านไม่ตรงกัน",
        text: "กรุณาตรวจสอบการพิมพ์รหัสผ่านทั้งสองช่องอีกครั้ง",
        confirmButtonColor: "#3b82f6",
      });
    }

    try {
      setLoading(true);

      // 1. ดึงข้อมูล User ปัจจุบันที่ได้สิทธิ์จากการคลิกลิงก์
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("ไม่พบข้อมูลผู้ใช้ หรือ Session หมดอายุ กรุณาขอลิงก์ใหม่");

      // 2. เรียก API ของ Supabase เพื่อทำการอัปเดตรหัสผ่านตัวใหม่เข้า Auth
      const { error: updateAuthError } = await supabase.auth.updateUser({
        password: password.trim(), // 🌟 ส่งค่ารหัสผ่านที่ทำความสะอาดแล้ว
      });

      if (updateAuthError) throw updateAuthError;

      // 3. 🌟 อัปเดตเวลา 'updated_at' ลงในตาราง public.users ตาม Schema ใหม่
      const { error: dbError } = await supabase
        .from('users')
        .update({ updated_at: new Date().toISOString() })
        .eq('auth_id', user.id);

      if (dbError) {
        // แจ้งเตือนแค่ใน Console ถ้าบันทึกเวลาลง DB หลักไม่สำเร็จ แต่ไม่ขัดขวางการเปลี่ยนรหัสผ่าน
        console.warn("ไม่สามารถอัปเดตเวลา updated_at ในตาราง users ได้:", dbError);
      }

      await Swal.fire({
        icon: "success",
        title: "เปลี่ยนรหัสผ่านสำเร็จ!",
        text: "ระบบได้ทำการอัปเดตรหัสผ่านใหม่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบอีกครั้ง",
        confirmButtonColor: "#10b981",
      });

      // 🌟 บังคับเตะออกจากระบบ (Sign Out) เพื่อเคลียร์ Session ชั่วคราว
      await logoutAll();

      // 🌟 พาเด้งกลับไปหน้าเข้าสู่ระบบ (Login)
      navigate("/");

    } catch (error) {
      console.error("Update Password Error:", error);
      
      // 🌟 ดักจับที่ 4: แปลง Error Message ภาษาอังกฤษของ Supabase เป็นภาษาไทย
      let errorMsg = error.message;
      if (errorMsg.includes("New password should be different from the old password")) {
        errorMsg = "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม กรุณาตั้งใหม่อีกครั้ง";
      }

      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: errorMsg,
        confirmButtonColor: "#ef4444",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-transparent flex flex-col relative overflow-hidden"
      style={{ fontFamily: "'Kanit', sans-serif" }}
    >
      <Header />

      <main className="flex-1 flex flex-col justify-center items-center p-4 sm:p-6 relative z-10">
        <div className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8 sm:p-10 animate-in fade-in zoom-in duration-300">
          
          {/* Header ของ Card */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto bg-blue-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-inner shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
              ตั้งรหัสผ่านใหม่
            </h1>
            <p className="text-slate-500 text-sm sm:text-[15px]">
              กรุณาตั้งรหัสผ่านใหม่ที่มีความปลอดภัย <br />และจดจำรหัสผ่านนี้ไว้ให้ดี
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            
            {/* Input: รหัสผ่านใหม่ */}
            <div>
              <label className="block text-[14px] font-semibold text-slate-700 mb-2">
                รหัสผ่านใหม่ของคุณ <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="ตั้งรหัสผ่านขั้นต่ำ 6 ตัวอักษร"
                  value={password}
                  onChange={handlePasswordChange}
                  disabled={loading}
                  required
                  className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
                  tabIndex="-1"
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

            {/* Input: ยืนยันรหัสผ่านใหม่ */}
            <div>
              <label className="block text-[14px] font-semibold text-slate-700 mb-2">
                ยืนยันรหัสผ่านใหม่ของคุณ <span className="text-red-500">*</span>
              </label>
              <input
                type={showPassword ? "text" : "password"}
                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                value={confirmPassword}
                onChange={handleConfirmPasswordChange}
                disabled={loading}
                required
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400 disabled:opacity-50"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl transition-all font-medium text-[15px] shadow-md shadow-blue-500/20 flex justify-center items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                  กำลังดำเนินการ...
                </>
              ) : (
                "อัปเดตรหัสผ่านใหม่"
              )}
            </button>

          </form>

        </div>
      </main>
    </div>
  );
}