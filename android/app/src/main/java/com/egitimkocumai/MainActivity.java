package com.egitimkocumai;

import android.Manifest;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.content.pm.SigningInfo;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebChromeClient;
import java.security.MessageDigest;

public class MainActivity extends BridgeActivity {
    private static final int PERMISSION_REQUEST_CODE = 2001;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Pre-request RECORD_AUDIO and CAMERA permissions at Android OS level if not yet granted
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this, new String[]{
                Manifest.permission.RECORD_AUDIO,
                Manifest.permission.CAMERA
            }, PERMISSION_REQUEST_CODE);
        }

        // Configure WebView with BridgeWebChromeClient and auto-grant onPermissionRequest for audio/microphone
        try {
            WebView webView = this.bridge != null ? this.bridge.getWebView() : null;
            if (webView != null && this.bridge != null) {
                webView.setWebChromeClient(new BridgeWebChromeClient(this.bridge) {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        runOnUiThread(() -> {
                            request.grant(request.getResources());
                        });
                    }
                });
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        injectAppSignature();
    }

    @Override
    public void onResume() {
        super.onResume();
        injectAppSignature();
    }

    private void injectAppSignature() {
        try {
            String sha1 = getAppSignatureSHA1();
            Log.i("EduMindAuth", "Running App SHA-1: " + sha1);
            if (this.bridge != null && this.bridge.getWebView() != null) {
                String js = "window.__APP_SIGNATURE_SHA1__ = '" + sha1 + "';";
                runOnUiThread(() -> {
                    try {
                        this.bridge.getWebView().evaluateJavascript(js, null);
                    } catch (Exception e) {}
                });
            }
        } catch (Exception e) {
            Log.e("EduMindAuth", "Error getting SHA-1", e);
        }
    }

    private String getAppSignatureSHA1() {
        try {
            PackageInfo packageInfo;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo = getPackageManager().getPackageInfo(getPackageName(), PackageManager.GET_SIGNING_CERTIFICATES);
                SigningInfo signingInfo = packageInfo.signingInfo;
                if (signingInfo != null) {
                    Signature[] signatures = signingInfo.hasMultipleSigners() ? signingInfo.getApkContentsSigners() : signingInfo.getSigningCertificateHistory();
                    if (signatures != null && signatures.length > 0) {
                        return hexDigest(signatures[0].toByteArray(), "SHA-1");
                    }
                }
            } else {
                packageInfo = getPackageManager().getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES);
                if (packageInfo.signatures != null && packageInfo.signatures.length > 0) {
                    return hexDigest(packageInfo.signatures[0].toByteArray(), "SHA-1");
                }
            }
        } catch (Exception e) {
            return "ERROR: " + e.getMessage();
        }
        return "UNKNOWN";
    }

    private static String hexDigest(byte[] bytes, String algorithm) {
        try {
            MessageDigest md = MessageDigest.getInstance(algorithm);
            byte[] digest = md.digest(bytes);
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < digest.length; i++) {
                if (i > 0) sb.append(":");
                sb.append(String.format("%02X", digest[i]));
            }
            return sb.toString();
        } catch (Exception e) {
            return "HASH_ERROR";
        }
    }
}
