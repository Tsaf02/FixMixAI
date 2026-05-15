# CDP Research — Desktop AI Apps on Windows
**Date:** 2026-05-15
**Purpose:** Determine which desktop AI apps can be read via Chrome DevTools Protocol (CDP) to extract DOM + CSS for RTL correction overlay.

---

## Summary Table

| App | Framework | CDP in Production? | What's Needed | Confidence |
|---|---|---|---|---|
| **Claude Desktop** | Tauri 2 + WebView2 (Store) | ❌ Blocked | Blocked at two levels — Tauri release build + Microsoft Store UWP sandbox | High confidence it WON'T work |
| **ChatGPT Desktop** | Electron | ⚠️ Possible | Relaunch with `--remote-debugging-port=9224`; fuse state unknown | Medium — needs empirical test |
| **Cursor** | Electron (VS Code fork) | ✅ Likely works | Relaunch with `--remote-debugging-port=9222` | High — community-confirmed |
| **Windsurf** | Electron (VS Code fork) | ✅ Likely works | Relaunch with `--remote-debugging-port=9222` | High — same architecture as Cursor |
| **Microsoft Copilot** | WebView2 | ⚠️ Low-Medium | Registry key + relaunch; Store sandbox uncertain | Low — needs testing |
| **Gemini (PWA via browser)** | Chrome/Edge | ✅ Works | Launch browser with `--remote-debugging-port=9222` | High — standard browser CDP |
| **Gemini (new native app)** | Unknown (April 2026) | ❓ Unknown | Depends on framework | Unknown |

---

## Key Finding: Claude Desktop is the Exception

