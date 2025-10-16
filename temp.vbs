'$language = "VBScript"
'$interface = "1.0"

Sub Main
    crt.Screen.Synchronous = True
    
    Dim prompt
    prompt = ">"

    Dim commands
    commands = Array( _
        Array("d:", 10), _
        Array("cd D:\platform-tools\upload", 10), _
        Array("adb root", 20), _
        Array("adb remount", 15), _
        Array("adb devices", 10), _
        Array("cd D:\Project-JavaScript\TVControl", 10), _
        Array("npm run dev", 30) _
    )
    
    Dim i, commandEntry
    For i = 0 To UBound(commands)
        commandEntry = commands(i)
        If Not SendCommandAndWait(commandEntry(0), prompt, commandEntry(1)) Then
            Exit For
        End If
    Next
    
    crt.Screen.Synchronous = False
End Sub

Function SendCommandAndWait(command, prompt, timeout)
    On Error Resume Next
    
    SendCommandAndWait = False
    
    Dim commandToSend, commandStartRow
    commandStartRow = crt.Screen.CurrentRow

    commandToSend = command
    If Len(commandToSend) = 0 Then
        crt.Dialog.MessageBox "Error: Command cannot be empty."
        Exit Function
    End If

    If Right(commandToSend, 1) <> vbCr Then
        commandToSend = commandToSend & vbCr
    End If

    crt.Screen.Send commandToSend
    
    If Not WaitForPrompt(prompt, timeout, commandStartRow) Then
        crt.Dialog.MessageBox "Command failed: " & command & _
                            vbCrLf & "Prompt not received within the timeout interval."
        Exit Function
    End If
    
    SendCommandAndWait = True
    
    On Error Goto 0
End Function

Function WaitForPrompt(prompt, timeout, minRow)
    On Error Resume Next
    
    WaitForPrompt = False
    
    If IsEmpty(prompt) Or prompt = "" Then
        crt.Dialog.MessageBox "Error: Prompt string cannot be empty."
        Exit Function
    End If
    
    If Not IsNumeric(timeout) Or timeout <= 0 Then
        crt.Dialog.MessageBox "Error: Timeout value must be a positive number."
        Exit Function
    End If
    
    If Not IsNumeric(minRow) Or minRow <= 0 Then
        crt.Dialog.MessageBox "Error: Invalid starting row supplied for prompt detection."
        Exit Function
    End If
    
    Dim startTime, remaining, lineText, promptRow
    startTime = Timer
    
    Do
        remaining = timeout - GetElapsedSeconds(startTime)
        If remaining <= 0 Then
            crt.Dialog.MessageBox "Timed out waiting for prompt." & _
                                vbCrLf & "Expected prompt: " & prompt & _
                                vbCrLf & "Timeout: " & timeout & " seconds." & _
                                vbCrLf & "Please verify the command output or increase the timeout."
            Exit Function
        End If
        
        If Not crt.Screen.WaitForString(prompt, remaining) Then
            crt.Dialog.MessageBox "Timed out waiting for prompt." & _
                                vbCrLf & "Expected prompt: " & prompt & _
                                vbCrLf & "Timeout: " & timeout & " seconds." & _
                                vbCrLf & "Please verify the command output or increase the timeout."
            Exit Function
        End If

        If Err.Number <> 0 Then
            crt.Dialog.MessageBox "Error while waiting for prompt: " & Err.Description & _
                                vbCrLf & "Error code: " & Err.Number
            Err.Clear
            Exit Function
        End If

        promptRow = crt.Screen.CurrentRow
        
        If promptRow > minRow Then
            lineText = GetCurrentLineIncludingPrompt(prompt)
            If LooksLikePrompt(lineText, prompt) Then
                WaitForPrompt = True
                Exit Do
            End If
        End If
        
        ' Continue waiting if the detected delimiter was part of the command output
    Loop
    
    On Error Goto 0
End Function

Function GetCurrentLineIncludingPrompt(prompt)
    Dim row, col, lastCol, lineText
    row = crt.Screen.CurrentRow
    col = crt.Screen.CurrentColumn
    
    lastCol = col - 1
    If lastCol < 1 Then
        lastCol = 1
    End If
    If lastCol > crt.Screen.Columns Then
        lastCol = crt.Screen.Columns
    End If

    lineText = crt.Screen.Get(row, 1, row, lastCol)

    If Err.Number <> 0 Then
        crt.Dialog.MessageBox "Error while reading prompt line: " & Err.Description & _
                            vbCrLf & "Error code: " & Err.Number
        Err.Clear
        lineText = ""
    End If
    
    GetCurrentLineIncludingPrompt = lineText
End Function

Function LooksLikePrompt(lineText, prompt)
    Dim trimmedLine, prefix
    trimmedLine = Trim(lineText)
    If Len(trimmedLine) < Len(prompt) Then
        LooksLikePrompt = False
        Exit Function
    End If
    
    If Right(trimmedLine, Len(prompt)) <> prompt Then
        LooksLikePrompt = False
        Exit Function
    End If
    
    prefix = Left(trimmedLine, Len(trimmedLine) - Len(prompt))
    
    If Len(prefix) = 0 Then
        LooksLikePrompt = True
        Exit Function
    End If
    
    If InStr(prefix, ":\") > 0 Or InStr(prefix, ":/") > 0 Then
        LooksLikePrompt = True
        Exit Function
    End If
    
    If InStr(prefix, "PS ") = 1 Then
        LooksLikePrompt = True
        Exit Function
    End If
    
    LooksLikePrompt = False
End Function

Function GetElapsedSeconds(startTime)
    Dim currentTime
    currentTime = Timer
    If currentTime >= startTime Then
        GetElapsedSeconds = currentTime - startTime
    Else
        GetElapsedSeconds = (86400 - startTime) + currentTime
    End If
End Function
