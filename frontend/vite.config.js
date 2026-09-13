import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // เพิ่มบรรทัดนี้เพื่อขยายขีดจำกัดการแจ้งเตือนเป็น 1000 kB (1MB) หรือปรับตัวเลขตามต้องการ
    chunkSizeWarningLimit: 1000, 
  }
})