Claude Desktop is the hardest target and is the main use case for FixMixAI. CDP is **doubly blocked**:
1. Tauri release builds compile out the devtools feature (`#[cfg(debug_assertions)]` wrapper)
2. Microsoft Store UWP sandbox blocks DevTools in store-signed WebView2 apps (documented in [WebView2Feedback Issue #4557](https://github.com/MicrosoftEdge/WebView2Feedback/issues/4557))

No public workaround exists for the production Store build.

---

## Per-App Details

### Claude Desktop (Tauri 2, Microsoft Store)
- Uses **Edge WebView2** as the rendering engine (NOT bundled Chromium contrary to some earlier fingerprinting — Tauri 2 switched to WebView2 on Windows)
- CDP disabled in release builds by design
- Store packaging adds a second block — Microsoft documents that DevTools cannot be launched inside store-signed WebView2 UWP apps
- Registry trick (`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`) requires pre-launch setup and is likely ineffective for Store-sandboxed apps
- **Bottom line:** CDP access not viable for Claude Desktop production install

### ChatGPT Desktop (Electron)
- Confirmed Electron (not WebView2)
- Must be relaunched with flag: `"%LOCALAPPDATA%\Programs\ChatGPT\ChatGPT.exe" --remote-debugging-port=9224`
- Whether OpenAI has disabled the `nodeCliInspect` Electron fuse is not publicly documented
- Needs empirical test on Windows binary
- **Source:** [OpenCLI ChatGPT adapter](https://opencli.info/docs/adapters/desktop/chatgpt-app.html)

### Cursor (Electron, VS Code fork)
- Relaunch with: `"%LOCALAPPDATA%\Programs\cursor\Cursor.exe" --remote-debugging-port=9222`
- Community-confirmed — multiple tutorials and tools (CursorRemote, Cursor forum DevTools tutorial)
- VS Code forks unlikely to have hardened Electron fuses
- **Source:** [Cursor forum tutorial](https://forum.cursor.com/t/tutorial-supercharged-cursor-composer-agent-with-chrome-devtools/51394), [CursorRemote GitHub](https://github.com/len5ky/CursorRemote)

### Windsurf (Electron, VS Code fork)
- Same architecture as Cursor — same approach applies
- Relaunch with: `"%LOCALAPPDATA%\Programs\Windsurf\Windsurf.exe" --remote-debugging-port=9222`
- Not independently community-tested but architecture is identical to Cursor
- Note: ships outdated Chromium (132) with 94+ known CVEs — doesn't affect CDP but relevant to security posture

### Microsoft Copilot Desktop (WebView2)
- Uses WebView2 with bundled Edge (~850MB)
- CDP theoretically accessible via registry key before launch
- Store/MSIX packaging may block — same issue as Claude Desktop
- **Source:** [Microsoft WebView2 CDP docs](https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/chromium-devtools-protocol)

### Gemini Desktop
- Pre-April 2026: PWA via Chrome/Edge — CDP works via browser's own debug port
- New native app (April 2026): framework unknown, needs install directory inspection
- If Electron: same as ChatGPT/Cursor approach
- If WebView2: same as Copilot approach

---

## General Rules

### Tauri Apps (Windows)
- Use Edge WebView2 (not bundled Chromium)
- CDP disabled in release builds by design (`#[cfg(debug_assertions)]`)
- Store distribution adds a second block
- No runtime toggle — compile-time decision only

### Electron Apps
- Embed own Chromium (not system WebView2)
- CDP NOT exposed by default in production
- Requires `--remote-debugging-port=N` flag at launch
- Flag is blocked only if developer explicitly disabled `nodeCliInspect` Electron fuse
- Fuse is **enabled by default** — developer tools (Cursor, Windsurf) unlikely to have disabled it

### Can you attach CDP to a running app without relaunch?
**No.** The debug port must be set at process start. There is no standard API to enable it on a live process. DLL injection is theoretically possible but requires elevated privileges and defeats the non-intrusive goal.

---

## Strategic Conclusion for FixMixAI

CDP works well for **coding tools** (Cursor, Windsurf) and possibly ChatGPT Desktop — but NOT for Claude Desktop, which is the primary target.

**For Claude Desktop specifically**, alternatives are:
1. **Clipboard HTML** (`clipboard.readHTML()`) — already implemented, good for text content
2. **Windows UIAutomation** — can read text from WebView2 controls without CDP (current approach, has the typing-disruption bug to fix)
3. **Windows Graphics Capture API** — pixel-perfect mirror (Phase 2 visual magnet)
4. **Clipboard change notification** (`AddClipboardFormatListener`) — event-driven trigger when user copies (non-polling alternative to UIA)

---

## Sources
- [Haprog/tauri-cdp GitHub](https://github.com/Haprog/tauri-cdp)
- [Tauri Debug Documentation](https://v2.tauri.app/develop/debug/)
- [Electron Fuses Documentation](https://www.electronjs.org/docs/latest/tutorial/fuses)
- [WebView2Feedback Issue #4557](https://github.com/MicrosoftEdge/WebView2Feedback/issues/4557)
- [Microsoft: Remote debugging WebView2 UWP apps](https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/remote-debugging)
- [Microsoft: CDP in WebView2 apps](https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/chromium-devtools-protocol)
- [OpenCLI ChatGPT Desktop adapter](https://opencli.info/docs/adapters/desktop/chatgpt-app.html)
- [Cursor forum: DevTools tutorial](https://forum.cursor.com/t/tutorial-supercharged-cursor-composer-agent-with-chrome-devtools/51394)
- [CursorRemote GitHub](https://github.com/len5ky/CursorRemote)
- [Knostic: Cursor code injection research](https://www.knostic.ai/blog/demonstrating-code-injection-vscode-cursor)
- [WindowsLatest: Copilot is WebView2](https://www.windowslatest.com/2024/12/11/microsoft-says-new-copilot-windows-11-app-is-native-but-no-its-a-webview-uses-1gb-ram/)
- [Engadget: Gemini Windows app](https://www.engadget.com/apps/googles-new-windows-app-is-yet-another-way-to-access-gemini-214000564.html)
