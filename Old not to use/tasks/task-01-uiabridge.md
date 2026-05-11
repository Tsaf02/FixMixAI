# SUBAGENT TASK 01: C# UIAutomation Bridge (POC)

## Assigned To
Backend/Windows API Agent (Sonnet 4.6 Thinking)

## Objective
Build a proof-of-concept C# CLI application (`UiaBridge.exe`) that uses the Windows UIAutomation API to read text from AI desktop apps (specifically Claude Desktop). 

## Requirements (Phase 1 Tests 1, 6, 7, 8)
1. **Target:** Identify the Claude Desktop window.
2. **Identify Elements:** Distinguish between the "input area" (prompt box) and the "response area" (chat history).
3. **Extract Text & Coordinates:** Read the text content and bounding rectangles (X, Y, Width, Height) of the elements in the response area.
4. **Performance:** Ensure scanning does not freeze the mouse or the target app's UI thread (run scanning on a background thread).
5. **Output:** Output the extracted data as JSON to `stdout` so it can be consumed by a Node.js parent process.

## Output JSON Format Example
```json
{
  "windowHandle": "0x1004A",
  "appName": "Claude",
  "elements": [
    {
      "type": "Text",
      "content": "Here is the response...",
      "bounds": { "x": 100, "y": 250, "width": 800, "height": 45 }
    }
  ]
}
```

## Instructions
1. Initialize a simple C# Console App project (e.g., `dotnet new console -n UiaBridge`).
2. Add references to `UIAutomationClient` and `UIAutomationTypes`.
3. Implement the scanning logic.
4. **CRITICAL:** Do NOT stop to ask the user questions during compilation or setup. Only stop when the code is fully ready for a test.
5. Test it against an open Claude Desktop window. To request a test, use the Translator Protocol: Update `PROJECT_DASHBOARD.md` status to `🟣 WAITING FOR USER TEST` and write your request there.
6. Update your status in `PROJECT_DASHBOARD.md` when `✅ DONE` or `🔴 BLOCKED`.
