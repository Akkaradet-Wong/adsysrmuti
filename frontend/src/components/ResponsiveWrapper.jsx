// ===============================================
// src/components/ResponsiveWrapper.jsx
// ===============================================
import React from 'react';

export default function ResponsiveWrapper({ children, className = "", ...props }) {
  return (
    <div 
      className={`w-full min-h-[100dvh] bg-[#F8FAFC] text-slate-800 flex flex-col font-kanit transition-colors duration-200 relative overflow-x-hidden ${className}`}
      {...props}
    >
      {/* 🌟 Modern Full-Screen Fluid Ambient Background (ครอบคลุมเต็มจอ 100% ทุกขนาดหน้าจอ ป้องกันขอบขาว) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[55vw] min-w-[450px] max-w-[900px] h-[55vw] min-h-[450px] max-h-[900px] bg-indigo-500/[0.12] rounded-full blur-[140px]"></div>
        <div className="absolute top-[18%] right-[-10%] w-[50vw] min-w-[400px] max-w-[800px] h-[50vw] min-h-[400px] max-h-[800px] bg-blue-500/[0.12] rounded-full blur-[140px]"></div>
        <div className="absolute bottom-[-10%] left-[10%] w-[60vw] min-w-[450px] max-w-[900px] h-[60vw] min-h-[450px] max-h-[900px] bg-sky-400/[0.10] rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[10%] right-[5%] w-[45vw] min-w-[350px] max-w-[750px] h-[45vw] min-h-[350px] max-h-[750px] bg-indigo-400/[0.10] rounded-full blur-[130px]"></div>
      </div>

      <div className="relative z-10 flex-1 flex flex-col w-full">
        {children}
      </div>
    </div>
  );
}