' ScaleSync silent launcher — hides the cmd window so a double-click doesn't
' flash a terminal. Calls launch.bat in the same directory.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
here = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = here
shell.Run """" & here & "\launch.bat""", 0, False
