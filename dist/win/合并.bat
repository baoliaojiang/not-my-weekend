@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo 正在合并分卷（共 2 段）...
copy /b "不属于我的周末-v0.6.4.0-win.zip.00"+"不属于我的周末-v0.6.4.0-win.zip.01" "不属于我的周末-v0.6.4.0-win.zip" >nul
if exist "不属于我的周末-v0.6.4.0-win.zip" (
  echo 合并完成：不属于我的周末-v0.6.4.0-win.zip
  echo 右键该 zip 选「全部解压」，运行里面的 exe 即可。
) else (
  echo 合并失败，请确认分卷文件都在同一目录。
)
pause
