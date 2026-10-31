@echo off
chcp 65001 >nul
echo 正在合并分卷（请保持本 bat 与三个 .part 文件在同一目录）...
copy /b 不属于我的周末-Windows-0.6.2.3.zip.00.part+不属于我的周末-Windows-0.6.2.3.zip.01.part+不属于我的周末-Windows-0.6.2.3.zip.02.part 不属于我的周末-Windows-0.6.2.3.zip
if exist 不属于我的周末-Windows-0.6.2.3.zip (
  echo 合并完成：不属于我的周末-Windows-0.6.2.3.zip
  echo 右键该 zip 选「全部解压」，运行里面的 不属于我的周末.exe 即可。
) else (
  echo 合并失败，请确认三个 .part 文件都在同一目录。
)
pause
