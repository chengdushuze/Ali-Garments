package com.aligarments.khata;

import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {
    private AndroidDownloadBridge downloadBridge;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Explicitly disable WebView debugging in release builds for mobile security
        if (!BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(false);
        }
        setupDownloadBridge();
    }

    @Override
    public void onStart() {
        super.onStart();
        setupDownloadBridge();
    }

    @Override
    public void onResume() {
        super.onResume();
        setupDownloadBridge();
    }

    private void setupDownloadBridge() {
        if (this.bridge != null && this.bridge.getWebView() != null) {
            WebView webView = this.bridge.getWebView();
            if (downloadBridge == null) {
                downloadBridge = new AndroidDownloadBridge(this);
            }
            webView.addJavascriptInterface(downloadBridge, "AndroidDownloadBridge");
            webView.addJavascriptInterface(downloadBridge, "AndroidFileBridge");
            webView.addJavascriptInterface(downloadBridge, "AndroidExcelBridge");

            webView.setDownloadListener(new DownloadListener() {
                @Override
                public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimetype, long contentLength) {
                    if (downloadBridge != null) {
                        downloadBridge.handleUrlDownload(url, contentDisposition, mimetype);
                    }
                }
            });
        }
    }

    public static class AndroidDownloadBridge {
        private final Context context;

        public AndroidDownloadBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public boolean saveFileToDownloads(String fileName, String base64Data, String mimeType) {
            if (fileName == null || base64Data == null || base64Data.isEmpty()) {
                return false;
            }

            try {
                String rawBase64 = base64Data;
                int commaIdx = rawBase64.indexOf(",");
                if (commaIdx != -1 && rawBase64.substring(0, commaIdx).contains("base64")) {
                    rawBase64 = rawBase64.substring(commaIdx + 1);
                }

                String safeName = new File(fileName).getName().replaceAll("[^a-zA-Z0-9._-]", "_");
                String effectiveMime = mimeType;
                if (effectiveMime == null || effectiveMime.isEmpty()) {
                    if (safeName.toLowerCase().endsWith(".pdf")) {
                        effectiveMime = "application/pdf";
                    } else if (safeName.toLowerCase().endsWith(".xlsx")) {
                        effectiveMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
                    } else {
                        effectiveMime = "application/octet-stream";
                    }
                }

                byte[] fileBytes = Base64.decode(rawBase64, Base64.DEFAULT);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, effectiveMime);
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = context.getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                os.write(fileBytes);
                                os.flush();
                            }
                        }
                    }
                } else {
                    File publicDownloadDir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (publicDownloadDir != null && !publicDownloadDir.exists()) {
                        publicDownloadDir.mkdirs();
                    }
                    File outFile = new File(publicDownloadDir != null ? publicDownloadDir : context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), safeName);
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        fos.write(fileBytes);
                        fos.flush();
                    }
                    MediaScannerConnection.scanFile(context, new String[]{outFile.getAbsolutePath()}, new String[]{effectiveMime}, null);
                }

                final String finalFileName = safeName;
                new Handler(Looper.getMainLooper()).post(() -> {
                    Toast.makeText(context, "Saved to Downloads: " + finalFileName, Toast.LENGTH_LONG).show();
                });
                return true;
            } catch (Exception e) {
                e.printStackTrace();
                final String errMsg = e.getMessage() != null ? e.getMessage() : "Unknown error";
                new Handler(Looper.getMainLooper()).post(() -> {
                    Toast.makeText(context, "Download failed: " + errMsg, Toast.LENGTH_SHORT).show();
                });
                return false;
            }
        }

        @JavascriptInterface
        public boolean savePdfToDownloads(String fileName, String base64Data) {
            String safeName = fileName;
            if (safeName == null || !safeName.toLowerCase().endsWith(".pdf")) {
                safeName = (safeName != null ? safeName : "invoice") + ".pdf";
            }
            return saveFileToDownloads(safeName, base64Data, "application/pdf");
        }

        @JavascriptInterface
        public boolean saveExcelToDownloads(String fileName, String base64Data) {
            String safeName = fileName;
            if (safeName == null || !safeName.toLowerCase().endsWith(".xlsx")) {
                safeName = (safeName != null ? safeName : "report") + ".xlsx";
            }
            return saveFileToDownloads(safeName, base64Data, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        }

        @JavascriptInterface
        public boolean openFile(String fileName, String base64Data, String mimeType) {
            try {
                String safeName = new File(fileName).getName().replaceAll("[^a-zA-Z0-9._-]", "_");
                byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);

                File cacheDir = new File(context.getCacheDir(), "shared_files");
                if (!cacheDir.exists()) cacheDir.mkdirs();
                File tempFile = new File(cacheDir, safeName);
                try (FileOutputStream fos = new FileOutputStream(tempFile)) {
                    fos.write(fileBytes);
                    fos.flush();
                }

                Uri contentUri = FileProvider.getUriForFile(
                    context,
                    context.getPackageName() + ".fileprovider",
                    tempFile
                );

                Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                viewIntent.setDataAndType(contentUri, mimeType != null ? mimeType : "*/*");
                viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                context.startActivity(Intent.createChooser(viewIntent, "Open " + safeName));
                return true;
            } catch (Exception e) {
                e.printStackTrace();
                return false;
            }
        }

        public void handleUrlDownload(String url, String contentDisposition, String mimetype) {
            if (url == null) return;
            try {
                if (url.startsWith("data:")) {
                    String[] parts = url.split(",");
                    if (parts.length > 1) {
                        String header = parts[0];
                        String data = parts[1];
                        String mime = "application/octet-stream";
                        if (header.contains(":") && header.contains(";")) {
                            mime = header.substring(header.indexOf(":") + 1, header.indexOf(";"));
                        }
                        String ext = ".bin";
                        if (mime.contains("pdf")) ext = ".pdf";
                        else if (mime.contains("spreadsheet") || mime.contains("excel")) ext = ".xlsx";
                        String filename = "download_" + System.currentTimeMillis() + ext;
                        saveFileToDownloads(filename, data, mime);
                    }
                } else if (url.startsWith("http://") || url.startsWith("https://")) {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimetype);
                    request.addRequestHeader("User-Agent", "Mozilla/5.0");
                    request.setDescription("Downloading file...");
                    String filename = URLUtil.guessFileName(url, contentDisposition, mimetype);
                    request.setTitle(filename);
                    request.allowScanningByMediaScanner();
                    request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);

                    DownloadManager dm = (DownloadManager) context.getSystemService(Context.DOWNLOAD_SERVICE);
                    if (dm != null) {
                        dm.enqueue(request);
                        Toast.makeText(context, "Downloading file...", Toast.LENGTH_SHORT).show();
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
