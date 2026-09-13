import { supabase } from "./supabaseClient";

/**
 * ดึง File ID ของ Google Drive จาก URL รูปแบบต่างๆ
 * เช่น:
 * - https://drive.google.com/uc?export=view&id=FILE_ID
 * - https://drive.google.com/file/d/FILE_ID/view
 * - https://drive.google.com/open?id=FILE_ID
 * - https://drive.google.com/thumbnail?id=FILE_ID
 */
export const extractDriveFileId = (url) => {
  if (!url || typeof url !== "string") return null;
  
  // ตัด hash หรือ query parameter เสริมออกก่อน
  const cleanUrl = url.split("#")[0];

  // 1. ตรวจสอบ ?id=... หรือ &id=...
  const matchId = cleanUrl.match(/[?&]id=([^&#]+)/i);
  if (matchId && matchId[1]) return matchId[1];

  // 2. ตรวจสอบ /file/d/... หรือ /d/...
  const matchFileD = cleanUrl.match(/\/d\/([^/&#]+)/i);
  if (matchFileD && matchFileD[1]) return matchFileD[1];

  return null;
};

const rawGas = import.meta.env.VITE_GAS_URL;
const rawFolder = import.meta.env.VITE_DRIVE_FOLDER_ID;

const RESOLVED_GAS_URL = (rawGas && rawGas.startsWith("http")) 
  ? rawGas 
  : (rawFolder && rawFolder.startsWith("http")) 
    ? rawFolder 
    : "https://script.google.com/macros/s/AKfycbwoUKTZc4n4p4FXdGDv2ZulyoItCRchlotQXl7zeYpumOAQpVUoowU9qM_oP-fsAEs3/exec";

const isValidFolderId = (id) => id && !id.startsWith("http") && !id.startsWith("AKfycb") && id.length < 45;

const RESOLVED_FOLDER_ID = isValidFolderId(rawFolder) 
  ? rawFolder 
  : isValidFolderId(rawGas) 
    ? rawGas 
    : "1aGWh1P0Ry2yEI90NgZTCHz_SiSn7vLBG";

/**
 * ลบไฟล์จาก Google Drive ผ่าน Google Apps Script (GAS)
 * @param {string|Array<string|Object>} urls - URL เดี่ยว หรือ อาร์เรย์ของ URL / Object ที่มี field url เช่น [{name, url}]
 */
export const deleteDriveFiles = async (urls) => {
  const scriptUrl = RESOLVED_GAS_URL;
  if (!scriptUrl || !urls) return;

  const rawList = Array.isArray(urls) ? urls : [urls];
  const fileIds = new Set();

  for (const item of rawList) {
    if (!item) continue;
    const urlStr = typeof item === "string" ? item : item.url;
    if (urlStr && urlStr.includes("drive.google.com")) {
      const fileId = extractDriveFileId(urlStr);
      if (fileId) fileIds.add(fileId);
    }
  }

  if (fileIds.size === 0) return;

  const promises = Array.from(fileIds).map(async (fileId) => {
    try {
      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "delete", fileId }),
        credentials: "omit",
        redirect: "follow"
      });
      const result = await response.json().catch(() => null);
      return { fileId, success: result?.success ?? true };
    } catch (err) {
      console.error(`Error deleting Drive file (${fileId}):`, err);
      return { fileId, success: false, error: err };
    }
  });

  await Promise.allSettled(promises);
};

/**
 * ลบโฟลเดอร์ออกจาก Google Drive ผ่าน Google Apps Script (GAS)
 * @param {string|Array<string>} folderNames - ชื่อโฟลเดอร์ เช่น ["Project - ระบบ...", "Chat - Project 1..."]
 * @param {string} [parentFolderId] - ID ของโฟลเดอร์หลัก (ถ้าไม่ระบุจะดึงจาก VITE_DRIVE_FOLDER_ID)
 */
export const deleteDriveFolders = async (folderNames, parentFolderId) => {
  const scriptUrl = RESOLVED_GAS_URL;
  const mainFolderId = parentFolderId || RESOLVED_FOLDER_ID;
  if (!scriptUrl || !folderNames) return;

  const rawList = Array.isArray(folderNames) ? folderNames : [folderNames];
  const uniqueNames = Array.from(new Set(rawList.filter(Boolean).map(n => String(n).trim())));
  if (uniqueNames.length === 0) return;

  const promises = uniqueNames.map(async (folderName) => {
    try {
      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          action: "deleteFolder",
          folderName: folderName,
          subfolderName: folderName,
          folderId: mainFolderId,
          parentFolderId: mainFolderId
        }),
        credentials: "omit",
        redirect: "follow"
      });
      const result = await response.json().catch(() => null);
      return { folderName, success: result?.success ?? true };
    } catch (err) {
      console.error(`Error deleting Drive folder (${folderName}):`, err);
      return { folderName, success: false, error: err };
    }
  });

  await Promise.allSettled(promises);
};

/**
 * ลบไฟล์ออกจาก Supabase Storage Bucket
 * @param {string} bucket - ชื่อ Bucket เช่น 'avatars'
 * @param {string} urlOrPath - Public URL หรือ path ของไฟล์
 */
export const deleteStorageFile = async (bucket, urlOrPath) => {
  if (!urlOrPath || typeof urlOrPath !== "string") return;

  try {
    let filePath = urlOrPath;
    const publicPrefix = `/storage/v1/object/public/${bucket}/`;
    const bucketPrefix = `/${bucket}/`;

    if (urlOrPath.includes(publicPrefix)) {
      filePath = urlOrPath.split(publicPrefix)[1];
    } else if (urlOrPath.includes(bucketPrefix)) {
      filePath = urlOrPath.split(bucketPrefix)[1];
    }

    // ตัด query parameter หรือ hash
    filePath = filePath.split("?")[0].split("#")[0];

    if (filePath) {
      const decodedPath = decodeURIComponent(filePath);
      const { error } = await supabase.storage.from(bucket).remove([decodedPath]);
      if (error) {
        console.error(`Error removing file from Supabase storage (${bucket}/${decodedPath}):`, error);
      }
    }
  } catch (err) {
    console.error(`Error in deleteStorageFile for bucket ${bucket}:`, err);
  }
};

/**
 * ลบไฟล์หลายไฟล์ออกจาก Supabase Storage Bucket
 * @param {string} bucket - ชื่อ Bucket เช่น 'avatars'
 * @param {Array<string>} urlsOrPaths - อาร์เรย์ของ Public URL หรือ path
 */
export const deleteStorageFiles = async (bucket, urlsOrPaths) => {
  if (!urlsOrPaths || !Array.isArray(urlsOrPaths) || urlsOrPaths.length === 0) return;
  const promises = urlsOrPaths.map((item) => deleteStorageFile(bucket, item));
  await Promise.allSettled(promises);
};
