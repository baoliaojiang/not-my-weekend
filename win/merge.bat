@echo off
cd /d "%~dp0"
echo Merging 2 part(s)...
copy /b "NotMyWeekend-0.6.7.0-win.zip.00"+"NotMyWeekend-0.6.7.0-win.zip.01" "NotMyWeekend-0.6.7.0-win.zip" >nul
if exist "NotMyWeekend-0.6.7.0-win.zip" (
  echo Done: NotMyWeekend-0.6.7.0-win.zip
  echo Right-click the zip and choose "Extract All", then run the exe inside.
) else (
  echo Failed: put this bat in the same folder as the .zip.00 files.
)
pause
