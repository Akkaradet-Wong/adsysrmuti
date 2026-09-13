// ===============================================
// src/pages/ForgotPassword.jsx
// ===============================================

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Swal from "sweetalert2";

// 🌟 นำเข้า Header
import Header from "../components/Header";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  // 🌟 ดักจับการพิมพ์: ห้ามพิมพ์ช่องว่างในช่องอีเมล
  const handleEmailChange = (e) => {
    const val = e.target.value;
    if (val.includes(" ")) return; // ถ้ามีช่องว่าง ไม่รับค่า
    setEmail(val);
  };

  // ส่งลิงก์รีเซ็ตรหัสผ่าน
  const handleResetPassword = async (e) => {
    e.preventDefault();

    const cleanEmail = email.trim().toLowerCase(); // 🌟 ตัดช่องว่างหัวท้าย และแปลงเป็นพิมพ์เล็กทั้งหมด

    // ตรวจสอบว่ากรอกอีเมลหรือยัง (ดักจับค่าว่างเปล่า)
    if (!cleanEmail) {
      return Swal.fire({
        icon: "warning",
        title: "กรุณากรอกอีเมล",
        text: "ไม่สามารถส่งค่าว่างเปล่าได้",
        confirmButtonColor: "#3b82f6",
      });
    }

    // ตรวจสอบรูปแบบอีเมลเบื้องต้น (Regex)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return Swal.fire({
        icon: "warning",
        title: "รูปแบบอีเมลไม่ถูกต้อง",
        text: "กรุณาตรวจสอบอีเมลของคุณอีกครั้ง",
        confirmButtonColor: "#3b82f6",
      });
    }

    try {
      setLoading(true);

      // ใช้ window.location.origin เพื่อให้ใช้งานได้ทั้งบน localhost และ production
      const redirectUrl = `${window.location.origin}/update-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: redirectUrl,
      });

      if (error) throw error;

      Swal.fire({
        icon: "success",
        title: "ส่งลิงก์สำเร็จ!",
        text: "กรุณาตรวจสอบกล่องจดหมาย (หรือโฟลเดอร์สแปม) ของคุณเพื่อรีเซ็ตรหัสผ่าน",
        confirmButtonColor: "#10b981",
      });

      setEmail("");

    } catch (error) {
      console.error("Reset Password Error:", error);

      let errorTitle = "เกิดข้อผิดพลาด";
      let errorMessage = error.message;

      // จัดการ Error Message บางตัวให้เป็นภาษาไทยที่เข้าใจง่าย
      if (error.message.includes("rate limit")) {
        errorTitle = "ทำรายการบ่อยเกินไป";
        errorMessage = "กรุณารอสักครู่ (ประมาณ 1 ชั่วโมง) แล้วลองใหม่อีกครั้ง";
      } else if (error.message.includes("User not found")) {
        errorTitle = "ไม่พบผู้ใช้";
        errorMessage = "ไม่มีอีเมลนี้อยู่ในระบบ กรุณาตรวจสอบอีกครั้ง";
      }

      Swal.fire({
        icon: "error",
        title: errorTitle,
        text: errorMessage,
        confirmButtonColor: "#ef4444",
      });

    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="h-screen overflow-hidden flex flex-col bg-transparent relative"
      style={{ fontFamily: "'Kanit', sans-serif" }}
    >
      {/* 🌟 เรียกใช้ Header (ถ้าไม่ได้ล็อกอิน จะแสดงโลโก้เฉยๆ) */}
      <Header />

      {/* 🌟 ปรับ Main ให้ตรงกลางและรับ Flex เสมอ */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 overflow-y-auto relative z-10">
        <div className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white p-8 sm:p-10 animate-in fade-in zoom-in duration-300 my-auto">

          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto bg-blue-50 text-blue-600 rounded-[1.5rem] flex items-center justify-center mb-6 shadow-inner shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
              </svg>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 mb-2">
              ลืมรหัสผ่านใช่ไหม?
            </h1>

            <p className="text-slate-500 text-sm sm:text-[15px]">
              ไม่ต้องกังวล! เพียงกรอกอีเมลที่ลงทะเบียนไว้ <br className="hidden sm:block" />
              เราจะส่งลิงก์สำหรับรีเซ็ตรหัสผ่านไปให้
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleResetPassword} className="space-y-6">

            {/* Email Input */}
            <div>
              <label className="block text-[14px] font-semibold text-slate-700 mb-2">
                อีเมลของคุณ
              </label>
              <input
                type="email"
                placeholder="example@rmuti.ac.th"
                value={email}
                onChange={handleEmailChange} // 🌟 เรียกใช้ฟังก์ชันที่ดักการกด Spacebar
                disabled={loading}
                required
                className="w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed"
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
                "ส่งลิงก์รีเซ็ตรหัสผ่าน"
              )}
            </button>

          </form>

          {/* Back to Login */}
          <div className="text-center mt-8 pt-6 border-t border-slate-100">
            <Link
              to="/"
              className="text-[14.5px] font-medium text-slate-500 hover:text-blue-600 transition-colors flex items-center justify-center gap-1.5"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              กลับไปหน้าเข้าสู่ระบบ
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}