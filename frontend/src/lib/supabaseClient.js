import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 🌟 Custom Storage Adapter:
// - ถ้าไม่ได้ติ๊ก 'จดจำฉันไว้' (auth_remember_me !== "true"): ข้อมูล Session จะเก็บใน sessionStorage เท่านั้น ทำให้เมื่อปิดเบราว์เซอร์ / Google Chrome ระบบจะ Logout อัตโนมัติทันที
// - ถ้าติ๊ก 'จดจำฉันไว้' (auth_remember_me === "true"): ข้อมูล Session จะเก็บใน localStorage ข้ามการปิดเปิดเบราว์เซอร์ได้
const customAuthStorage = {
  getItem: (key) => {
    if (typeof window === 'undefined') return null;
    try {
      const isRemembered = localStorage.getItem('auth_remember_me') === 'true';
      if (isRemembered) {
        return localStorage.getItem(key) || sessionStorage.getItem(key);
      }
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    if (typeof window === 'undefined') return;
    try {
      const isRemembered = localStorage.getItem('auth_remember_me') === 'true';
      if (isRemembered) {
        localStorage.setItem(key, value);
        sessionStorage.setItem(key, value);
      } else {
        sessionStorage.setItem(key, value);
        localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn('Storage setItem failed:', e);
    }
  },
  removeItem: (key) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    } catch (e) {
      console.warn('Storage removeItem failed:', e);
    }
  }
};

// 🧹 เคลียร์ Session ตกค้างใน localStorage ถ้าผู้ใช้ไม่ได้เลือก 'จดจำฉันไว้'
if (typeof window !== 'undefined') {
  try {
    const isRemembered = localStorage.getItem('auth_remember_me') === 'true';
    if (!isRemembered) {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith('sb-') && k.endsWith('-auth-token')) {
          localStorage.removeItem(k);
        }
      });
    }
  } catch (e) {
    console.warn('Clean legacy session error:', e);
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
});