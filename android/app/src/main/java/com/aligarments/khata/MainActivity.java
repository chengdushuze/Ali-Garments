package com.aligarments.khata;

import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Explicitly disable WebView debugging in release builds for mobile security
        if (!BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(false);
        }

        // Expose Native Android Excel Downloader to WebView
        if (this.bridge != null && this.bridge.getWebView() != null) {
            this.bridge.getWebView().addJavascriptInterface(new ExcelDownloadBridge(this), "AndroidExcelBridge");
        }
    }

    public static class ExcelDownloadBridge {
        private final Context context;

        public ExcelDownloadBridge(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public boolean saveExcelToDownloads(String fileName, String base64Data) {
            if (fileName == null || base64Data == null || base64Data.isEmpty()) {
                return false;
            }

            try {
                // Sanitize file name to prevent any path traversal
                String safeName = new File(fileName).getName().replaceAll("[^a-zA-Z0-9._-]", "_");
                if (!safeName.toLowerCase().endsWith(".xlsx")) {
                    safeName += ".xlsx";
                }

                byte[] fileBytes = Base64.decode(base64Data, Base64.DEFAULT);

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, safeName);
                    values.put(MediaStore.MediaColumns.MIME_TYPE, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
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
                    File appFilesDir = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                    if (appFilesDir != null && !appFilesDir.exists()) {
                        appFilesDir.mkdirs();
                    }
                    File outFile = new File(appFilesDir != null ? appFilesDir : context.getFilesDir(), safeName);
                    try (FileOutputStream fos = new FileOutputStream(outFile)) {
                        fos.write(fileBytes);
                        fos.flush();
                    }
                }

                final String finalFileName = safeName;
                new Handler(Looper.getMainLooper()).post(() -> {
                    Toast.makeText(context, "Saved: " + finalFileName, Toast.LENGTH_SHORT).show();
                });
                return true;
            } catch (Exception e) {
                e.printStackTrace();
                return false;
            }
        }
    }
}
