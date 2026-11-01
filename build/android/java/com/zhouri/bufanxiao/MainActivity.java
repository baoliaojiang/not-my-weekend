package com.zhouri.bufanxiao;

import android.app.Activity;
import android.content.Intent;
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
    /* 明文资源只剩这一个解包页；真正的网页资源是加密的 assets/www.pkg，
       首次启动时由它解密到应用私有目录，再跳过去加载。 */
    private static final String LOADER_URL = "file:///android_asset/boot/index.html";

    private WebView web;
    private FrameLayout rootView;
    private long lastBackTime = 0L;
    // 玩家在内核过旧对话框里点了「仍要继续」后，跳过二次拦截
    private boolean forceStart = false;

    /* =========================================================
       存档导入：<input type="file"> 的回传通道
       ---------------------------------------------------------
       WebView 默认不会接管 input[type=file] 的点击，
       必须自己实现 onShowFileChooser，用系统文件管理器选文件，
       再通过 ValueCallback 把 Uri 交回网页。
       不实现的话，「导入存档」在 APK 里点了毫无反应——
       用户看到的就是"文件管理器拉不起来"。
       ========================================================= */
    private static final int REQ_FILE = 4101;
    private ValueCallback<android.net.Uri[]> fileCallback;
    private int fileAcceptType = 0;   // 0=任意 1=json 2=文本

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
        rootView = root;
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

            /* 存档导入的入口：网页里点 <input type="file"> 时系统会调这里。
               之前完全没有这个实现，所以 APK 里点「导入存档」一点反应都没有，
               玩家只看到"文件管理器拉不起来"。 */
            @Override
            public boolean onShowFileChooser(WebView view,
                                             ValueCallback<android.net.Uri[]> callback,
                                             WebChromeClient.FileChooserParams params) {
                if (fileCallback != null) {
                    fileCallback.onReceiveValue(null);
                }
                fileCallback = callback;
                fileAcceptType = 0;
                try {
                    String[] accepts = params != null ? params.getAcceptTypes() : null;
                    if (accepts != null) {
                        for (String a : accepts) {
                            if (a == null) continue;
                            String t = a.toLowerCase();
                            if (t.contains("json")) { fileAcceptType = 1; break; }
                            if (t.contains("text") || t.contains("txt")) { fileAcceptType = 2; break; }
                        }
                    }
                } catch (Throwable ignored) { }

                Intent intent = new Intent(Intent.ACTION_GET_CONTENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                if (fileAcceptType == 1) {
                    intent.setType("application/json");
                } else if (fileAcceptType == 2) {
                    intent.setType("text/plain");
                } else {
                    intent.setType("*/*");
                }
                try {
                    startActivityForResult(Intent.createChooser(intent, "选择存档文件"), REQ_FILE);
                    return true;
                } catch (Throwable t) {
                    Toast.makeText(MainActivity.this, "无法打开文件管理器", Toast.LENGTH_LONG).show();
                    fileCallback = null;
                    return false;
                }
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
        // 解包放在原生侧、loadUrl 之前完成：
        // 之前把这一步交给网页（assets/boot 的解包页调 ZBApp.prepare），
        // 结果在真机上 JS 桥没就绪，页面只能报「客户端接口未就绪」并卡住。
        // 现在网页只负责«内容»，文件准备这种事交给原生，链路少一跳，坏了也能自己兜。
        bootLoad(rootView);
    }

    /* =========================================================
       内核体检
       ---------------------------------------------------------
       为什么不能"内嵌 Google WebView"：
         WebView 在 Android 里是一个**系统签名的组件**（com.google.android.webview /
         Trichrome），WebView 工厂只认系统里已安装的提供方。把它的 apk 塞进我们的
         安装包，不会被加载，也不会被选中——这条路在平台层面就是不通的。
         真要自带渲染内核，只能换 GeckoView 这类可嵌入的浏览器库（+60MB、需要
         Gradle/AndroidX，本项目的 aapt2+javac 构建装不下），或者自带 Chromium 自编译。

       所以兼容版能做的是：启动时查一次当前内核版本，太旧就明确告诉玩家去更新，
       而不是让他在一个布局塌掉、按钮点不动的界面上猜。
       阈值 70 是实践数字：:has() 需要 105，dvh 需要 108，但低于 70 连 ES2018 都吃力。
       ========================================================= */
    private String webViewPackageName() {
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                android.content.pm.PackageInfo pi = WebView.getCurrentWebViewPackage();
                if (pi != null) return pi.packageName;
            }
        } catch (Throwable ignored) { }
        return "com.google.android.webview";
    }

    private int webViewMajor() {
        try {
            android.content.pm.PackageInfo pi;
            if (Build.VERSION.SDK_INT >= 26) {
                pi = WebView.getCurrentWebViewPackage();
            } else {
                pi = getPackageManager().getPackageInfo(webViewPackageName(), 0);
            }
            if (pi == null || pi.versionName == null) return 0;
            String v = pi.versionName;
            int dot = v.indexOf('.');
            return Integer.parseInt(dot > 0 ? v.substring(0, dot) : v);
        } catch (Throwable t) {
            return 0;   // 查不到就不拦，宁可放行也不误伤
        }
    }

    /** 网页版地址：内核过旧时调起系统浏览器从这里进（由已装 Chrome/Edge 渲染） */
    private static final String WEB_URL =
            "https://baoliaojiang.github.io/not-my-weekend/dist/";

    /** 内核太旧：弹出原生对话框，二选一，不主动启动游戏（方案 1） */
    private void showOldKernelDialog(final FrameLayout root) {
        final int major = webViewMajor();

        final android.widget.LinearLayout box = new android.widget.LinearLayout(this);
        box.setOrientation(android.widget.LinearLayout.VERTICAL);
        box.setGravity(android.view.Gravity.CENTER);
        box.setPadding(48, 48, 48, 48);
        box.setBackgroundColor(Color.BLACK);
        box.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        android.widget.TextView t = new android.widget.TextView(this);
        t.setText("系统浏览器内核过旧");
        t.setTextColor(Color.parseColor("#F4F1EA"));
        t.setTextSize(18f);
        t.setGravity(android.view.Gravity.CENTER);

        android.widget.TextView d = new android.widget.TextView(this);
        d.setText("当前内核版本 " + major + "，直接进游戏界面可能显示异常、点不动。\n"
                + "游戏没有内嵌渲染内核——Android 的 WebView 是系统组件，无法随安装包分发。\n"
                + "你可以用已安装的 Chrome / Edge 打开网页版（往往内核更新），或先去更新系统 WebView。");
        d.setTextColor(Color.parseColor("#8A8F98"));
        d.setTextSize(12f);
        d.setGravity(android.view.Gravity.CENTER);
        d.setPadding(0, 20, 0, 28);

        android.widget.Button webBtn = new android.widget.Button(this);
        webBtn.setText("用浏览器打开网页版");
        webBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                try {
                    Intent i = new Intent(Intent.ACTION_VIEW, android.net.Uri.parse(WEB_URL));
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(i);
                } catch (Throwable ignored) { }
                finish();   // 让玩家在浏览器里玩，不再占用本 App
            }
        });

        android.widget.Button contBtn = new android.widget.Button(this);
        contBtn.setText("仍要继续");
        contBtn.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                forceStart = true;
                root.removeView(box);
                bootLoad(root);   // 重新进入启动流程，此时 forceStart 已为真
            }
        });

        android.widget.LinearLayout row = new android.widget.LinearLayout(this);
        row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        row.setGravity(android.view.Gravity.CENTER);
        row.addView(webBtn);
        row.addView(contBtn);

        box.addView(t);
        box.addView(d);
        box.addView(row);
        root.addView(box);
    }

    /** 首次启动：先铺一张原生启动页，后台解包，好了再 loadUrl */
    private void bootLoad(final FrameLayout root) {
        // 方案 1：内核 < 70 时弹原生对话框二选一，不主动启动游戏；
        // 玩家点「仍要继续」会把 forceStart 置真，再次进来就跳过拦截。
        final int major = webViewMajor();
        if (!forceStart && major != 0 && major < 70) {
            showOldKernelDialog(root);
            return;
        }
        if (!needUnpack()) {
            web.loadUrl(resolveStartUrl());
            return;
        }

        final android.widget.LinearLayout splash = new android.widget.LinearLayout(this);
        splash.setOrientation(android.widget.LinearLayout.VERTICAL);
        splash.setGravity(android.view.Gravity.CENTER);
        splash.setBackgroundColor(Color.parseColor("#000000"));
        splash.setLayoutParams(new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        final android.widget.TextView title = new android.widget.TextView(this);
        title.setText("正在编译着色器");
        title.setTextColor(Color.parseColor("#F4F1EA"));
        title.setTextSize(18f);
        title.setGravity(android.view.Gravity.CENTER);

        final android.widget.TextView hint = new android.widget.TextView(this);
        hint.setText("正在解包资源…");
        hint.setTextColor(Color.parseColor("#8A8F98"));
        hint.setTextSize(12f);
        hint.setGravity(android.view.Gravity.CENTER);
        hint.setPadding(0, 26, 0, 0);

        splash.addView(title);
        splash.addView(hint);
        root.addView(splash);

        new Thread(new Runnable() {
            @Override
            public void run() {
                String err = null;
                try {
                    unpackWww();
                } catch (final Throwable t) {
                    err = t.getMessage() == null ? "unknown" : t.getMessage();
                }
                final String fail = err;
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        if (fail == null) {
                            root.removeView(splash);
                            web.loadUrl(resolveStartUrl());
                        } else {
                            // 解包失败就停在原生页上说清楚，别把玩家扔进黑屏
                            hint.setText("资源解包失败：" + fail
                                    + "\n请尝试重新安装；仍失败请在设置里导出日志反馈。");
                            hint.setTextColor(Color.parseColor("#F0A89C"));
                        }
                    }
                });
            }
        }).start();
    }

    /** 热更过的 www 目录（解压成功后才存在） */
    private java.io.File hotWwwDir() {
        return new java.io.File(getFilesDir(), "www");
    }

    /** 当前应该加载的入口：有热更资源就用它，否则用安装包内置的 */
    private String resolveStartUrl() {
        // 已经解好包（或热更过）就直接进游戏，只有第一次才走解包页
        try {
            java.io.File idx = new java.io.File(hotWwwDir(), "index.html");
            if (idx.isFile() && idx.length() > 0) {
                return "file://" + idx.getAbsolutePath();
            }
        } catch (Throwable ignored) { }
        return LOADER_URL;
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

    /* =========================================================
       资源解包
       ---------------------------------------------------------
       安装包里存的是 assets/www.pkg：zip 包再过一层流加密。
       这里负责把它解到 files/www，之后 WebView 只从那里加载。
       重不重要只有一条：任何一步失败都要能说清原因（回给解包页），
       不能留一个黑屏让玩家猜。

       版本判定用 files/www.stamp：
         "18"      → 由 18 版安装包的 pkg 解出来的
         "18:hot"  → 18 版内核 + 热更新内容
       启动时比 stamp 的前缀和当前 versionCode：
         一致   → 直接用现有 www
         不一致 → 说明客户端换了安装包，重新解 pkg（热更内容作废，因为新包里更新）
       ========================================================= */
    private static final String PKG_KEY = "zb-weekend-2026-mint-os-4-key-32b";

    private int shellVerCode() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
        } catch (Throwable t) { return 0; }
    }

    private java.io.File stampFile() { return new java.io.File(getFilesDir(), "www.stamp"); }

    private void writeStamp(String v) {
        try {
            java.io.FileOutputStream fo = new java.io.FileOutputStream(stampFile());
            fo.write(v.getBytes("UTF-8"));
            fo.close();
        } catch (Throwable ignored) { }
    }

    private String readStamp() {
        try {
            java.io.File f = stampFile();
            if (!f.isFile()) return "";
            java.io.FileInputStream in = new java.io.FileInputStream(f);
            byte[] b = new byte[(int) f.length()];
            int n = in.read(b);
            in.close();
            return n > 0 ? new String(b, 0, n, "UTF-8").trim() : "";
        } catch (Throwable t) { return ""; }
    }

    /** 需要解包吗？已经解过且安装包没换，就不用 */
    private boolean needUnpack() {
        java.io.File idx = new java.io.File(hotWwwDir(), "index.html");
        if (!idx.isFile() || idx.length() == 0) return true;
        return !readStamp().startsWith(String.valueOf(shellVerCode()));
    }

    /** 流解密：keystream = sha256(KEY || counter)，与 tools/pack-www.mjs 一致 */
    private static byte[] pkgCrypt(byte[] data) throws Exception {
        byte[] key = PKG_KEY.getBytes("UTF-8");
        byte[] out = new byte[data.length];
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
        int blocks = (data.length + 31) / 32;
        byte[] seed = new byte[key.length + 4];
        System.arraycopy(key, 0, seed, 0, key.length);
        for (int i = 0; i < blocks; i++) {
            seed[key.length]     = (byte) ((i >>> 24) & 0xff);
            seed[key.length + 1] = (byte) ((i >>> 16) & 0xff);
            seed[key.length + 2] = (byte) ((i >>> 8) & 0xff);
            seed[key.length + 3] = (byte) (i & 0xff);
            md.reset();
            byte[] ks = md.digest(seed);
            int off = i * 32;
            int n = Math.min(32, data.length - off);
            for (int j = 0; j < n; j++) out[off + j] = (byte) (data[off + j] ^ ks[j]);
        }
        return out;
    }

    private byte[] readAssetAll(String path) throws Exception {
        java.io.InputStream in = getAssets().open(path);
        java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
        in.close();
        return bos.toByteArray();
    }

    /** 解包：读 pkg → 校验头 → 解密 → 解压到 files/www */
    private void unpackWww() throws Exception {
        byte[] raw = readAssetAll("www.pkg");
        if (raw.length < 44) throw new Exception("pkg 太小");
        String magic = new String(raw, 0, 4, "US-ASCII");
        if (!"ZBW1".equals(magic)) throw new Exception("pkg 格式不对");

        int ver = (raw[4] & 0xff) | ((raw[5] & 0xff) << 8) | ((raw[6] & 0xff) << 16) | ((raw[7] & 0xff) << 24);
        if (ver != 1) throw new Exception("pkg 版本不支持: " + ver);

        long plainLen = ((long) (raw[8] & 0xff)) | ((long) (raw[9] & 0xff) << 8)
                | ((long) (raw[10] & 0xff) << 16) | ((long) (raw[11] & 0xff) << 24);
        if (plainLen <= 0 || plainLen > raw.length) throw new Exception("pkg 长度异常");

        byte[] wantHash = new byte[32];
        System.arraycopy(raw, 12, wantHash, 0, 32);

        byte[] cipher = new byte[raw.length - 44];
        System.arraycopy(raw, 44, cipher, 0, cipher.length);
        byte[] plain = pkgCrypt(cipher);

        // 完整性校验：解出来不对就别动现有资源
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
        byte[] gotHash = md.digest(plain);
        if (!java.util.Arrays.equals(gotHash, wantHash)) throw new Exception("内容校验失败");

        java.io.File www = hotWwwDir();
        java.io.File next = new java.io.File(getFilesDir(), "www_boot");
        deleteTree(next);
        next.mkdirs();
        untarBytes(plain, next);
        if (!new java.io.File(next, "index.html").isFile()) {
            deleteTree(next);
            throw new Exception("包里没有 index.html");
        }

        deleteTree(www);
        if (!next.renameTo(www)) {
            // 改名失败（少数文件系统会拒绝），退一步逐层拷贝
            copyTree(next, www);
            deleteTree(next);
            if (!new java.io.File(www, "index.html").isFile()) throw new Exception("资源落盘失败");
        }
        writeStamp(String.valueOf(shellVerCode()));
    }

    /* 解 tar：容器是 tar 而不是 zip——定长 512 字节头，读起来比 zip 的
       本地头/中央目录两套结构简单得多，也不会因为压缩方法差异解不出来。
       只处理普通文件与目录；遇到其它类型（符号链接等）直接跳过。 */
    private static void untarBytes(byte[] tar, java.io.File dir) throws Exception {
        String root = dir.getCanonicalPath() + java.io.File.separator;
        int pos = 0;
        byte[] buf = new byte[8192];
        while (pos + 512 <= tar.length) {
            // 连续两个全零块表示归档结束；这里遇到第一个零块就停
            boolean zero = true;
            for (int i = 0; i < 512; i++) {
                if (tar[pos + i] != 0) { zero = false; break; }
            }
            if (zero) break;

            String name = cstr(tar, pos, 100);
            long size = octal(tar, pos + 124, 12);
            char type = (char) (tar[pos + 156] & 0xff);
            pos += 512;

            if (name.startsWith("./")) name = name.substring(2);
            if (name.startsWith("/")) name = name.substring(1);

            long body = ((size + 511) / 512) * 512;

            if (name.length() == 0) { pos += (int) body; continue; }
            if (type == '5' || name.endsWith("/")) {
                new java.io.File(dir, name).mkdirs();
                pos += (int) body;
                continue;
            }
            if (type != '0' && type != 0) { pos += (int) body; continue; }

            java.io.File dst = new java.io.File(dir, name);
            String canon = dst.getCanonicalPath();
            if (!canon.startsWith(root)) { pos += (int) body; continue; }   // 挡路径穿越
            java.io.File parent = dst.getParentFile();
            if (parent != null && !parent.exists()) parent.mkdirs();

            java.io.FileOutputStream fo = new java.io.FileOutputStream(dst);
            long left = size;
            int off = pos;
            while (left > 0) {
                int n = (int) Math.min(buf.length, left);
                fo.write(tar, off, n);
                off += n;
                left -= n;
            }
            fo.close();
            pos += (int) body;
        }
    }

    /** tar 头里的字符串字段：NUL 或空格结尾 */
    private static String cstr(byte[] b, int off, int len) {
        int end = off;
        while (end < off + len && b[end] != 0) end++;
        try { return new String(b, off, end - off, "UTF-8").trim(); }
        catch (Throwable t) { return ""; }
    }

    /** tar 头里的八进制数字字段（可能是空格/NUL 结尾） */
    private static long octal(byte[] b, int off, int len) {
        long v = 0;
        for (int i = off; i < off + len; i++) {
            int c = b[i] & 0xff;
            if (c == 0 || c == ' ') continue;
            if (c < '0' || c > '7') continue;
            v = v * 8 + (c - '0');
        }
        return v;
    }

    private static void copyTree(java.io.File from, java.io.File to) {
        if (from == null || !from.exists()) return;
        if (from.isDirectory()) {
            to.mkdirs();
            java.io.File[] kids = from.listFiles();
            if (kids != null) for (int i = 0; i < kids.length; i++) copyTree(kids[i], new java.io.File(to, kids[i].getName()));
        } else {
            try {
                java.io.FileInputStream in = new java.io.FileInputStream(from);
                java.io.FileOutputStream out = new java.io.FileOutputStream(to);
                byte[] buf = new byte[16384];
                int n;
                while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                in.close(); out.close();
            } catch (Throwable ignored) { }
        }
    }

    /** 解包页调用的入口：后台跑，进度回调给网页 */
    private void startPrepare() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    if (!needUnpack()) {
                        final String url = "file://" + new java.io.File(hotWwwDir(), "index.html").getAbsolutePath();
                        web.post(new Runnable() { public void run() {
                            callWeb("window.__zb_prep && window.__zb_prep(100,'准备完成')");
                            callWeb("window.__zb_prep_done && window.__zb_prep_done(" + jsString(url) + ")");
                        }});
                        return;
                    }
                    web.post(new Runnable() { public void run() {
                        callWeb("window.__zb_prep && window.__zb_prep(26,'正在解包资源…')");
                    }});
                    unpackWww();
                    web.post(new Runnable() { public void run() {
                        callWeb("window.__zb_prep && window.__zb_prep(88,'正在载入界面…')");
                    }});
                    final String url = "file://" + new java.io.File(hotWwwDir(), "index.html").getAbsolutePath();
                    web.post(new Runnable() { public void run() {
                        callWeb("window.__zb_prep_done && window.__zb_prep_done(" + jsString(url) + ")");
                    }});
                } catch (final Throwable t) {
                    final String why = (t.getMessage() == null ? "unknown" : t.getMessage());
                    web.post(new Runnable() { public void run() {
                        callWeb("window.__zb_prep_fail && window.__zb_prep_fail(" + jsString(why) + ")");
                    }});
                }
            }
        }).start();
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
            // 标记成热更内容：下次启动直接用，不要被安装包里的旧 pkg 覆盖
            writeStamp(shellVerCode() + ":hot");
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

    /** 文件管理器选完之后的回传：把 Uri 交还给网页的 input[type=file] */
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE) return;
        ValueCallback<android.net.Uri[]> cb = fileCallback;
        fileCallback = null;
        if (cb == null) return;
        if (resultCode != RESULT_OK || data == null) {
            cb.onReceiveValue(null);   // 取消选择
            return;
        }
        try {
            android.net.Uri uri = data.getData();
            if (uri == null) {
                cb.onReceiveValue(null);
                return;
            }
            cb.onReceiveValue(new android.net.Uri[]{ uri });
        } catch (Throwable t) {
            cb.onReceiveValue(null);
        }
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

        /* 解包页在"编译着色器"这一步调用它：
           首次启动解加密资源，之后基本是空跑（直接给地址）。 */
        @android.webkit.JavascriptInterface
        public void prepare() { startPrepare(); }

        /* 把一段文本写到系统的「下载」目录。
           为什么不用网页的 <a download>：WebView 没有注册 DownloadListener，
           点了不会有任何反应——存档导出在 APK 里等于废的。
           为什么走 MediaStore：Android 10 起应用不能直接写公共下载目录，
           MediaStore.Downloads 是官方给的正路；更老的系统退回应用外部目录
           （不需要任何权限，路径会回传给网页并显示给用户）。 */
        @android.webkit.JavascriptInterface
        public String saveText(String name, String content) {
            try {
                if (name == null || name.length() == 0) name = "zb-export.txt";
                byte[] bytes = content == null ? new byte[0] : content.getBytes("UTF-8");

                if (android.os.Build.VERSION.SDK_INT >= 29) {
                    android.content.ContentValues cv = new android.content.ContentValues();
                    cv.put(android.provider.MediaStore.MediaColumns.DISPLAY_NAME, name);
                    cv.put(android.provider.MediaStore.MediaColumns.MIME_TYPE,
                            name.endsWith(".json") ? "application/json" : "text/plain");
                    cv.put(android.provider.MediaStore.MediaColumns.RELATIVE_PATH,
                            android.os.Environment.DIRECTORY_DOWNLOADS);
                    android.net.Uri uri = getContentResolver().insert(
                            android.provider.MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                    if (uri == null) return "";
                    java.io.OutputStream os = getContentResolver().openOutputStream(uri);
                    if (os == null) return "";
                    os.write(bytes);
                    os.flush();
                    os.close();
                    return "下载/" + name;
                }

                java.io.File dir = getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS);
                if (dir == null) dir = getFilesDir();
                if (!dir.exists()) dir.mkdirs();
                java.io.File f = new java.io.File(dir, name);
                java.io.FileOutputStream fo = new java.io.FileOutputStream(f);
                fo.write(bytes);
                fo.close();
                return f.getAbsolutePath();
            } catch (Throwable t) {
                return "";
            }
        }

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
