import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';

/**
 * Universal File Saver for Android APK, Capacitor, and Web Browser.
 * 
 * Strategy:
 * 1. If running inside Android APK with Native Bridge (AndroidDownloadBridge / AndroidFileBridge / AndroidExcelBridge),
 *    saves directly into the Android public "Download" directory via MediaStore / FileOutputStream and displays native Toast.
 * 2. If running inside Capacitor native container, uses Capacitor Filesystem to write to external/public storage.
 * 3. In Web browser, creates Blob URL and triggers instant browser download.
 * 
 * @param {string} filename 
 * @param {string} base64Data (raw base64 or data URI)
 * @param {string} mimeType (e.g. 'application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
 * @returns {Promise<{ success: boolean, filename: string, location: string }>}
 */
export async function saveFileToDevice(filename, base64Data, mimeType = 'application/octet-stream') {
  if (!filename || !base64Data) {
    throw new Error('Filename and file data are required');
  }

  // Strip data URI prefix if present for native bridges
  let cleanBase64 = base64Data;
  const commaIdx = cleanBase64.indexOf(',');
  if (commaIdx !== -1 && cleanBase64.slice(0, commaIdx).includes('base64')) {
    cleanBase64 = cleanBase64.slice(commaIdx + 1);
  }

  // 1. Android Native Java Bridge (Direct to MediaStore.Downloads - Guaranteed to appear in notification / Files)
  if (typeof window !== 'undefined') {
    const bridge = window.AndroidDownloadBridge || window.AndroidFileBridge || window.AndroidExcelBridge;
    if (bridge) {
      if (typeof bridge.saveFileToDownloads === 'function') {
        const ok = bridge.saveFileToDownloads(filename, cleanBase64, mimeType);
        if (ok) return { success: true, filename, location: 'Android Downloads folder' };
      }
      if (filename.toLowerCase().endsWith('.pdf') && typeof bridge.savePdfToDownloads === 'function') {
        const ok = bridge.savePdfToDownloads(filename, cleanBase64);
        if (ok) return { success: true, filename, location: 'Android Downloads folder' };
      }
      if (filename.toLowerCase().endsWith('.xlsx') && typeof bridge.saveExcelToDownloads === 'function') {
        const ok = bridge.saveExcelToDownloads(filename, cleanBase64);
        if (ok) return { success: true, filename, location: 'Android Downloads folder' };
      }
    }
  }

  // 2. Capacitor Native Filesystem
  if (Capacitor.isNativePlatform()) {
    try {
      await Filesystem.writeFile({
        path: `Download/${filename}`,
        data: cleanBase64,
        directory: Directory.External,
        recursive: true
      });
      return { success: true, filename, location: 'Downloads folder' };
    } catch (e) {
      try {
        await Filesystem.writeFile({
          path: filename,
          data: cleanBase64,
          directory: Directory.Documents,
          recursive: true
        });
        return { success: true, filename, location: 'Documents folder' };
      } catch (err2) {
        console.warn('Capacitor Filesystem fallback failed:', err2);
      }
    }
  }

  // 3. Web Browser Blob Download
  try {
    const byteCharacters = atob(cleanBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 150);

    return { success: true, filename, location: 'Downloads' };
  } catch (webErr) {
    console.error('Web file download failed:', webErr);
    throw webErr;
  }
}
