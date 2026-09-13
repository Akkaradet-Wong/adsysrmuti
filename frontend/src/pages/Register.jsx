// ===============================================
// src/pages/Register.jsx
// ===============================================
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Swal from "sweetalert2";

// นำเข้า Header
import Header from "../components/Header";

// ข้อมูลคณะและสาขาทั้งหมดของ มทร.อีสาน (ฉบับสมบูรณ์)
// ⚠️ อย่าลืมก๊อปปี้ rmutiData ชุดนี้ ไปแทนที่ในหน้า Profile.jsx ด้วยนะครับ!
const rmutiData = {
  "คณะวิศวกรรมศาสตร์และเทคโนโลยี": [
    "วิศวกรรมคอมพิวเตอร์",
    "วิศวกรรมคอมพิวเตอร์และระบบอัจฉริยะ",
    "วิศวกรรมโยธา",
    "วิศวกรรมไฟฟ้า",
    "วิศวกรรมเครื่องกล",
    "วิศวกรรมอุตสาหการ",
    "วิศวกรรมอิเล็กทรอนิกส์",
    "วิศวกรรมโทรคมนาคม",
    "วิศวกรรมเมคคาทรอนิกส์",
    "วิศวกรรมระบบราง",
    "เทคโนโลยีอุตสาหการ",
    "วิศวกรรมวัสดุและโลหการ"
  ],
  "คณะบริหารธุรกิจ": [
    "ระบบสารสนเทศ (IS)",
    "การบัญชี",
    "การตลาด",
    "การจัดการ",
    "การเงิน",
    "การจัดการโลจิสติกส์และโซ่อุปทาน",
    "การจัดการธุรกิจการบิน",
    "เศรษฐศาสตร์ธุรกิจ",
    "ธุรกิจระหว่างประเทศ"
  ],
  "คณะวิทยาศาสตร์และศิลปศาสตร์": [
    "เทคโนโลยีสารสนเทศ (IT)",
    "วิทยาการคอมพิวเตอร์",
    "คณิตศาสตร์ประยุกต์",
    "เคมีประยุกต์",
    "ฟิสิกส์ประยุกต์",
    "เทคโนโลยีการเกษตรและสิ่งแวดล้อม",
    "ภาษาอังกฤษเพื่อการสื่อสารสากล",
    "นวัตกรรมการท่องเที่ยวและการบริการ",
    "การท่องเที่ยวและอุตสาหกรรมบริการ",
    "วิทยาศาสตร์และเทคโนโลยีการอาหาร"
  ],
  "คณะสถาปัตยกรรมศาสตร์และศิลปกรรมสร้างสรรค์": [
    "สถาปัตยกรรม",
    "สถาปัตยกรรมภายใน",
    "ทัศนศิลป์",
    "การออกแบบนิเทศศิลป์",
    "การออกแบบผลิตภัณฑ์อุตสาหกรรม",
    "เทคโนโลยีมัลติมีเดีย",
    "ศิลปะและการออกแบบ"
  ],
  "สถาบันสหสรรพศาสตร์": [
    "วิศวกรรมซอฟต์แวร์",
    "นวัตกรรมการจัดการอุตสาหกรรม",
    "ภาษาเพื่อการสื่อสารและธุรกิจ",
    "วิทยาศาสตร์สุขภาพและนวัตกรรม"
  ]
};

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState("");
  const [hasStudentCode, setHasStudentCode] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [form, setForm] = useState({
    prefix: "",
    firstName: "",
    lastName: "",
    studentCode: "",
    email: "",
    password: "",
    confirmPassword: "",
    faculty: "",
    department: "",
    phone: "",
    advisorType: "", 
  });

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (["password", "confirmPassword", "email", "studentCode"].includes(name)) {
      if (value.includes(" ")) return; 
    }

    if (name === "firstName" || name === "lastName") {
      const thaiRegex = /^[ก-๙\s]*$/;
      if (!thaiRegex.test(value)) return;
    }

    if (name === "phone") {
      const numberRegex = /^[0-9]*$/;
      if (!numberRegex.test(value)) return;
    }

    // 🌟 ดักจับ: ถ้าเลือก "บุคลากรภายนอก" ให้เคลียร์ค่า คณะ และ สาขา ทิ้ง
    if (name === "advisorType") {
      if (value === "บุคลากรภายนอก") {
        setForm((prev) => ({ ...prev, [name]: value, faculty: "", department: "" }));
      } else {
        setForm((prev) => ({ ...prev, [name]: value }));
      }
      return;
    }

    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.firstName.trim() || !form.lastName.trim()) {
      return Swal.fire({
        icon: "warning",
        title: "ข้อมูลไม่ครบถ้วน",
        text: "กรุณากรอกชื่อและนามสกุลให้ถูกต้อง (ห้ามกรอกเพียงช่องว่าง)",
        confirmButtonColor: "#3b82f6"
      });
    }

    if (role === "student" || (role === "advisor" && hasStudentCode)) {
      const studentCodeVal = form.studentCode.trim();
      const isValidStudentCode = /^\d{11,12}-?\d{1}$/.test(studentCodeVal);
      
      if (!isValidStudentCode) {
        return Swal.fire({
          icon: "warning",
          title: "รหัสประจำตัวไม่ถูกต้อง",
          text: "กรุณากรอกรหัสประจำตัวให้ถูกต้อง (ตัวอย่าง: 00000000000-0)",
          confirmButtonColor: "#3b82f6"
        });
      }
    }

    if (role === "advisor" && !form.advisorType) {
      return Swal.fire({
        icon: "warning",
        title: "ข้อมูลไม่ครบถ้วน",
        text: "กรุณาเลือกประเภทบุคลากร",
        confirmButtonColor: "#3b82f6"
      });
    }

    if (form.phone && form.phone.length < 10) {
      return Swal.fire({
        icon: "warning",
        title: "เบอร์โทรศัพท์ไม่ครบถ้วน",
        text: "กรุณากรอกเบอร์โทรศัพท์ให้ครบ 10 หลัก หรือเว้นว่างไว้หากไม่มี",
        confirmButtonColor: "#3b82f6"
      });
    }

    if (form.password.trim().length < 6) {
      return Swal.fire({
        icon: "warning",
        title: "รหัสผ่านสั้นเกินไป",
        text: "กรุณาตั้งรหัสผ่านอย่างน้อย 6 ตัวอักษร (ไม่นับช่องว่าง)",
        confirmButtonColor: "#3b82f6"
      });
    }

    if (form.password !== form.confirmPassword) {
      return Swal.fire({
        icon: "error",
        title: "รหัสผ่านไม่ตรงกัน",
        text: "กรุณาตรวจสอบการกรอกรหัสผ่านอีกครั้ง",
        confirmButtonColor: "#3b82f6"
      });
    }

    const confirmResult = await Swal.fire({
      title: "ยืนยันการสมัครสมาชิก?",
      text: "โปรดตรวจสอบข้อมูลของคุณให้ถูกต้องก่อนกดยืนยัน",
      icon: "question",
      showCancelButton: true, reverseButtons: true,
      confirmButtonColor: "#3b82f6",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "ยืนยันการสมัคร",
      cancelButtonText: "กลับไปแก้ไข"
    });

    if (!confirmResult.isConfirmed) return;

    setLoading(true);

    try {
      const cleanEmail = form.email.trim().toLowerCase();

      let finalAccountCode = "";
      if (role === "student" || (role === "advisor" && hasStudentCode)) {
        finalAccountCode = form.studentCode.trim();
      } else {
        finalAccountCode = "ADV" + Math.floor(100000 + Math.random() * 900000);
      }

      // ตรวจสอบว่ารหัสนักศึกษาซ้ำหรือไม่ ก่อนสร้างบัญชีในระบบ
      if (finalAccountCode) {
        const { data: existingUser } = await supabase
          .from("users")
          .select("account_code")
          .eq("account_code", finalAccountCode)
          .maybeSingle();

        if (existingUser) {
          setLoading(false);
          return Swal.fire({
            icon: "error",
            title: "รหัสนี้ถูกใช้งานแล้ว",
            text: "รหัสนักศึกษาหรือรหัสบุคลากรนี้มีอยู่ในระบบแล้ว กรุณาตรวจสอบอีกครั้ง",
            confirmButtonColor: "#3b82f6"
          });
        }
      }

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: form.password,
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("ไม่สามารถสร้างบัญชีผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง");
      }

      const dbRole = "STUDENT"; 
      const requestedRole = role === "advisor" ? "ADVISOR" : "STUDENT";
      const isAccepted = role === "student";

      // 🌟 ตรวจเช็คว่าเป็นบุคลากรภายนอกหรือไม่
      const isExternal = role === "advisor" && form.advisorType === "บุคลากรภายนอก";

      const { error: dbError } = await supabase.from("users").insert([
        {
          auth_id: authData.user.id, 
          email: cleanEmail,
          prefix: form.prefix || null, 
          first_name: form.firstName.trim() || "-", 
          last_name: form.lastName.trim() || "-",   
          role: dbRole, 
          requested_role: requestedRole,
          is_accepted: isAccepted,
          account_code: finalAccountCode,
          phone: form.phone || null,
          faculty: isExternal ? null : (form.faculty || null),
          major: isExternal ? null : (form.department || null),
          expertise: null,
          advisor_type: role === "advisor" ? form.advisorType : null 
        },
      ]);

      if (dbError) {
        throw dbError;
      }

      if (role === "student") {
        const { error: studentProfileError } = await supabase
          .from("student_profiles")
          .insert([{ user_id: authData.user.id }]);
          
        if (studentProfileError) throw studentProfileError;
      } else if (role === "advisor") {
        const { error: advisorProfileError } = await supabase
          .from("advisor_profiles")
          .insert([{ 
            user_id: authData.user.id,
            max_groups: 5,
            is_accepting_students: true
          }]);
          
        if (advisorProfileError) throw advisorProfileError;
      }

      Swal.fire({
        icon: "success",
        title: "สมัครสมาชิกสำเร็จ!",
        html: role === "advisor" 
              ? `<div style="font-family: 'Kanit', sans-serif; text-align: center;">
                   <p class="text-slate-700 font-medium mb-2">ระบบได้บันทึกบัญชีของท่านแล้ว (รอผู้ดูแลระบบอนุมัติสิทธิ์ 1-2 วัน)</p>
                   <div class="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-amber-900 text-sm mt-3 text-left shadow-sm">
                     <div class="flex items-center gap-2 font-bold text-amber-800 mb-1">
                       <span>📌 คำแนะนำสำคัญสำหรับอาจารย์:</span>
                     </div>
                     <p class="text-amber-700 text-xs sm:text-sm leading-relaxed">
                       เมื่อเข้าสู่ระบบสำเร็จ กรุณาไปกรอก <b>ความเชี่ยวชาญ / สายที่ถนัด (Expertise)</b> ที่หน้าตั้งค่าโปรไฟล์ เพื่อเลือกสายที่ท่านถนัดสำหรับให้นักศึกษาค้นหาและจับคู่โครงงาน
                     </p>
                   </div>
                 </div>`
              : "กรุณาตรวจสอบและคลิกลิงก์ยืนยันตัวตนในอีเมลของคุณก่อนเข้าสู่ระบบ",
        confirmButtonColor: "#10b981",
        confirmButtonText: "รับทราบ"
      }).then(() => {
        navigate("/"); 
      });

    } catch (err) {
      console.error(err);
      let errorMessage = err.message;
      let errorTitle = "เกิดข้อผิดพลาด";

      if (err.message.includes("User already registered") || err.message.includes("duplicate key value")) {
        errorTitle = "ข้อมูลซ้ำในระบบ";
        errorMessage = "อีเมลหรือรหัสประจำตัวนี้ถูกใช้งานไปแล้ว กรุณาใช้อีเมลอื่น หรือเข้าสู่ระบบแทน";
      } else if (err.message.includes("rate limit") || err.message.includes("Email rate limit exceeded")) {
        errorTitle = "ทำรายการบ่อยเกินไป";
        errorMessage = "คุณพยายามสมัครสมาชิกถี่เกินไป กรุณารอสักครู่ (ประมาณ 1 ชั่วโมง) แล้วลองใหม่อีกครั้ง";
      } else if (err.message.includes("account_code_key")) {
         errorTitle = "รหัสประจำตัวซ้ำ";
         errorMessage = "รหัสประจำตัวนี้มีอยู่ในระบบแล้ว กรุณาตรวจสอบอีกครั้ง";
      }

      Swal.fire({
        icon: "error",
        title: errorTitle,
        text: errorMessage,
        confirmButtonColor: "#ef4444"
      });
    } finally {
      setLoading(false);
    }
  };

  const facultyOptions = Object.keys(rmutiData);
  const departmentOptions = form.faculty ? rmutiData[form.faculty] : [];

  const inputClass = "w-full bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-3.5 py-2.5 text-[14.5px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all placeholder:text-slate-400 disabled:opacity-50 disabled:bg-slate-100 disabled:cursor-not-allowed";
  const labelClass = "block text-[13.5px] font-semibold text-slate-700 mb-1.5";
  const isStudentCodeDisabled = role === "advisor" && !hasStudentCode;
  
  // 🌟 เช็คว่าเป็นบุคลากรภายนอกหรือไม่ เพื่อนำไปปิดช่องคณะและสาขา
  const isExternal = role === "advisor" && form.advisorType === "บุคลากรภายนอก";

  const handleResetRole = () => {
    setRole("");
    setHasStudentCode(false);
    setForm({
      ...form, 
      studentCode: "", 
      prefix: "",
      faculty: "",      
      department: "",    
      advisorType: "" 
    });
  };

  return (
    <div 
      className="h-[100dvh] flex flex-col bg-transparent text-slate-800 relative overflow-hidden"
      style={{ fontFamily: "'Kanit', sans-serif" }}
    >
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center p-3 sm:p-6 overflow-hidden relative z-10">
        <div className="w-full max-w-4xl flex flex-col h-full max-h-[850px]">
          
          <div className="flex justify-center items-center gap-3 sm:gap-4 mb-4 shrink-0 mt-2 sm:mt-0">
            <div className={`flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base font-semibold transition-colors ${role ? "text-emerald-500" : "text-blue-600"}`}>
              <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs text-white font-bold shadow-sm ${role ? "bg-emerald-500" : "bg-blue-600"}`}>1</div>
              เลือกสถานะ
            </div>
            <div className={`w-8 sm:w-16 h-0.5 sm:h-1 rounded-full transition-colors ${role ? "bg-emerald-500" : "bg-slate-200"}`}></div>
            <div className={`flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base font-semibold transition-colors ${role ? "text-blue-600" : "text-slate-400"}`}>
              <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-xs shadow-sm ${role ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>2</div>
              กรอกข้อมูล
            </div>
          </div>

          {!role ? (
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 shrink-0 max-w-3xl mx-auto w-full px-2 mt-4">
              <div
                onClick={() => setRole("student")}
                className="group bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 hover:border-blue-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer text-center flex flex-col items-center justify-center min-h-[180px] sm:min-h-[220px]"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-3xl sm:text-4xl mb-3 sm:mb-4 group-hover:scale-110 transition-transform">🎓</div>
                <h2 className="text-lg sm:text-2xl font-bold text-slate-800 mb-1 sm:mb-2">นักศึกษา</h2>
                <p className="text-slate-500 text-xs sm:text-sm">สมัครเพื่อจัดการโครงงาน<br/>ติดตามสถานะ และส่งงาน</p>
              </div>

              <div
                onClick={() => setRole("advisor")}
                className="group bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-100 hover:border-orange-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer text-center flex flex-col items-center justify-center min-h-[180px] sm:min-h-[220px]"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center text-3xl sm:text-4xl mb-3 sm:mb-4 group-hover:scale-110 transition-transform">👨‍🏫</div>
                <h2 className="text-lg sm:text-2xl font-bold text-slate-800 mb-1 sm:mb-2">อาจารย์</h2>
                <p className="text-slate-500 text-xs sm:text-sm">ดูแลนักศึกษา<br/>ให้คำปรึกษา และประเมินโครงงาน</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 flex flex-col flex-1 overflow-hidden mx-1 sm:mx-2">
              
              <div className="px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                <div>
                  <h1 className="text-lg sm:text-2xl font-bold text-slate-800">
                    ลงทะเบียน{role === "advisor" ? "อาจารย์ / บุคลากร" : "นักศึกษา"}
                  </h1>
                </div>
                <button
                  onClick={handleResetRole}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors flex items-center gap-1.5"
                >
                  ← เปลี่ยนสถานะ
                </button>
              </div>

              <div className="px-5 sm:px-8 py-5 overflow-y-auto custom-scrollbar flex-1">
                <form id="registerForm" onSubmit={handleSubmit} className="flex flex-col gap-5 sm:gap-6 pb-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
                    
                    <div>
                      <label className={labelClass}>คำนำหน้าและชื่อจริง (ภาษาไทย) <span className="text-red-500">*</span></label>
                      <div className="flex gap-2">
                        <select
                          name="prefix"
                          value={form.prefix || ""}
                          onChange={handleChange}
                          required
                          className="w-[90px] sm:w-[100px] shrink-0 bg-slate-50 border border-slate-200 text-slate-900 rounded-xl px-2 py-2.5 text-[14.5px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                        >
                          <option value="">เลือก</option>
                          {role === "student" && (
                            <>
                              <option value="ด.ช.">ด.ช.</option>
                              <option value="ด.ญ.">ด.ญ.</option>
                              <option value="นาย">นาย</option>
                              <option value="นางสาว">นางสาว</option>
                              <option value="นาง">นาง</option>
                            </>
                          )}
                          {role === "advisor" && (
                            <>
                              <option value="นาย">นาย</option>
                              <option value="นางสาว">นางสาว</option>
                              <option value="นาง">นาง</option>
                              <option value="ดร.">ดร.</option>
                              <option value="ผศ.">ผศ.</option>
                              <option value="รศ.">รศ.</option>
                            </>
                          )}
                        </select>
                        <input
                          type="text"
                          name="firstName"
                          autoComplete="given-name"
                          value={form.firstName || ""}
                          onChange={handleChange}
                          required
                          placeholder="ชื่อจริง (ภาษาไทย)"
                          className={`flex-1 ${inputClass}`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>นามสกุล (ภาษาไทย) <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        name="lastName"
                        autoComplete="family-name"
                        value={form.lastName || ""}
                        onChange={handleChange}
                        required
                        placeholder="นามสกุล (ภาษาไทย)"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="flex items-center justify-between text-[13.5px] font-semibold text-slate-700 mb-1.5">
                        <span>รหัสประจำตัว {(role === "student" || hasStudentCode) && <span className="text-red-500">*</span>}</span>
                        {role === "advisor" && (
                          <label className="flex items-center gap-1.5 cursor-pointer hover:text-blue-600 transition-colors">
                            <input 
                              type="checkbox" 
                              checked={hasStudentCode} 
                              onChange={() => {
                                setHasStudentCode(!hasStudentCode);
                                if (hasStudentCode) setForm({...form, studentCode: ""}); 
                              }} 
                              className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 focus:ring-blue-500" 
                            />
                            <span className="text-xs font-normal">มีรหัสประจำตัว / ศิษย์เก่า</span>
                          </label>
                        )}
                      </label>
                      <input
                        type="text"
                        name="studentCode"
                        value={form.studentCode || ""}
                        onChange={handleChange}
                        required={!isStudentCodeDisabled}
                        disabled={isStudentCodeDisabled}
                        placeholder={isStudentCodeDisabled ? "ระบบจะสร้างให้อัตโนมัติ" : "ตัวอย่าง: 00000000000-0"} 
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>อีเมล <span className="text-red-500">*</span></label>
                      <input
                        type="email"
                        name="email"
                        autoComplete="email"
                        value={form.email || ""}
                        onChange={handleChange}
                        required
                        placeholder="กรอกอีเมลของคุณ"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className={labelClass}>เบอร์โทรศัพท์ติดต่อ</label>
                      <input 
                        type="tel" 
                        name="phone" 
                        autoComplete="tel" 
                        maxLength={10}
                        value={form.phone || ""} 
                        onChange={handleChange} 
                        placeholder="ตัวเลข 10 หลัก (ไม่บังคับ)" 
                        className={inputClass} 
                      />
                    </div>

                    {/* 🌟 ย้ายประเภทบุคลากรมาไว้ตรงนี้ก่อนคณะ/สาขา */}
                    {role === "advisor" ? (
                      <div>
                        <label className={labelClass}>ประเภทบุคลากร <span className="text-red-500">*</span></label>
                        <select 
                          name="advisorType" 
                          value={form.advisorType || ""} 
                          onChange={handleChange} 
                          required 
                          className={inputClass}
                        >
                          <option value="">-- เลือกประเภทบุคลากร --</option>
                          <option value="อาจารย์ในสาขา">อาจารย์ในสาขา</option>
                          <option value="อาจารย์นอกสาขา">อาจารย์นอกสาขา</option>
                          <option value="บุคลากรภายนอก">บุคลากรภายนอก</option>
                        </select>
                      </div>
                    ) : (
                      <div className="hidden sm:block"></div>
                    )}

                    {/* 🌟 คณะและสาขา จะแสดงดอกจันและบังคับกรอกเฉพาะเมื่อไม่ใช่บุคลากรภายนอก */}
                    <div>
                      <label className={labelClass}>คณะ {!isExternal && <span className="text-red-500">*</span>}</label>
                      <select name="faculty" value={form.faculty || ""} onChange={handleChange} required={!isExternal} disabled={isExternal} className={inputClass}>
                        <option value="">-- เลือกคณะ --</option>
                        {facultyOptions.map((faculty) => (
                          <option key={faculty} value={faculty}>{faculty}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>สาขา {!isExternal && <span className="text-red-500">*</span>}</label>
                      <select name="department" value={form.department || ""} onChange={handleChange} required={!isExternal} disabled={isExternal || !form.faculty} className={inputClass}>
                        <option value="">-- เลือกสาขา --</option>
                        {departmentOptions.map((dep) => (
                          <option key={dep} value={dep}>{dep}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className={labelClass}>รหัสผ่าน <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"} 
                          name="password" 
                          autoComplete="new-password"
                          value={form.password || ""} 
                          onChange={handleChange} 
                          required 
                          placeholder="ขั้นต่ำ 6 ตัวอักษร" 
                          className={`${inputClass} pr-10`} 
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-blue-600 transition-colors"
                          tabIndex="-1"
                        >
                          {showPassword ? (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                          )}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={labelClass}>ยืนยันรหัสผ่าน <span className="text-red-500">*</span></label>
                      <input 
                        type={showPassword ? "text" : "password"} 
                        name="confirmPassword" 
                        autoComplete="new-password"
                        value={form.confirmPassword || ""} 
                        onChange={handleChange} 
                        required 
                        placeholder="กรอกรหัสผ่านอีกครั้ง" 
                        className={inputClass} 
                      />
                    </div>
                  </div>

                  <div className="flex items-start gap-3 text-slate-600 mt-2 px-1 bg-blue-50/50 border border-blue-100 p-4 rounded-2xl">
                    <div className="mt-0.5 text-blue-500 bg-blue-100 p-1.5 rounded-full shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                    </div>
                    <p className="text-[13px] leading-relaxed">
                      <strong className="text-slate-800 font-medium">โปรดตรวจสอบอีเมลของคุณ:</strong> ระบบจะส่งลิงก์สำหรับยืนยันตัวตนไปยังอีเมลที่คุณระบุไว้ 
                      <br/>(หากไม่พบในกล่องข้อความหลัก โปรดตรวจสอบใน <strong className="font-medium underline decoration-blue-300">โฟลเดอร์จดหมายขยะ / Spam</strong>)
                    </p>
                  </div>

                </form>
              </div>

              <div className="px-5 sm:px-8 py-4 bg-slate-50 border-t border-slate-100 flex flex-col-reverse sm:flex-row justify-end items-center gap-3 shrink-0">
                <Link
                  to="/"
                  className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-center text-[14.5px] font-semibold hover:bg-slate-100 hover:text-slate-900 transition-all shadow-sm w-full sm:w-auto"
                >
                  ยกเลิก
                </Link>
                <button
                  type="submit"
                  form="registerForm"
                  disabled={loading}
                  className="px-8 py-2.5 rounded-xl bg-blue-600 text-white text-[14.5px] font-semibold hover:bg-blue-700 focus:ring-4 focus:ring-blue-500/30 transition-all shadow-md shadow-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed min-w-[140px] w-full sm:w-auto"
                >
                  {loading ? "กำลังดำเนินการ..." : "ยืนยันการสมัคร"}
                </button>
              </div>

            </div>
          )}
        </div>
      </main>


    </div>
  );
}