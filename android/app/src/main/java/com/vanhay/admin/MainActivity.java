package com.vanhay.admin;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.webkit.HttpAuthHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;

/** Vỏ WebView mở trang /admin của website; đăng nhập Basic Auth bằng mật khẩu quản trị. */
public class MainActivity extends Activity {
    private static final String ADMIN_URL = BuildConfig.APP_URL + "/admin";

    private WebView webView;
    private TokenStore tokens;
    private String appHost;
    // Đã thử mật khẩu đã lưu cho lượt xác thực hiện tại; nếu bị hỏi lại nghĩa là mật khẩu sai
    private boolean triedSaved;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        tokens = new TokenStore(this);
        appHost = Uri.parse(BuildConfig.APP_URL).getHost();

        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true); // localStorage cho cỡ chữ/nền tối khi đọc
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportZoom(false);
        WebView.setWebContentsDebuggingEnabled(false);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (appHost != null && appHost.equalsIgnoreCase(uri.getHost())) return false;
                // Link ra ngoài (nguồn tham khảo...) mở bằng trình duyệt, không ở trong app quản trị
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (Exception ignored) { /* không có ứng dụng xử lý */ }
                return true;
            }

            @Override
            public void onReceivedHttpAuthRequest(WebView view, HttpAuthHandler handler, String host, String realm) {
                String saved = tokens.load();
                if (saved != null && !triedSaved) {
                    triedSaved = true;
                    handler.proceed("admin", saved);
                    return;
                }
                if (triedSaved) tokens.clear(); // mật khẩu đã lưu bị từ chối
                promptLogin(handler);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                triedSaved = false;
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (!request.isForMainFrame()) return;
                String html = "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                        + "<body style='font-family:sans-serif;padding:2rem;text-align:center'>"
                        + "<h2>Không kết nối được</h2><p>Kiểm tra mạng rồi thử lại.</p>"
                        + "<p><a href='" + ADMIN_URL + "'>Thử lại</a></p></body></html>";
                view.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
            }
        });

        if (savedInstanceState != null) webView.restoreState(savedInstanceState);
        else webView.loadUrl(ADMIN_URL);
    }

    private void promptLogin(final HttpAuthHandler handler) {
        final EditText input = new EditText(this);
        input.setHint(R.string.login_hint);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        new AlertDialog.Builder(this)
                .setTitle(R.string.login_title)
                .setView(input)
                .setCancelable(false)
                .setPositiveButton(R.string.login_ok, (d, w) -> {
                    String value = input.getText().toString();
                    if (value.isEmpty()) { handler.cancel(); return; }
                    tokens.save(value);
                    triedSaved = true;
                    handler.proceed("admin", value);
                })
                .setNegativeButton(R.string.login_cancel, (d, w) -> handler.cancel())
                .show();
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    protected void onDestroy() {
        webView.destroy();
        super.onDestroy();
    }
}
