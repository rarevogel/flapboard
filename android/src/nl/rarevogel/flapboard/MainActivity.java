package nl.rarevogel.flapboard;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

// A full-screen WebView showing the board from the app's assets, with the screen kept on.
public class MainActivity extends Activity {
    static final String HOST = "flapboard.local";
    WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 28) w.getAttributes().layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#141414"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new Bridge(), "FlapApp");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String p = u.getPath();
                if (p != null && p.startsWith("/ns/")) return ns(u);
                if (p == null || p.length() < 2) p = "/index.html";
                try { return new WebResourceResponse(p.endsWith(".html") ? "text/html" : "application/octet-stream", "utf-8", getAssets().open(p.substring(1))); }
                catch (Exception e) { return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", null, null); }
            }
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                Uri u = r.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { }
                return true;
            }
        });
        setContentView(web);
        immersive();
        web.loadUrl("https://" + HOST + "/index.html");
    }

    // live NS: the board asks https://flapboard.local/ns/<path>?...&key=..., and the app asks NS with the key in the proper header
    WebResourceResponse ns(Uri u) {
        java.util.Map<String, String> hdr = new java.util.HashMap<String, String>();
        hdr.put("Cache-Control", "no-store");
        try {
            StringBuilder q = new StringBuilder();
            for (String k : u.getQueryParameterNames()) {
                if (k.equals("key")) continue;
                for (String v : u.getQueryParameters(k)) { q.append(q.length() == 0 ? "?" : "&").append(Uri.encode(k)).append('=').append(Uri.encode(v)); }
            }
            java.net.URL url = new java.net.URL("https://gateway.apiportal.ns.nl/" + u.getPath().substring(4) + q);
            java.net.HttpURLConnection c = (java.net.HttpURLConnection) url.openConnection();
            c.setConnectTimeout(12000); c.setReadTimeout(15000);
            String key = u.getQueryParameter("key");
            c.setRequestProperty("Ocp-Apim-Subscription-Key", key == null ? "" : key);
            c.setRequestProperty("Accept", "application/json");
            int code = c.getResponseCode();
            java.io.InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in == null) in = new java.io.ByteArrayInputStream("{}".getBytes("UTF-8"));
            String reason = c.getResponseMessage(); if (reason == null || reason.isEmpty()) reason = code < 400 ? "OK" : "Error";
            return new WebResourceResponse("application/json", "utf-8", code, reason, hdr, in);
        } catch (Exception e) {
            return new WebResourceResponse("application/json", "utf-8", 502, "Bad Gateway", hdr, new java.io.ByteArrayInputStream("{}".getBytes()));
        }
    }

    void immersive() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE);
    }

    @Override
    public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) immersive(); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); web.resumeTimers(); immersive(); }

    @Override
    protected void onPause() { web.onPause(); web.pauseTimers(); super.onPause(); }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.__terug && window.__terug()", new android.webkit.ValueCallback<String>() { public void onReceiveValue(String v) { if (!"true".equals(v)) finish(); } });
    }

    class Bridge {
        @JavascriptInterface
        public void setOrientation(final String o) {
            runOnUiThread(new Runnable() { public void run() { setRequestedOrientation("landscape".equals(o) ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                : "portrait".equals(o) ? ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT : ActivityInfo.SCREEN_ORIENTATION_FULL_USER); } });
        }
    }
}
