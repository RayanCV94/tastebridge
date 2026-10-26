' Lance tastebridge sans aucune fenêtre (double-clic)
Set fso = CreateObject("Scripting.FileSystemObject")
Set s = CreateObject("WScript.Shell")
s.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
s.Run "pythonw recos.py", 0, False
