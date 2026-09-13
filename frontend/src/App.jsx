import React, { useState, useEffect, Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabaseClient";
import { logoutAll } from "./lib/authUtils";

import ResponsiveWrapper from "./components/ResponsiveWrapper";
import { RealtimeProvider } from "./contexts/RealtimeContext";
import { LoadingSpinner } from "./components/SharedUI";
import ErrorBoundary from "./components/ErrorBoundary";

// 🌟 ตัวช่วยโหลด Component แบบ Lazy พร้อมระบบ Auto-Retry ป้องกันหน้าขาวเมื่อมีการ Deploy โค้ดใหม่
const lazyWithRetry = (componentImport) =>
  lazy(async () => {
    const hasAlreadyRetried = JSON.parse(
      sessionStorage.getItem("lazy_retry_done") || "false"
    );

    try {
      const component = await componentImport();
      sessionStorage.setItem("lazy_retry_done", "false");
      return component;
    } catch (error) {
      console.warn("Lazy load failed, auto-recovering...", error);
      if (!hasAlreadyRetried) {
        sessionStorage.setItem("lazy_retry_done", "true");
        window.location.reload();
        return new Promise(() => {});
      }
      throw error;
    }
  });

// นำเข้าหน้าต่างๆ (Lazy Load with Retry)
const Login = lazyWithRetry(() => import("./pages/Login"));
const Register = lazyWithRetry(() => import("./pages/Register"));
const Dashboard = lazyWithRetry(() => import("./pages/Dashboard"));
const ForgotPassword = lazyWithRetry(() => import("./pages/ForgotPassword"));
const UpdatePassword = lazyWithRetry(() => import("./pages/UpdatePassword"));
const Profile = lazyWithRetry(() => import("./pages/Profile"));
const AdvisorSearch = lazyWithRetry(() => import("./pages/AdvisorSearch"));
const AdvisorRequests = lazyWithRetry(() => import("./pages/AdvisorRequests"));
const AdminDashboard = lazyWithRetry(() => import("./pages/AdminDashboard"));
const Project = lazyWithRetry(() => import("./pages/Project"));

// 🌟 นำเข้าหน้าจัดการห้องเรียน
const CreateRoom = lazyWithRetry(() => import("./pages/CreateRoom"));
const Classroom = lazyWithRetry(() => import("./pages/Classroom"));

// 🌟 นำเข้าหน้า Chat
const Chat = lazyWithRetry(() => import("./pages/Chat")); 

// 🌟 แก้ไข ProtectedRoute ให้รองรับการส่ง Role มาเป็น Array ได้
const ProtectedRoute = ({ children, user, requiredRole }) => {
  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole) {
    const userRole = user.role?.toLowerCase();
    
    // ถ้าระบุหลาย Role (เช่น ['admin', 'advisor'])
    if (Array.isArray(requiredRole)) {
      if (!requiredRole.map(r => r?.toLowerCase()).includes(userRole)) {
        return <Navigate to="/dashboard" replace />;
      }
    } 
    // ถ้าระบุ Role เดียวเป็น String
    else if (typeof requiredRole === 'string') {
      if (userRole !== requiredRole.toLowerCase()) {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  return children;
};

// 🌟 PublicRoute: ป้องกันหน้ากระพริบ หากผู้ใช้ล็อกอินอยู่แล้วจะพาไปหน้า Dashboard/Admin ทันที
const PublicRoute = ({ children, user }) => {
  if (user) {
    const targetPath = user.role === "ADMIN" ? "/admin" : "/dashboard";
    return <Navigate to={targetPath} replace />;
  }
  return children;
};

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchUserProfile = async (user) => {
      try {
        if (user) {
          // 1. ค้นหาข้อมูลโปรไฟล์ด้วย auth_id
          let { data: profile } = await supabase
            .from("users")
            .select("*")
            .eq("auth_id", user.id)
            .maybeSingle(); 

          // Fallback ค้นหาด้วย email เผื่อกรณียังไม่ได้ผูก auth_id
          if (!profile && user.email) {
            const { data: profileByEmail } = await supabase
              .from("users")
              .select("*")
              .ilike("email", user.email.trim().toLowerCase())
              .maybeSingle();
            profile = profileByEmail;
          }

          // 2. ป้องกันอาจารย์ที่รออนุมัติสิทธิ์ไม่ให้เข้าสู่ระบบ
          if (profile && profile.requested_role === "ADVISOR" && !profile.is_accepted) {
            await logoutAll();
            if (isMounted) setCurrentUser(null);
            return;
          }

          if (isMounted) setCurrentUser(profile);
        } else {
          if (isMounted) setCurrentUser(null);
        }
      } catch (err) {
        console.error("fetchUserProfile error:", err);
        if (isMounted) setCurrentUser(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        fetchUserProfile(session?.user);
      }
    );

    return () => {
      isMounted = false;
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <ResponsiveWrapper>
      <RealtimeProvider currentUser={currentUser}>
        <BrowserRouter>
          <ErrorBoundary>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
              {/* 🔴 Public Routes (มี PublicRoute ป้องกันการกระพริบ) */}
              <Route path="/" element={<PublicRoute user={currentUser}><Login /></PublicRoute>} />
              <Route path="/login" element={<PublicRoute user={currentUser}><Login /></PublicRoute>} />
              <Route path="/register" element={<PublicRoute user={currentUser}><Register /></PublicRoute>} />
              <Route path="/forgot-password" element={<PublicRoute user={currentUser}><ForgotPassword /></PublicRoute>} />
              <Route path="/update-password" element={<UpdatePassword />} />

              {/* 🔵 Protected Routes */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute user={currentUser}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute user={currentUser}>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/project"
                element={
                  <ProtectedRoute user={currentUser}>
                    <Project />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/advisorsearch"
                element={
                  <ProtectedRoute user={currentUser}>
                    <AdvisorSearch />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/advisor/requests"
                element={
                  <ProtectedRoute user={currentUser}>
                    <AdvisorRequests />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/requests"
                element={
                  <ProtectedRoute user={currentUser}>
                    <AdvisorRequests />
                  </ProtectedRoute>
                }
              />

              {/* 🌟 Route สำหรับหน้าจัดการและเข้าร่วมห้องเรียน */}
              <Route
                path="/create-room"
                element={
                  <ProtectedRoute user={currentUser}>
                    <CreateRoom />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/classroom/:id"
                element={
                  <ProtectedRoute user={currentUser}>
                    <Classroom />
                  </ProtectedRoute>
                }
              />

              {/* 🌟 Route สำหรับระบบแชท (เพิ่มใหม่) */}
              <Route
                path="/chat"
                element={
                  <ProtectedRoute user={currentUser}>
                    <Chat />
                  </ProtectedRoute>
                }
              />

              {/* 🟡 Role Specific Routes */}
              <Route
                path="/admin"
                element={
                  // 🌟 อนุญาตให้ผ่าน Router มาได้ทั้ง admin และ advisor (เดี๋ยวไปคัดกรอง 'อาจารย์ในสาขา' ต่อที่หน้า AdminDashboard)
                  <ProtectedRoute user={currentUser} requiredRole={['admin', 'advisor']}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Fallback Route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </RealtimeProvider>
  </ResponsiveWrapper>
  );
}

export default App;