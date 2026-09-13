import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

// 1. สร้าง Context
const RealtimeContext = createContext();

export const useRealtime = () => useContext(RealtimeContext);

export const RealtimeProvider = ({ children, currentUser }) => {
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // 🌟 ฟังก์ชันสำหรับดึงจำนวนแจ้งเตือนที่ยังไม่ได้อ่าน "ครั้งแรก" ตอนเปิดเว็บ
  const fetchInitialUnreadCount = useCallback(async () => {
    if (!currentUser?.email) return;

    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true }) // ใช้ head: true เพื่อเอาแค่จำนวน ไม่เอาข้อมูลทั้งหมด
        .eq('user_id', currentUser.email)
        .eq('is_read', false); // นับเฉพาะที่ยังไม่อ่าน

      if (!error) {
        setUnreadNotifications(count || 0);
      }
    } catch (error) {
      console.error("Error fetching initial notifications:", error);
    }
  }, [currentUser]);

  useEffect(() => {
    // ถ้ายังไม่ได้ล็อกอิน ไม่ต้องทำงาน
    if (!currentUser?.email) return;

    // โหลดจำนวนแจ้งเตือนที่ค้างอยู่ตอนแรก
    fetchInitialUnreadCount();

    // 2. สร้าง Subscription รับฟังการแจ้งเตือนแบบ Realtime
    const notificationChannel = supabase
      .channel(`global-noti-${currentUser.email}`) // เปลี่ยนชื่อ channel ให้เจาะจงแต่ละ user จะดีกว่า
      .on(
        'postgres_changes',
        { 
          event: '*', // 🌟 เปลี่ยนเป็น '*' เพื่อดักฟังทั้งหมด (INSERT, UPDATE, DELETE)
          schema: 'public', 
          table: 'notifications',
          filter: `user_id=eq.${currentUser.email}` // ฟังเฉพาะของตัวเอง
        },
        (payload) => {
          console.log('Realtime Event:', payload);

          // 🌟 จัดการตัวเลขตามประเภทของ Event
          if (payload.eventType === 'INSERT') {
            // มีแจ้งเตือนใหม่เพิ่มเข้ามา และยังไม่ได้อ่าน
            if (payload.new.is_read === false) {
              setUnreadNotifications((prev) => prev + 1);
            }
          } 
          else if (payload.eventType === 'UPDATE') {
            // มีการอัปเดต (เช่น กดอ่านแจ้งเตือน)
            // ถ้าสถานะเปลี่ยนเป็น อ่านแล้ว (true) ให้ลบจำนวนลง 1
            if (payload.new.is_read === true) {
              setUnreadNotifications((prev) => Math.max(0, prev - 1));
            }
          } 
          else if (payload.eventType === 'DELETE') {
            // ถ้ามีการลบแจ้งเตือน ให้ดึงจำนวนใหม่เพื่อความชัวร์ (เพราะเราไม่รู้ว่าอันที่ลบไปอ่านหรือยัง)
            fetchInitialUnreadCount();
          }
        }
      )
      .subscribe();

    // 3. Cleanup ยกเลิกการติดตามเมื่อผู้ใช้ออกจากระบบหรือปิดคอมโพเนนต์
    return () => {
      try {
        supabase.removeChannel(notificationChannel);
      } catch {
        // ignore
      }
    };
  }, [currentUser, fetchInitialUnreadCount]);

  return (
    <RealtimeContext.Provider value={{ unreadNotifications, setUnreadNotifications }}>
      {children}
    </RealtimeContext.Provider>
  );
};