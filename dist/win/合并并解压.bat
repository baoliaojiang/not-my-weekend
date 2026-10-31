@echo off
chcp 65001 >nul
copy /b "不属于我的周末-0.6.2.3-Windows.zip.001"+"不属于我的周末-0.6.2.3-Windows.zip.002"+"不属于我的周末-0.6.2.3-Windows.zip.003" "不属于我的周末-0.6.2.3-Windows.zip" >nul
tar -xf "不属于我的周末-0.6.2.3-Windows.zip"
echo 完成，打开文件夹里的 exe 即可。
pause
