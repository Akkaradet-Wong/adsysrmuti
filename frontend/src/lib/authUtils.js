// ===============================================
// src/lib/authUtils.js
// ===============================================
import { supabase } from "./supabaseClient";

/**
 * 🌟 ออกจากระบบบัญชี Google อัตโนมัติ (Google Logout)
 * ครอบคลุมทั้ง Google Identity Services, GAPI, Iframe และ Request Endpoint
 */
export const logoutGoogle = () => {
  return new Promise((resolve) => {
    try {
      // 1. Google Identity Services API (GSI)
      if (typeof window !== "undefined" && window.google?.accounts?.id) {
        try {
          window.google.accounts.id.disableAutoSelect();
        } catch (_) {}
      }

      // 2. Google API Client (GAPI)
      if (typeof window !== "undefined" && window.gapi?.auth2) {
        try {
          const auth2 = window.gapi.auth2.getAuthInstance();
          if (auth2) auth2.signOut();
        } catch (_) {}
      }

      // 3. ส่งสัญญาณ Logout ไปยัง Endpoint ของ Google ผ่าน Iframe และ Image
      if (typeof document !== "undefined") {
        const endpoints = [
          "https://accounts.google.com/Logout",
          "https://www.google.com/accounts/Logout"
        ];

        endpoints.forEach((url) => {
          // ใช้ Image Ping
          const img = new Image();
          img.src = url;

          // ใช้ Hidden Iframe
          const iframe = document.createElement("iframe");
          iframe.style.display = "none";
          iframe.style.width = "0px";
          iframe.style.height = "0px";
          iframe.style.border = "none";
          iframe.src = url;
          document.body.appendChild(iframe);

          setTimeout(() => {
            try {
              if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
            } catch (_) {}
          }, 1500);
        });

        // ใช้ Fetch no-cors
        try {
          fetch("https://accounts.google.com/Logout", {
            mode: "no-cors",
            credentials: "include"
          }).catch(() => {});
        } catch (_) {}
      }

      // หน่วงเวลาสั้นๆ เพื่อให้ Browser ส่งคำขอออกไปอย่างสมบูรณ์
      setTimeout(resolve, 600);
    } catch (err) {
      console.warn("Google logout notice:", err);
      resolve();
    }
  });
};

/**
 * 🌟 ออกจากระบบทั้งหมด (ทั้ง Google และ Supabase พร้อมเคลียร์ Storage)
 */
export const logoutAll = async () => {
  try {
    // 1. ล็อกเอาต์ Google อัตโนมัติ
    await logoutGoogle();
  } catch (e) {
    console.warn("logoutGoogle error:", e);
  }

  try {
    // 2. ล็อกเอาต์ Supabase
    await supabase.auth.signOut();
  } catch (e) {
    console.warn("Supabase signOut error:", e);
  }

  try {
    // 3. เคลียร์ Storage ทั้งหมด และลบโทเค็นของ Supabase ออก
    if (typeof localStorage !== "undefined") {
      const savedEmail = localStorage.getItem("rememberedEmail");
      const isRemembered = localStorage.getItem("auth_remember_me");
      
      // ลบ auth tokens ของ Supabase ทั้งหมด
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith("sb-") && k.endsWith("-auth-token")) {
          localStorage.removeItem(k);
        }
      });

      localStorage.clear();
      if (savedEmail && isRemembered === "true") {
        localStorage.setItem("rememberedEmail", savedEmail);
        localStorage.setItem("auth_remember_me", "true");
      }
    }
    if (typeof sessionStorage !== "undefined") {
      sessionStorage.clear();
    }
  } catch (e) {
    console.warn("Storage clear error:", e);
  }
};
