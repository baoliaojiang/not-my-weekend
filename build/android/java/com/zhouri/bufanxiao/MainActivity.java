package com.zhouri.bufanxiao;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/**
 * 纯代码构建的 WebView 壳，直接加载 assets/www（已打包成传统脚本，file:// 下可运行）。
 */
public class MainActivity extends Activity {

    /* 启动页解析：热更新过的资源优先。
       顺序是「应用私有目录 > 安装包内置 assets」：
       升级失败或从未升级时自动落回内置，玩家不会因为一次坏下载就开不了游戏。 */
    private static final String BUNDLED_URL = "file:///android_asset/www/index.html";

    private WebView web;
    private long lastBackTime = 0L;

    @Override
    @SuppressWarnings("deprecation")
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 21) {
            getWindow().setStatusBarColor(Color.BLACK);
            getWindow().setNavigationBarColor(Color.BLACK);
        }

        // 先把容器铺好：即使 WebView 初始化失败，也能把错误画在屏幕上，而不是直接闪退
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#0B0D10"));
        setContentView(root);

        try {
            setupWeb();
            root.addView(web);
        } catch (Throwable t) {
            showFatal(t, root);
        }
    }

    private void setupWeb() {
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0B0D10"));
        if (Build.VERSION.SDK_INT >= 19) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        web.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);
        s.setLoadsImagesAutomatically(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        // 关掉 WebView 自带的滚动条与越界回弹：这是视觉小说的整屏舞台，
        // 不是网页。之前标题页高度溢出时，整页能被手指拖动，还会带出滚动条。
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request != null && request.isForMainFrame()) {
                    android.util.Log.e("ZBWeb", "main frame error: " + error.getDescription());
                    Toast.makeText(MainActivity.this, "页面加载失败：" + error.getDescription(),
                            Toast.LENGTH_LONG).show();
                }
            }
        });

        /* 软键盘高度上报。
           沉浸式全屏 + adjustNothing 的组合下，系统不会给窗口留键盘的位置，
           键盘就盖在网页下半截上——横屏时对话框那一半正好被压住，
           于是"点输入框打不了字"。
           这里监听根视图的 inset，把键盘高度告诉网页，让网页把输入区顶上去。 */
        web.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
            @Override
            public WindowInsets onApplyWindowInsets(View v, WindowInsets insets) {
                int ime = 0;
                if (Build.VERSION.SDK_INT >= 30) {
                    ime = insets.getInsets(WindowInsets.Type.ime()).bottom;
                } else {
                    /* API 30 以下没有 WindowInsets.Type.ime()。
                       getWindowVisibleDisplayFrame 是 View 的方法，不是 WindowInsets 的——
                       早先写成了 insets.getWindowVisibleDisplayFrame(r)，编译直接失败。
                       拿可见区域底边和屏幕高度一比，差出来的就是键盘高度。 */
                    android.graphics.Rect r = new android.graphics.Rect();
                    v.getWindowVisibleDisplayFrame(r);
                    int screen = getResources().getDisplayMetrics().heightPixels;
                    ime = screen - r.bottom;
                    if (ime < 0) ime = 0;
                }
                final int kb = ime;
                web.post(new Runnable() {
                    @Override
                    public void run() {
                        callWeb("window.__ZB_ime && window.__ZB_ime(" + kb + ")");
                    }
                });
                return insets;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                android.util.Log.i("ZBWeb", "console " + m.messageLevel() + " "
                        + m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });

        // 存档桥：file:// 下若 localStorage 不可用，网页会改用这里的 SharedPreferences
        web.addJavascriptInterface(
                new StoreBridge(getSharedPreferences("zb_store", MODE_PRIVATE)), "ZBStore");
        // 退出桥：网页里点「退出游戏」时调用，交给 Activity 结束自己。
        // 全屏沉浸模式下系统导航栏是藏着的，没有这个入口就只能靠手势，很难发现。
        web.addJavascriptInterface(new AppBridge(), "ZBApp");
        // 热更新桥：网页问"我是什么外壳版本"、"帮我下载这个包"
        web.addJavascriptInterface(new UpdateBridge(), "ZBUpdate");
        web.loadUrl(resolveStartUrl());
    }

    /** 热更过的 www 目录（解压成功后才存在） */
    private java.io.File hotWwwDir() {
        return new java.io.File(getFilesDir(), "www");
    }

    /** 当前应该加载的入口：有热更资源就用它，否则用安装包内置的 */
    private String resolveStartUrl() {
        try {
            java.io.File idx = new java.io.File(hotWwwDir(), "index.html");
            if (idx.isFile() && idx.length() > 0) {
                return "file://" + idx.getAbsolutePath();
            }
        } catch (Throwable ignored) { }
        return BUNDLED_URL;
    }

    /** 当前外壳版本（就是安装包 versionName，BuildConfig 不一定生成，直接查系统） */
    private String shellVer() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Throwable t) {
            return "0.0.0";
        }
    }

    /* =========================================================
       热更新的 Android 侧
       ---------------------------------------------------------
       只替换网页资源（assets/www 里的那套），不碰 dex。
       流程：下载 zip → 校验 sha256 → 解压到 www_next → 删旧 www → 改名。
       全部在后台线程做，任何一步失败都保持现状，玩家下次照常进游戏。
       ========================================================= */
    private class UpdateBridge {
        @android.webkit.JavascriptInterface
        public String shellVersion() { return shellVer(); }

        @android.webkit.JavascriptInterface
        public void download(final String json) {
            new Thread(new Runnable() {
                @Override
                public void run() {
                    String result = doUpdate(json);
                    final String r = result;
                    web.post(new Runnable() {
                        @Override
                        public void run() {
                            callWeb("window.__ZB_update_done && window.__ZB_update_done("
                                    + jsString(r) + ")");
                        }
                    });
                }
            }).start();
        }
    }

    /** 把字符串安全地放进 JS 调用里 */
    private static String jsString(String s) {
        StringBuilder sb = new StringBuilder("'");
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            if (c == '\\' || c == '\'') sb.append('\\').append(c);
            else if (c == '\n') sb.append("\\n");
            else if (c == '\r') sb.append("\\r");
            else sb.append(c);
        }
        return sb.append("'").toString();
    }

    /** 真正干活：返回给网页的 JSON 结果 */
    private String doUpdate(String json) {
        java.io.File zip = null;
        java.io.File next = new java.io.File(getFilesDir(), "www_next");
        try {
            org.json.JSONObject o = new org.json.JSONObject(json);
            String url = o.optString("www", "");
            String sha = o.optString("sha256", "");
            if (url.length() == 0) return "{\"ok\":false,\"reason\":\"no-url\"}";

            zip = new java.io.File(getCacheDir(), "www_update.zip");
            downloadTo(url, zip);

            if (sha.length() > 0) {
                String got = sha256(zip);
                if (!sha.equalsIgnoreCase(got)) {
                    zip.delete();
                    return "{\"ok\":false,\"reason\":\"sha-mismatch\"}";
                }
            }

            deleteTree(next);
            next.mkdirs();
            unzip(zip, next);
            zip.delete();

            if (!new java.io.File(next, "index.html").isFile()) {
                deleteTree(next);
                return "{\"ok\":false,\"reason\":\"no-index\"}";
            }

            // 原子切换：先删旧目录，再把 www_next 改名成 www
            java.io.File cur = hotWwwDir();
            deleteTree(cur);
            if (!next.renameTo(cur)) {
                deleteTree(next);
                return "{\"ok\":false,\"reason\":\"rename-failed\"}";
            }
            return "{\"ok\":true}";
        } catch (Throwable t) {
            if (zip != null) zip.delete();
            deleteTree(next);
            return "{\"ok\":false,\"reason\":\"exception\"}";
        }
    }

    private void downloadTo(String url, java.io.File out) throws Exception {
        java.net.HttpURLConnection c = (java.net.HttpURLConnection) new java.net.URL(url).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(30000);
        c.setInstanceFollowRedirects(true);
        c.connect();
        int code = c.getResponseCode();
        if (code != 200) {
            c.disconnect();
            throw new java.io.IOException("http " + code);
        }
        java.io.InputStream in = c.getInputStream();
        java.io.FileOutputStream fo = new java.io.FileOutputStream(out);
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) fo.write(buf, 0, n);
        fo.close();
        in.close();
        c.disconnect();
    }

    private static String sha256(java.io.File f) throws Exception {
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
        java.io.FileInputStream in = new java.io.FileInputStream(f);
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
        in.close();
        byte[] d = md.digest();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < d.length; i++) {
            String h = Integer.toHexString(d[i] & 0xff);
            if (h.length() == 1) sb.append('0');
            sb.append(h);
        }
        return sb.toString();
    }

    /* 解压：必须挡路径穿越（zip 里写 ../../evil 这种），否则等于把写入权限送出去 */
    private static void unzip(java.io.File zip, java.io.File dir) throws Exception {
        java.util.zip.ZipInputStream zis =
                new java.util.zip.ZipInputStream(new java.io.FileInputStream(zip));
        String root = dir.getCanonicalPath() + java.io.File.separator;
        java.util.zip.ZipEntry e;
        byte[] buf = new byte[16384];
        while ((e = zis.getNextEntry()) != null) {
            java.io.File dst = new java.io.File(dir, e.getName());
            String canon = dst.getCanonicalPath();
            if (!canon.startsWith(root)) continue;     // 越界条目直接丢掉
            if (e.isDirectory()) {
                dst.mkdirs();
            } else {
                java.io.File parent = dst.getParentFile();
                if (parent != null && !parent.exists()) parent.mkdirs();
                java.io.FileOutputStream fo = new java.io.FileOutputStream(dst);
                int n;
                while ((n = zis.read(buf)) > 0) fo.write(buf, 0, n);
                fo.close();
            }
            zis.closeEntry();
        }
        zis.close();
    }

    private static void deleteTree(java.io.File f) {
        if (f == null || !f.exists()) return;
        if (f.isDirectory()) {
            java.io.File[] kids = f.listFiles();
            if (kids != null) for (int i = 0; i < kids.length; i++) deleteTree(kids[i]);
        }
        f.delete();
    }

    /** 把启动异常显示在屏幕上（并可被截图反馈），避免"点开就没了"的静默闪退 */
    private void showFatal(Throwable t, FrameLayout root) {
        StringBuilder sb = new StringBuilder();
        sb.append("启动失败：").append(t.getClass().getSimpleName()).append('\n');
        sb.append(String.valueOf(t.getMessage())).append("\n\n");
        for (StackTraceElement el : t.getStackTrace()) {
            sb.append("  at ").append(el.toString()).append('\n');
        }
        try {
            java.io.File dir = getExternalFilesDir(null);
            if (dir != null) {
                java.io.FileWriter w = new java.io.FileWriter(new java.io.File(dir, "crash.log"), true);
                w.write(sb.toString());
                w.write("\n----------------\n");
                w.close();
            }
        } catch (Throwable ignored) { }

        ScrollView sc = new ScrollView(this);
        TextView tv = new TextView(this);
        tv.setText("《不属于我的周末》启动失败\n\n" + sb + "\n请把这一屏拍下来反馈。");
        tv.setTextColor(Color.parseColor("#FF6B6B"));
        tv.setTextSize(12f);
        tv.setPadding(24, 24, 24, 24);
        sc.addView(tv);
        root.addView(sc, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) applyImmersive();
    }

    @SuppressWarnings("deprecation")
    private void applyImmersive() {
        View decor = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= 19) {
            decor.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            | View.SYSTEM_UI_FLAG_FULLSCREEN
                            | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            askWebBack();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    /**
     * 先问网页：面板 / 调查中枢 / 菜单是否吃掉这次返回。
     * 网页返回 'handled' 就什么都不做，返回 'exit' 才走退出流程。
     */
    private void askWebBack() {
        if (web == null) { finish(); return; }
        try {
            // 注意：这里必须用匿名内部类。javac 以 android.jar 作 bootclasspath 时没有
            // java.lang.invoke.LambdaMetafactory，写 lambda 会直接编译失败。
            web.evaluateJavascript(
                    "(window.__ZB_back ? window.__ZB_back() : 'exit')",
                    new ValueCallback<String>() {
                        @Override
                        public void onReceiveValue(String value) {
                            if (value != null && value.contains("exit")) {
                                long now = System.currentTimeMillis();
                                if (now - lastBackTime < 2000) {
                                    finish();
                                } else {
                                    lastBackTime = now;
                                    Toast.makeText(MainActivity.this,
                                            "再按一次返回键退出", Toast.LENGTH_SHORT).show();
                                }
                            }
                        }
                    });
        } catch (Exception e) {
            finish();
        }
    }

    @Override
    protected void onPause() {
        // 先让网页存档并停掉音乐：WebView 在后台仍会继续播放 <audio>
        callWeb("window.__ZB_appPause && window.__ZB_appPause()");
        if (web != null) {
            web.onPause();
            web.pauseTimers();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) {
            web.resumeTimers();
            web.onResume();
        }
        callWeb("window.__ZB_appResume && window.__ZB_appResume()");
        applyImmersive();
    }

    /** 安全地调用网页里的钩子（页面还没加载好时不要抛异常） */
    private void callWeb(String js) {
        if (web == null) return;
        try {
            web.evaluateJavascript(js, null);
        } catch (Throwable ignored) { }
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }

    /** 给网页用的键值存储（写入 SharedPreferences） */
    /** 应用级接口：退出 + 屏幕方向 */
    private class AppBridge {
        @android.webkit.JavascriptInterface
        public void exit() {
            runOnUiThread(new Runnable() {
                @Override
                public void run() { finish(); }
            });
        }

        /**
         * 让游戏里的「画面方向」设置真正锁住屏幕方向。
         * mode: "portrait" / "landscape" / "auto"(跟随设备)
         *
         * 之前网页侧只切 CSS 排版，物理方向完全由系统的 sensor 决定，
         * 于是选了「横屏」但设备竖着拿就还是竖屏。现在由网页显式下指令。
         */
        @android.webkit.JavascriptInterface
        public void setOrientation(final String mode) {
            final int value;
            if ("portrait".equals(mode)) {
                value = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_PORTRAIT;
            } else if ("landscape".equals(mode)) {
                // 用 LANDSCAPE 而不是 SENSOR_LANDSCAPE：前者固定横向，
                // 不会因为设备左右翻转而把画面倒过来。
                value = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE;
            } else {
                value = android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR;
            }
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    if (getRequestedOrientation() != value) {
                        setRequestedOrientation(value);
                    }
                }
            });
        }

        /**
         * 用系统自带浏览器打开外部链接（问卷反馈页）。
         * 游戏内 WebView 里上传附件在部分安卓机型上会被拦，
         * 所以问卷一律交给系统浏览器——用户也能顺手截图、转发。
         */
        @android.webkit.JavascriptInterface
        public void openUrl(final String url) {
            if (url == null || url.length() == 0) return;
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    try {
                        android.content.Intent it =
                                new android.content.Intent(android.content.Intent.ACTION_VIEW,
                                        android.net.Uri.parse(url));
                        it.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                        MainActivity.this.startActivity(it);
                    } catch (Throwable t) {
                        Toast.makeText(MainActivity.this, "没有找到可以打开链接的应用",
                                Toast.LENGTH_SHORT).show();
                    }
                }
            });
        }
    }

    public static class StoreBridge {
        private final android.content.SharedPreferences sp;

        StoreBridge(android.content.SharedPreferences sp) {
            this.sp = sp;
        }

        @android.webkit.JavascriptInterface
        public String get(String key) {
            try { return sp.getString(key, null); } catch (Exception e) { return null; }
        }

        @android.webkit.JavascriptInterface
        public void set(String key, String value) {
            try { sp.edit().putString(key, value).apply(); } catch (Exception ignored) { }
        }

        @android.webkit.JavascriptInterface
        public void remove(String key) {
            try { sp.edit().remove(key).apply(); } catch (Exception ignored) { }
        }
    }
}
