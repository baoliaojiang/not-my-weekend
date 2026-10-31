@echo off
chcp 65001 >nul
echo 正在合并 0.6.2.1 Windows 便携版的分卷...
copy /b "不属于我的周末-0.6.2.1-Windows.zip.001"+"不属于我的周末-0.6.2.1-Windows.zip.002"+"不属于我的周末-0.6.2.1-Windows.zip.003" "不属于我的周末-0.6.2.1-Windows.zip" >nul
if not exist "不属于我的周末-0.6.2.1-Windows.zip" (
  echo 合并失败：请确认三个分卷和本脚本在同一个文件夹里。
  pause
  exit /b 1
)
echo 正在解压...
tar -xf "不属于我的周末-0.6.2.1-Windows.zip"
echo 完成。打开「不属于我的周末」文件夹，双击 不属于我的周末.exe 即可运行。
pause
