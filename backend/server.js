require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cron = require("node-cron");
const { createClient } = require("@supabase/supabase-js");

const authRoutes = require("./routes/authRoutes");
const authMiddleware = require("./middleware/authMiddleware");
const roleMiddleware = require("./middleware/roleMiddleware");

const app = express();

app.use(cors());
app.use(express.json());

// ✅ Setup Supabase Client
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);

  // 🧹 ตั้งเวลา (Cron Job) ทำงานทุกเที่ยงคืน เพื่อลบไฟล์และ URL รูปภาพที่อายุเกิน 30 วัน
  cron.schedule("0 0 * * *", async () => {
    console.log("Running cron job: Clean up expired images & files...");
    const gasUrl = process.env.GAS_URL || process.env.VITE_GAS_URL;

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: messages, error } = await supabase
        .from("project_messages")
        .select("message_id, file_url")
        .lte("created_at", thirtyDaysAgo.toISOString())
        .not("file_url", "is", null)
        .neq("file_url", "EXPIRED_IMAGE");
        
      if (error) throw error;
      
      if (messages && messages.length > 0) {
        let count = 0;
        for (const msg of messages) {
          if (!msg.file_url || msg.file_url === "EXPIRED_IMAGE") continue;

          // 1. ลบจาก Google Drive ถ้าเป็นลิงก์ Drive
          if (msg.file_url.includes("drive.google.com") && gasUrl) {
            const cleanUrl = msg.file_url.split("#")[0];
            const matchId = cleanUrl.match(/[?&]id=([^&#]+)/i) || cleanUrl.match(/\/d\/([^/&#]+)/i);
            if (matchId && matchId[1]) {
              try {
                await fetch(gasUrl, {
                  method: "POST",
                  headers: { "Content-Type": "text/plain;charset=utf-8" },
                  body: JSON.stringify({ action: "delete", fileId: matchId[1] })
                });
              } catch (e) {
                console.error("Error deleting expired Drive file:", e);
              }
            }
          }

          // 2. ลบจาก Supabase Storage ถ้าเป็น Storage URL
          if (msg.file_url.includes("/storage/v1/object/public/")) {
            try {
              const parts = msg.file_url.split("/storage/v1/object/public/")[1];
              if (parts) {
                const slashIndex = parts.indexOf("/");
                if (slashIndex > -1) {
                  const bucket = parts.substring(0, slashIndex);
                  const filePath = decodeURIComponent(parts.substring(slashIndex + 1).split("?")[0].split("#")[0]);
                  await supabase.storage.from(bucket).remove([filePath]);
                }
              }
            } catch (e) {
              console.error("Error deleting expired Supabase Storage file:", e);
            }
          }

          // 3. อัปเดตใน DB
          await supabase
            .from("project_messages")
            .update({ file_url: "EXPIRED_IMAGE" })
            .eq("message_id", msg.message_id);
          count++;
        }
        console.log(`Cleaned up ${count} expired files/images from Storage and DB.`);
      } else {
        console.log("No expired images/files found.");
      }
    } catch (err) {
      console.error("Cron job error:", err);
    }
  });
}



// ✅ routes
app.use("/api/auth", authRoutes);


// 🔒 protected route
app.get("/api/profile", authMiddleware, (req, res) => {
  res.json({
    message: "เข้าถึงสำเร็จ",
    user: req.user,
  });
});

// 🔐 admin only
app.get(
  "/api/admin",
  authMiddleware,
  roleMiddleware(["ADMIN"]),
  (req, res) => {
    res.json({ message: "admin only" });
  }
);

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log("Server running on port " + port);
});