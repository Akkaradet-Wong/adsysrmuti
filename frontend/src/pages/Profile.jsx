// ===============================================
// src/pages/Profile.jsx
// ===============================================
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import Swal from "sweetalert2";
import Header from "../components/Header";
import Cropper from "react-easy-crop";
import { deleteStorageFile } from "../lib/storageUtils";
import { logoutAll } from "../lib/authUtils";

// 🌟 ข้อมูลคณะและสาขาฉบับสมบูรณ์ (อัปเดตล่าสุด)
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

// ตัวเลือกความเชี่ยวชาญสำหรับ Checkbox
const expertiseOptionsList = [
  "ฮาร์ดแวร์ (Hardware)",
  "ซอฟต์แวร์ (Software)",
  "ถนัดทั้ง 2 อย่าง (Hardware & Software)",
  "ปัญญาประดิษฐ์และข้อมูล (AI & Data)",
  "เครือข่ายและความปลอดภัย (Network & Security)",
  "อื่นๆ (โปรดระบุใน Bio)"
];

export default function Profile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [authUser, setAuthUser] = useState(null);
  const [readOnlyData, setReadOnlyData] = useState({});

  const [imageSrc, setImageSrc] = useState(null); 
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [showCropModal, setShowCropModal] = useState(false); 

  // State สำหรับ Dropdown Checkbox ความเชี่ยวชาญ
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // State สำหรับ Modal เปลี่ยนรหัสผ่าน
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    account_code: "", 
    phone: "",
    bio: "",
    expertise: "",
    profile_image: "",
    faculty: "", 
    major: "",   
  });

  // คำนวณระดับความปลอดภัยของรหัสผ่านใหม่
  const getPasswordStrength = (pass) => {
    if (!pass) return { text: "", color: "text-slate-400", bar: 0, bg: "bg-slate-200" };
    if (pass.length < 6) return { text: "สั้นเกินไป", color: "text-rose-500", bar: 25, bg: "bg-rose-500" };
    
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 2) return { text: "ปานกลาง", color: "text-amber-500", bar: 50, bg: "bg-amber-500" };
    if (score <= 4) return { text: "ปลอดภัย", color: "text-blue-500", bar: 75, bg: "bg-blue-500" };
    return { text: "ปลอดภัยมาก", color: "text-emerald-600", bar: 100, bg: "bg-emerald-500" };
  };

  // ขอรับลิงก์รีเซ็ตรหัสผ่านทางอีเมล
  const handleForgotPassword = async () => {
    if (!readOnlyData?.email) return;
    const { isConfirmed } = await Swal.fire({
      title: "ส่งลิงก์รีเซ็ตรหัสผ่าน?",
      html: `ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปยังอีเมล<br/><b class="text-blue-600">${readOnlyData.email}</b>`,
      icon: "question",
      showCancelButton: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "ส่งลิงก์รีเซ็ต",
      cancelButtonText: "ยกเลิก",
      reverseButtons: true,
      customClass: { popup: "rounded-2xl" }
    });

    if (!isConfirmed) return;

    try {
      setSendingReset(true);
      const { error } = await supabase.auth.resetPasswordForEmail(readOnlyData.email, {
        redirectTo: `${window.location.origin}/update-password`
      });
      if (error) throw error;
      Swal.fire({
        icon: "success",
        title: "ส่งลิงก์สำเร็จ!",
        text: `กรุณาตรวจสอบกล่องข้อความหรือโฟลเดอร์อีเมลขยะที่ ${readOnlyData.email}`,
        confirmButtonColor: "#2563eb",
        customClass: { popup: "rounded-2xl" }
      });
    } catch (err) {
      console.error(err);
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: err.message || "ไม่สามารถส่งลิงก์รีเซ็ตรหัสผ่านได้",
        confirmButtonColor: "#ef4444",
        customClass: { popup: "rounded-2xl" }
      });
    } finally {
      setSendingReset(false);
    }
  };

  // ดำเนินการเปลี่ยนรหัสผ่าน
  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      return Swal.fire({
        icon: "warning",
        title: "กรอกข้อมูลไม่ครบ",
        text: "กรุณากรอกรหัสผ่านให้ครบทุกช่อง",
        confirmButtonColor: "#3b82f6",
        customClass: { popup: "rounded-2xl" }
      });
    }

    if (newPassword.trim().length < 6) {
      return Swal.fire({
        icon: "warning",
        title: "รหัสผ่านสั้นเกินไป",
        text: "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร",
        confirmButtonColor: "#3b82f6",
        customClass: { popup: "rounded-2xl" }
      });
    }

    if (newPassword !== confirmPassword) {
      return Swal.fire({
        icon: "error",
        title: "รหัสผ่านไม่ตรงกัน",
        text: "กรุณาตรวจสอบรหัสผ่านใหม่และยืนยันรหัสผ่านอีกครั้ง",
        confirmButtonColor: "#ef4444",
        customClass: { popup: "rounded-2xl" }
      });
    }

    if (currentPassword === newPassword) {
      return Swal.fire({
        icon: "warning",
        title: "รหัสผ่านซ้ำเดิม",
        text: "รหัสผ่านใหม่ต้องไม่ตรงกับรหัสผ่านปัจจุบัน",
        confirmButtonColor: "#f59e0b",
        customClass: { popup: "rounded-2xl" }
      });
    }

    // 🌟 ถามยืนยันก่อนเปลี่ยนรหัสผ่าน
    const confirmResult = await Swal.fire({
      title: "ยืนยันการเปลี่ยนรหัสผ่าน?",
      text: "คุณต้องการเปลี่ยนรหัสผ่านใหม่และเข้าสู่ระบบใหม่อีกครั้งใช่หรือไม่?",
      icon: "question",
      showCancelButton: true,
      reverseButtons: true,
      confirmButtonColor: "#2563eb",
      cancelButtonColor: "#94a3b8",
      confirmButtonText: "ใช่, ยืนยันเปลี่ยนรหัสผ่าน",
      cancelButtonText: "ยกเลิก",
      customClass: { popup: "rounded-2xl" }
    });

    if (!confirmResult.isConfirmed) return;

    try {
      setChangingPassword(true);

      // 1. ยืนยันรหัสผ่านปัจจุบัน
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: readOnlyData.email,
        password: currentPassword.trim(),
      });

      if (signInError) {
        return Swal.fire({
          icon: "error",
          title: "รหัสผ่านปัจจุบันไม่ถูกต้อง",
          text: "กรุณาตรวจสอบรหัสผ่านปัจจุบัน หรือกด 'ลืมรหัสผ่าน?' เพื่อรับลิงก์รีเซ็ต",
          confirmButtonColor: "#ef4444",
          customClass: { popup: "rounded-2xl" }
        });
      }

      // 2. อัปเดตรหัสผ่านใหม่
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword.trim(),
      });

      if (updateError) throw updateError;

      // 3. บันทึกเวลาแก้ไข
      if (readOnlyData?.auth_id) {
        await supabase.from("users").update({ updated_at: new Date().toISOString() }).eq("auth_id", readOnlyData.auth_id);
      }

      // 4. แสดง Popup แจ้งเตือนสำเร็จ
      await Swal.fire({
        icon: "success",
        title: "เปลี่ยนรหัสผ่านสำเร็จ!",
        text: "ระบบจะนำคุณไปยังหน้าเข้าสู่ระบบเพื่อเข้าใช้งานด้วยรหัสผ่านใหม่",
        confirmButtonColor: "#2563eb",
        confirmButtonText: "เข้าสู่ระบบ",
        customClass: { popup: "rounded-2xl" }
      });

      // 5. ปิด Modal เคลียร์ State และ Sign Out เด้งไปหน้า Login
      setShowPasswordModal(false);
      await logoutAll();
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Change Password Error:", err);
      Swal.fire({
        icon: "error",
        title: "เกิดข้อผิดพลาด",
        text: err.message || "ไม่สามารถเปลี่ยนรหัสผ่านได้ กรุณาลองใหม่อีกครั้ง",
        confirmButtonColor: "#ef4444",
        customClass: { popup: "rounded-2xl" }
      });
    } finally {
      setChangingPassword(false);
    }
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          navigate("/");
          return;
        }
        
        setAuthUser(session.user);

        const { data, error } = await supabase
          .from("users")
          .select(`
            first_name, last_name, account_code, phone, bio, 
            profile_image, faculty, major, expertise, email,
            role, requested_role, auth_id, advisor_type
          `)
          .eq("auth_id", session.user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const fac = data.faculty?.trim() || "";
          const maj = data.major?.trim() || "";
          let loadedExpertise = data.expertise || "";
          
          if (fac && maj) {
            const autoGen = `${fac} - ${maj}`;
            // Remove any trailing/leading spaces
            const cleanLoaded = loadedExpertise.trim();
            if (cleanLoaded === autoGen || cleanLoaded === `${fac}-${maj}` || cleanLoaded === `${fac} -${maj}` || cleanLoaded === `${fac}- ${maj}`) {
              loadedExpertise = "";
            } else if (cleanLoaded.includes(fac) && cleanLoaded.includes(maj)) {
              // If it includes both faculty and major, it's definitely the auto-generated one (or part of it).
              // Let's filter it out.
              loadedExpertise = loadedExpertise.split(',')
                .map(s => s.trim())
                .filter(s => !(s.includes(fac) && s.includes(maj)))
                .join(', ');
            }
          }

          setForm({
            first_name: data.first_name || "",
            last_name: data.last_name || "",
            account_code: data.account_code || "", 
            phone: data.phone || "",
            bio: data.bio || "",
            profile_image: data.profile_image || "",
            faculty: fac, 
            major: maj,    
            expertise: loadedExpertise,
          });

          setReadOnlyData({
            email: data.email,
            role: data.role,
            requested_role: data.requested_role,
            auth_id: data.auth_id,
            original_account_code: data.account_code,
            advisor_type: data.advisor_type 
          });
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  // ซ่อน Dropdown เมื่อคลิกที่อื่น
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "account_code" && value.includes(" ")) return;

    if (name === "faculty") {
      setForm((prev) => ({ ...prev, faculty: value, major: "" })); // รีเซ็ตสาขาเมื่อเปลี่ยนคณะ
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  // จัดการการเลือก Checkbox ความเชี่ยวชาญ
  const handleCheckboxChange = (option) => {
    let currentExpertise = form.expertise ? form.expertise.split(",").map(item => item.trim()).filter(Boolean) : [];
    if (currentExpertise.includes(option)) {
      currentExpertise = currentExpertise.filter(item => item !== option);
    } else {
      currentExpertise.push(option);
    }
    setForm(prev => ({ ...prev, expertise: currentExpertise.join(", ") }));
  };
  
  // ==========================================
  // 📸 ส่วนจัดการ Crop รูปภาพ
  // ==========================================
  const onFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      let imageDataUrl = await readFile(file);
      setImageSrc(imageDataUrl);
      setShowCropModal(true); 
    }
  };

  const readFile = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result), false);
      reader.readAsDataURL(file);
    });
  };

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc, pixelCrop) => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height, 0, 0, pixelCrop.width, pixelCrop.height);
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas is empty'));
        blob.name = 'cropped.jpeg';
        resolve(blob); 
      }, 'image/jpeg');
    });
  };

  const handleSaveCroppedImage = async () => {
    try {
      setUploading(true);
      setShowCropModal(false); 
      const oldImageUrl = form.profile_image;
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels);
      const fileName = `${authUser.id}-${Date.now()}.jpeg`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, croppedImageBlob, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
      setForm((prev) => ({ ...prev, profile_image: publicUrl }));

      // 🧹 ลบรูปโปรไฟล์เก่าออกจาก Supabase Storage ทันที
      if (oldImageUrl && oldImageUrl.includes('/avatars/')) {
        await deleteStorageFile('avatars', oldImageUrl);
      }

      Swal.fire({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 3000, icon: 'success', title: 'อัปโหลดรูปสำเร็จ' });
    } catch (e) {
      console.error(e);
      Swal.fire({ icon: "error", title: "อัปโหลดไม่สำเร็จ", text: "เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ" });
    } finally {
      setUploading(false);
      setImageSrc(null);
      setZoom(1); 
    }
  };

  // ==========================================
  // 💾 บันทึกข้อมูล
  // ==========================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (form.account_code && form.account_code.trim() !== readOnlyData.original_account_code) {
      const { data: existingUser } = await supabase
        .from("users")
        .select("auth_id")
        .eq("account_code", form.account_code.trim())
        .maybeSingle();

      if (existingUser) {
        return Swal.fire({ icon: "error", title: "รหัสประจำตัวซ้ำ", text: "รหัสประจำตัวนี้ถูกใช้งานในระบบแล้ว", confirmButtonColor: "#ef4444" });
      }
    }

    // 🌟 ตรวจสอบสิทธิ์: บังคับให้อาจารย์ในสาขาต้องเลือกความเชี่ยวชาญอย่างน้อย 1 หัวข้อ
    const userRole = (readOnlyData?.role || form.role || "").toUpperCase();
    const isBranchAdvisor = userRole === "ADVISOR" && readOnlyData?.advisor_type === "อาจารย์ในสาขา";
    
    if (isBranchAdvisor && (!form.expertise || form.expertise.trim() === "")) {
      setIsDropdownOpen(true);
      return Swal.fire({
        icon: "warning",
        title: "กรุณาระบุสายที่ถนัด",
        text: "อาจารย์ในสาขาจำเป็นต้องเลือกความเชี่ยวชาญ / สายที่ถนัด (Expertise) อย่างน้อย 1 หัวข้อ",
        confirmButtonColor: "#f59e0b",
        confirmButtonText: "ตกลง"
      });
    }

    const confirmResult = await Swal.fire({
      title: "ยืนยันการบันทึก?", text: "คุณต้องการเปลี่ยนแปลงข้อมูลโปรไฟล์ใช่หรือไม่?",
      icon: "question", showCancelButton: true, reverseButtons: true, confirmButtonColor: "#3b82f6", cancelButtonColor: "#94a3b8",
      confirmButtonText: "ใช่, บันทึกเลย", cancelButtonText: "ยกเลิก"
    });

    if (!confirmResult.isConfirmed) return; 

    setSaving(true);
    try {
      const { error: userError } = await supabase
        .from("users")
        .update({
          first_name: form.first_name,
          last_name: form.last_name,
          account_code: form.account_code.trim() || null, 
          faculty: form.faculty || null,
          major: form.major || null,
          phone: form.phone || null,
          bio: form.bio,
          expertise: form.expertise || null,
          profile_image: form.profile_image,
          updated_at: new Date().toISOString(),
        })
        .eq("auth_id", readOnlyData.auth_id);

      if (userError) throw userError;

      Swal.fire({ icon: "success", title: "บันทึกข้อมูลสำเร็จ", text: "โปรไฟล์อัปเดตเรียบร้อยแล้ว", confirmButtonColor: "#3b82f6" })
      .then(() => window.location.reload());
    } catch (error) {
      console.error("Save Error:", error);
      Swal.fire({ icon: "error", title: "เกิดข้อผิดพลาด", text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full bg-white border border-slate-200 text-slate-800 rounded-xl px-4 py-2.5 text-[14px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 disabled:opacity-50 disabled:bg-slate-50";
  const labelClass = "text-[13px] font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5";

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  let displayRole = readOnlyData.role === "ADVISOR" ? "อาจารย์" : readOnlyData.role === "ADMIN" ? "ผู้ดูแลระบบ" : "นักศึกษา";
  if (readOnlyData.role === "ADVISOR" && readOnlyData.advisor_type) {
    displayRole += ` (${readOnlyData.advisor_type})`;
  }

  // 🌟 [ส่วนเพิ่มเติม] ลอจิกป้องกันข้อมูลหายจาก Dropdown
  const facultyOptions = Object.keys(rmutiData);
  const hasUnknownFaculty = Boolean(form.faculty && !facultyOptions.includes(form.faculty));
  
  const majorOptions = form.faculty && rmutiData[form.faculty] ? rmutiData[form.faculty] : [];
  const hasUnknownMajor = Boolean(form.major && !majorOptions.includes(form.major));
  
  // 🌟 ตรวจสอบว่าเป็นอาจารย์ในสาขาหรือไม่ (เฉพาะอาจารย์ในสาขาเท่านั้นที่จะแสดงและกรอกความเชี่ยวชาญ)
  const userRole = (readOnlyData?.role || form.role || "").toUpperCase();
  const isBranchAdvisor = userRole === "ADVISOR" && readOnlyData?.advisor_type === "อาจารย์ในสาขา";

  return (
    <div className="min-h-screen w-full flex flex-col bg-transparent text-slate-800 relative transition-colors duration-200" style={{ fontFamily: "'Kanit', sans-serif" }}>
      <Header user={authUser} fullName={`${form.first_name} ${form.last_name}`} profileImage={form.profile_image} role={readOnlyData.role} />

      <main className="flex-1 w-full max-w-6xl mx-auto p-4 sm:p-8 flex flex-col relative z-10">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">ตั้งค่าโปรไฟล์</h1>
            <p className="text-slate-500 text-sm mt-1">จัดการข้อมูลส่วนตัว รูปภาพ และช่องทางการติดต่อของคุณ</p>
          </div>
          <button type="button" onClick={() => navigate(-1)} className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" /></svg>
            กลับหน้าหลัก
          </button>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* ซ้าย: Profile Card */}
          <div className="w-full lg:w-[340px] shrink-0 lg:sticky lg:top-6">
            <div className="bg-white rounded-[1.5rem] shadow-sm border border-slate-100 relative overflow-hidden">
              <div className="w-full h-[120px] bg-gradient-to-r from-blue-500 to-[#38bdf8]"></div>
              <div className="flex flex-col items-center px-6 pb-8 relative text-center">
                <div className="w-[104px] h-[104px] rounded-full overflow-hidden border-[4px] border-white shadow-sm bg-slate-100 absolute -top-[52px] flex items-center justify-center text-3xl text-slate-400 z-10 group cursor-pointer">
                  {form.profile_image ? (
                    <img src={form.profile_image} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-medium text-slate-300">{form.first_name.charAt(0) || "U"}</span>
                  )}
                  <label className="absolute inset-0 w-full h-full bg-black/50 flex flex-col items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-[2px]">
                    {uploading ? <div className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent"></div> : <span className="text-[11px] font-medium tracking-wide">เปลี่ยนรูป</span>}
                    <input type="file" accept="image/*" className="hidden" onChange={onFileChange} disabled={uploading} />
                  </label>
                </div>
                <div className="mt-14 w-full">
                  <h2 className="text-[18px] font-bold text-slate-800 truncate px-2">{form.first_name || "ไม่มีชื่อ"} {form.last_name}</h2>
                  <div className="flex items-center justify-center gap-1.5 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                    <span className="text-blue-600 text-[13px] font-semibold">{displayRole}</span>
                  </div>
                </div>
                <div className="w-full mt-6 space-y-3 text-left">
                  <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                    <p className="text-[11px] text-slate-400 font-medium mb-0.5">อีเมล (ไม่สามารถแก้ไขได้)</p>
                    <p className="text-[14px] text-slate-700 font-semibold truncate" title={readOnlyData.email}>{readOnlyData.email || "-"}</p>
                  </div>

                  {/* 🔑 ปุ่มเปิด Pop-up Modal เปลี่ยนรหัสผ่าน */}
                  <button
                    type="button"
                    onClick={() => {
                      setCurrentPassword("");
                      setNewPassword("");
                      setConfirmPassword("");
                      setShowCurrentPass(false);
                      setShowNewPass(false);
                      setShowConfirmPass(false);
                      setShowPasswordModal(true);
                    }}
                    className="w-full mt-3 px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-blue-50/80 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-600 text-[13.5px] font-semibold transition-all flex items-center justify-center gap-2 shadow-xs hover:shadow-sm group"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span>เปลี่ยนรหัสผ่าน</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ขวา: ฟอร์มแก้ไขข้อมูล */}
          <div className="flex-1 w-full flex flex-col bg-white rounded-[1.5rem] shadow-sm border border-slate-100 overflow-hidden">
            <form onSubmit={handleSubmit} className="flex flex-col h-full p-6 sm:p-8">
              
              {/* ข้อมูลทั่วไป */}
              <div className="mb-8">
                <h3 className="text-[16px] font-bold text-slate-700 mb-5 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-500 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
                  ข้อมูลทั่วไป
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className={labelClass}>ชื่อจริง</label>
                    <input type="text" name="first_name" value={form.first_name} onChange={handleChange} className={inputClass} placeholder="ชื่อจริง" />
                  </div>
                  <div>
                    <label className={labelClass}>นามสกุล</label>
                    <input type="text" name="last_name" value={form.last_name} onChange={handleChange} className={inputClass} placeholder="นามสกุล" />
                  </div>
                  
                  <div>
                    <label className={labelClass}>รหัสประจำตัว / รหัสนักศึกษา</label>
                    <input type="text" name="account_code" value={form.account_code} onChange={handleChange} className={inputClass} required />
                  </div>

                  <div>
                    <label className={labelClass}>เบอร์โทรศัพท์ติดต่อ</label>
                    <input type="tel" name="phone" value={form.phone} onChange={handleChange} className={inputClass} placeholder="09xxxxxxxx" />
                  </div>

                    {/* 🌟 แสดงเฉพาะอาจารย์ในสาขา (นักศึกษา, อาจารย์นอกสาขา, บุคลากรภายนอก จะไม่แสดง) */}
                    {isBranchAdvisor && (
                      <div className="sm:col-span-2 relative" ref={dropdownRef}>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-[13px] font-semibold text-slate-700">ความเชี่ยวชาญ / สายที่ถนัด (Expertise) <span className="text-rose-500">*</span></label>
                          {!form.expertise && (
                            <span className="text-[11px] font-bold text-amber-700 bg-amber-100/80 border border-amber-300 px-2.5 py-0.5 rounded-full animate-pulse">
                              กรุณาระบุสายที่ถนัดอย่างน้อย 1 ข้อ
                            </span>
                          )}
                        </div>
                        <div 
                          className={`${inputClass} flex justify-between items-center cursor-pointer min-h-[42px] select-none ${
                            !form.expertise
                              ? 'border-amber-400 bg-amber-50/20 shadow-sm'
                              : ''
                          }`} 
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        >
                          <span className="truncate text-[14px]">
                            {form.expertise ? <span className="text-slate-800 font-medium">{form.expertise}</span> : <span className="text-slate-400 font-normal">-- คลิกเพื่อเลือกสายที่ถนัด --</span>}
                          </span>
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className={`w-4 h-4 text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180 text-indigo-600' : ''}`}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                          </svg>
                        </div>

                        {isDropdownOpen && (
                          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] max-h-[280px] overflow-y-auto py-1.5">
                            {expertiseOptionsList.map((option) => (
                              <label key={option} className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer transition-colors">
                                <input 
                                  type="checkbox" 
                                  checked={(form.expertise || "").includes(option)} 
                                  onChange={() => handleCheckboxChange(option)} 
                                  className="w-[18px] h-[18px] text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer" 
                                />
                                <span className="text-[14px] text-slate-700 font-medium">{option}</span>
                              </label>
                            ))}
                            <div className="px-4 py-2 mt-1 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[11px] text-amber-700 font-medium bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200">
                                📌 บังคับเลือกอย่างน้อย 1 หัวข้อ
                              </span>
                              <button
                                type="button"
                                onClick={() => setIsDropdownOpen(false)}
                                className="text-[12px] text-indigo-600 hover:text-indigo-700 font-bold px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                              >
                                ปิด
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  
                  <div className="sm:col-span-2 mt-2">
                    <label className={labelClass}>แนะนำตัวสั้นๆ (Bio)</label>
                    <textarea name="bio" value={form.bio} onChange={handleChange} rows="2" className={`${inputClass} resize-none`} placeholder="บรรยายเกี่ยวกับคุณหรือสิ่งที่สนใจ..."></textarea>
                  </div>
                </div>
              </div>

              {/* ข้อมูลสถาบัน */}
              <div className="mb-8">
                <h3 className="text-[16px] font-bold text-slate-700 mb-5 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-slate-500 shrink-0"><path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.436 60.436 0 00-.491 6.347A48.627 48.627 0 0112 20.904a48.627 48.627 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.57 50.57 0 00-2.658-.813A59.905 59.905 0 0112 3.493a59.902 59.902 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.697 50.697 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" /></svg>
                  ข้อมูลสถาบัน
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-3">
                  <div>
                    <label className={labelClass}>คณะ</label>
                    <select name="faculty" value={form.faculty || ""} onChange={handleChange} className={inputClass}>
                      <option value="" className="">-- เลือกคณะ --</option>
                      
                      {/* 🌟 ดักข้อมูลเก่าใน Database ที่ไม่มีใน List ปัจจุบัน */}
                      {hasUnknownFaculty && (
                        <option value={form.faculty} className="">{form.faculty} (ข้อมูลเดิม)</option>
                      )}

                      {facultyOptions.map((fac) => (
                        <option key={fac} value={fac} className="">{fac}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>สาขา</label>
                    <select 
                      name="major" 
                      value={form.major || ""} 
                      onChange={handleChange} 
                      className={inputClass} 
                      disabled={!form.faculty}
                    >
                      <option value="" className="">-- เลือกสาขา --</option>
                      
                      {/* 🌟 ดักข้อมูลสาขาเก่าใน Database ที่ไม่มีใน List ปัจจุบัน */}
                      {hasUnknownMajor && (
                        <option value={form.major} className="">{form.major} (ข้อมูลเดิม)</option>
                      )}

                      {majorOptions.map((maj) => (
                        <option key={maj} value={maj} className="">{maj}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              
              {/* ส่วนปุ่มบันทึก */}
              <div className="mt-auto flex justify-end border-t border-slate-100 pt-6">
                <button type="submit" disabled={saving || uploading} className="w-full sm:w-auto px-8 py-2.5 rounded-xl bg-[#2563EB] hover:bg-blue-700 text-white text-[14.5px] font-semibold transition-all shadow-md shadow-blue-500/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      กำลังบันทึก...
                    </>
                  ) : "บันทึกการเปลี่ยนแปลง"}
                </button>
              </div>

            </form>
          </div>

        </div>
      </main>

      {/* ================= Modal สำหรับการ Crop รูปภาพ ================= */}
      {showCropModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all">
          <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border border-slate-100 flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <h3 className="font-bold text-slate-800 text-[16px]">ปรับขนาดรูปโปรไฟล์</h3>
              <button onClick={() => setShowCropModal(false)} className="text-slate-400 hover:text-rose-500 p-1.5 transition-colors">✖</button>
            </div>
            <div className="relative w-full h-[320px] bg-slate-100/80">
              <Cropper image={imageSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} />
            </div>
            <div className="p-6 flex flex-col gap-5 bg-white shrink-0">
              <input type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(e.target.value)} className="w-full accent-blue-600" />
              <div className="flex gap-3">
                <button onClick={() => setShowCropModal(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex-1 transition-colors">ยกเลิก</button>
                <button onClick={handleSaveCroppedImage} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold flex-1 shadow-md shadow-blue-500/20 transition-all">ยืนยันรูปภาพ</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= Pop-up Modal สำหรับการเปลี่ยนรหัสผ่าน ================= */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm transition-all animate-in fade-in duration-200">
          <div className="bg-white rounded-[2rem] w-full max-w-lg overflow-hidden shadow-2xl border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="px-6 sm:px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-white shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shadow-sm border border-blue-100/60">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-[18px] tracking-tight">รหัสผ่าน</h3>
                  <p className="text-[12.5px] text-slate-500 mt-0.5">เปลี่ยนรหัสผ่านหรือกู้คืนรหัสผ่านปัจจุบันของคุณ</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowPasswordModal(false)} 
                className="text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-all hover:scale-105 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleChangePassword} className="p-6 sm:p-8 flex flex-col gap-5 bg-white">
              
              {/* 1. รหัสผ่านปัจจุบัน */}
              <div>
                <label className="text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>รหัสผ่านปัจจุบัน <span className="text-rose-500">*</span></span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => !e.target.value.includes(" ") && setCurrentPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านปัจจุบัน"
                    className="w-full bg-slate-50/70 border border-slate-200 text-slate-800 rounded-xl pl-4 pr-11 py-3 text-[14.5px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showCurrentPass ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    {showCurrentPass ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </button>
                </div>
                <div className="mt-1.5 flex justify-start">
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={sendingReset}
                    className="text-[12.5px] font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                  >
                    {sendingReset ? "กำลังส่งลิงก์..." : "ลืมรหัสผ่าน?"}
                  </button>
                </div>
              </div>

              {/* 2. รหัสผ่านใหม่ */}
              <div>
                <label className="text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>รหัสผ่านใหม่ <span className="text-rose-500">*</span></span>
                  {newPassword && (
                    <span className={`text-[12px] font-bold ${getPasswordStrength(newPassword).color}`}>
                      {getPasswordStrength(newPassword).text}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => !e.target.value.includes(" ") && setNewPassword(e.target.value)}
                    placeholder="ความยาวอย่างน้อย 6 ตัวอักษร"
                    className="w-full bg-slate-50/70 border border-slate-200 text-slate-800 rounded-xl pl-4 pr-11 py-3 text-[14.5px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showNewPass ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    {showNewPass ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </button>
                </div>
                {/* แถบระดับความปลอดภัย */}
                {newPassword && (
                  <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${getPasswordStrength(newPassword).bg}`}
                      style={{ width: `${getPasswordStrength(newPassword).bar}%` }}
                    ></div>
                  </div>
                )}
              </div>

              {/* 3. ยืนยันรหัสผ่านใหม่ */}
              <div>
                <label className="text-[13.5px] font-semibold text-slate-700 mb-1.5 flex items-center justify-between">
                  <span>ยืนยันรหัสผ่านใหม่ <span className="text-rose-500">*</span></span>
                  {confirmPassword && (
                    <span className={`text-[12px] font-bold ${newPassword === confirmPassword ? "text-emerald-600" : "text-rose-500"}`}>
                      {newPassword === confirmPassword ? "✓ รหัสผ่านตรงกัน" : "✗ รหัสผ่านไม่ตรงกัน"}
                    </span>
                  )}
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => !e.target.value.includes(" ") && setConfirmPassword(e.target.value)}
                    placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                    className="w-full bg-slate-50/70 border border-slate-200 text-slate-800 rounded-xl pl-4 pr-11 py-3 text-[14.5px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    title={showConfirmPass ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    {showConfirmPass ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-3 border-t border-slate-100 mt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordModal(false)}
                  disabled={changingPassword}
                  className="px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[14.5px] transition-colors flex-1"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={changingPassword || !currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  className="px-6 py-3 rounded-xl bg-[#2563EB] hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-[14.5px] shadow-md shadow-blue-500/20 transition-all flex-[1.5] flex items-center justify-center gap-2"
                >
                  {changingPassword ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>กำลังบันทึก...</span>
                    </>
                  ) : (
                    <span>บันทึกการเปลี่ยนแปลง</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}
    </div>
  );
}
