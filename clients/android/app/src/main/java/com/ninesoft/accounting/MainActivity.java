package com.ninesoft.accounting;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.SslErrorHandler;
import android.net.http.SslError;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebSettings;
import android.widget.Toast;
import java.net.URI;
import java.net.URISyntaxException;

public final class MainActivity extends Activity {
    private WebView web;
    private String serverUrl;
    private boolean setupMode;
    private static final String PREFS="ninesoft_settings";
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web=new WebView(this);
        setContentView(web);
        WebSettings settings=web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setAllowContentAccess(false);
        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri dest=request.getUrl();
                if(setupMode)return false;
                if(serverUrl!=null && dest.toString().startsWith(serverUrl+"/"))return false;
                if("https".equals(dest.getScheme())) {
                    startActivity(new Intent(Intent.ACTION_VIEW,dest));
                }
                return true;
            }
            @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,SslError error) {
                handler.cancel();
                Toast.makeText(MainActivity.this,"شهادة HTTPS غير موثوقة",Toast.LENGTH_LONG).show();
            }
            @Override public void onReceivedError(WebView view,WebResourceRequest request,WebResourceError error) {
                if(request.isForMainFrame())Toast.makeText(MainActivity.this,"تحقق من الاتصال بالإنترنت والخادم",Toast.LENGTH_LONG).show();
            }
        });
        web.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            try {
                Uri uri=Uri.parse(url);
                if(serverUrl==null || !url.startsWith(serverUrl+"/"))return;
                DownloadManager.Request request=new DownloadManager.Request(uri);
                String cookie=CookieManager.getInstance().getCookie(url);
                if(cookie!=null)request.addRequestHeader("Cookie",cookie);
                request.addRequestHeader("User-Agent",userAgent);
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS,"NineSoft-export.json");
                ((DownloadManager)getSystemService(DOWNLOAD_SERVICE)).enqueue(request);
                Toast.makeText(this,"بدأ تنزيل الملف",Toast.LENGTH_SHORT).show();
            } catch(Exception ex) {Toast.makeText(this,"تعذر التنزيل",Toast.LENGTH_LONG).show();}
        });
        String saved=getPreferences(MODE_PRIVATE).getString(PREFS,null);
        if(saved==null || normalizeUrl(saved)==null)openSetup();
        else openServer(saved);
    }
    private String normalizeUrl(String raw) {
        try {
            URI u=new URI(raw.trim());
            if(!"https".equalsIgnoreCase(u.getScheme()) || u.getHost()==null ||
                u.getUserInfo()!=null || u.getQuery()!=null || u.getFragment()!=null)return null;
            String base="https://"+u.getHost().toLowerCase();
            if(u.getPort()>0)base+=":"+u.getPort();
            String path=u.getPath()==null?"":u.getPath().replaceAll("/+$","");
            return base+path;
        } catch(URISyntaxException ex) {return null;}
    }
    private void openSetup() {
        setupMode=true;
        web.getSettings().setAllowFileAccess(true);
        web.addJavascriptInterface(new Object() {
            @JavascriptInterface public void configure(String input) {
                String url=normalizeUrl(input);
                runOnUiThread(()->{
                    if(url==null){Toast.makeText(MainActivity.this,"يجب إدخال رابط HTTPS صحيح",Toast.LENGTH_LONG).show();return;}
                    getPreferences(MODE_PRIVATE).edit().putString(PREFS,url).apply();
                    openServer(url);
                });
            }
        },"NineSoftSetup");
        web.loadUrl("file:///android_asset/setup.html");
    }
    private void openServer(String input) {
        serverUrl=normalizeUrl(input);
        if(serverUrl==null){openSetup();return;}
        setupMode=false;
        web.removeJavascriptInterface("NineSoftSetup");
        web.getSettings().setAllowFileAccess(false);
        web.loadUrl(serverUrl+"/index.php");
    }
    @Override public void onBackPressed() {
        if(web.canGoBack()&&!setupMode)web.goBack();
        else super.onBackPressed();
    }
    @Override protected void onDestroy() {
        if(web!=null){web.destroy();web=null;}
        super.onDestroy();
    }
}
