/* 预加载脚本：只把"热更新"这一件事暴露给网页。
   contextIsolation 保持开启，网页拿不到 Node，也拿不到任意 IPC。 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zbUpdate', {
  // 当前客户端外壳版本（Electron 的 package.json version）
  shellVersion: () => ipcRenderer.sendSync('zb:shell-version'),
  // 下载并安装新的网页资源；返回 { ok, reason }
  download: (remote) => ipcRenderer.invoke('zb:download', remote)
});
