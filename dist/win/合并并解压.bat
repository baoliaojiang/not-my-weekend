@echo off
chcp 65001 >nul
echo 正在合并 0.6.2.2 Windows 便携版分卷...
copy /b "不属于我的周末-0.6.2.2-Windows.zip.001"+"不属于我的周末-0.6.2.2-Windows.zip.002"+"不属于我的周末-0.6.2.2-Windows.zip.003" "不属于我的周末-0.6.2.2-Windows.zip" >nul
tar -xf "不属于我的周末-0.6.2.2-Windows.zip"
echo 完成，打开文件夹里的 exe 即可。
pause
