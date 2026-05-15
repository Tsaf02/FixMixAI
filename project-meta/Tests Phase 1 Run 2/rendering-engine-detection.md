# Rendering Engine Detection Guide
**For AI Development Agents — Windows PowerShell Investigation**

---

## Goal
Identify what rendering engine a desktop app or browser extension uses to display its UI windows (chat panel, editor panel, artifact panel, etc.), so the agent can reason about text rendering capabilities: BiDi, RTL, HTML/CSS support, accessibility APIs, and font handling.

---

## PowerShell Commands That Work

### Step 1 — List all open apps with visible windows
```powershell
Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object Name, Id, MainWindowTitle | Sort-Object Name
```
**What it tells you:** Which processes currently have a visible window. Match process names to open apps.

---

### Step 2 — Find the install path and description of a specific app
```powershell
Get-Process -Name "claude" | Select-Object Name, Id, Path, Description
```
**What it tells you:**
- Install path reveals packaging type (e.g., `WindowsApps` = Microsoft Store / MSIX)
- Multiple instances of the same `.exe` = likely Electron or Chromium-based (multi-process architecture)

---

### Step 3 — Detect WebView2 usage (Edge/Chromium embedded)
```powershell
Get-CimInstance Win32_Process -Filter "name='msedgewebview2.exe'" | Select-Object ProcessId, ParentProcessId, CommandLine | Format-List
```
**What it tells you:**
- The `--webview-exe-name=` parameter reveals which app owns each WebView2 instance
- If an app's `.exe` appears as `ParentProcessId`, it uses **WebView2** (Chromium via Microsoft Edge)
- Example from this session: `WhatsApp.Root.exe`, `M365Copilot.exe`, `SearchHost.exe` all use WebView2

---

### Step 4 — Scan app directory for engine fingerprint DLLs
```powershell
Get-ChildItem "C:\Path\To\App\" -Recurse -Include "*.dll" | Where-Object {$_.Name -match "webview|webkit|cef|chromium|electron"} | Select-Object Name, DirectoryName
```
**What it tells you:** Presence of specific DLLs identifies the rendering engine.

---

### Step 5 — List all files in app directory (most reliable fingerprinting)
```powershell
Get-ChildItem "C:\Path\To\App\" | Select-Object Name, Length
```
**What it tells you:** File signatures that identify the engine (see Engine Fingerprints table below).

---

## Engine Fingerprints — What to Look For

### Chromium Embedded (bundled)
| File Found | Meaning |
|---|---|
| `chrome_100_percent.pak` | Chromium asset pack — definitive proof |
| `chrome_200_percent.pak` | Chromium HiDPI assets |
| `LICENSES.chromium.html` | Explicit Chromium license — definitive proof |
| `icudtl.dat` | Chromium ICU Unicode library |
| `v8_context_snapshot.bin` | V8 JavaScript engine snapshot |
| `snapshot_blob.bin` | V8 startup snapshot |
| `libEGL.dll` + `libGLESv2.dll` | Chromium GPU rendering |
| `ffmpeg.dll` | Media handling (same as Chrome) |
| `vk_swiftshader.dll` | Vulkan software renderer |
| `.exe` > 150MB | Chromium bundled inside the binary |

→ **Verdict: Bundled Chromium** (framework: likely Tauri v2 with bundled Chromium, or CEF)

---

### Electron
| File Found | Meaning |
|---|---|
| All of the above PLUS | — |
| `electron.exe` or app named `electron` | Pure Electron |
| Many helper processes with same `.exe` name | Electron multi-process model |
| `resources/app.asar` | Electron app package |

→ **Verdict: Electron** (Chromium + Node.js)

---

### WebView2 (Edge Chromium, system-installed)
| Signal Found | Meaning |
|---|---|
| `msedgewebview2.exe` in process list | App uses system Edge WebView2 |
| `--webview-exe-name=YourApp.exe` in CommandLine | Confirms which app owns the WebView2 |
| `WebView2Loader.dll` in app folder | App loads WebView2 at runtime |
| Small `.exe` size (< 10MB) | Not bundling Chromium, using system WebView2 |

→ **Verdict: WebView2** (Chromium via Microsoft Edge, version tied to Windows updates)

---

### Native / Non-Chromium
| Signal Found | Meaning |
|---|---|
| No pak files, no V8 files | Not Chromium |
| `Qt5*.dll` or `Qt6*.dll` | Qt framework (native rendering) |
| `wx*.dll` | wxWidgets |
| No WebView2 in process tree | Fully native |
| Small binary, no helper processes | Native UI |

→ **Verdict: Native** (no web rendering engine)

---

### Browser Extension (e.g., Sider, Copilot in Chrome)
| Signal | Meaning |
|---|---|
| No separate process in Task Manager | Runs inside the host browser |
| Visible only when browser is open | Parasitic on browser process |
| Uses Chrome `Side Panel API` or `content_scripts` | HTML/CSS/JS inside Chrome's renderer |

→ **Verdict: Inherits host browser engine** (no independent rendering)

---

## Known Engine Map — Popular AI Tools (Windows)

| Tool | Process Name | Engine Type | Chromium? | Notes |
|---|---|---|---|---|
| **Claude Desktop** | `claude.exe` | Bundled Chromium | ✅ Yes | Tauri + embedded Chromium. Ships `chrome_*.pak`, `v8_*.bin`, `LICENSES.chromium.html`. 223MB binary. No WebView2 dependency. |
| **ChatGPT Desktop** | `ChatGPT.exe` | Electron | ✅ Yes | Multiple helper processes, ships Node.js |
| **Cursor** | `Cursor.exe` | Electron (VS Code fork) | ✅ Yes | Identical structure to VS Code |
| **Windsurf** | `Windsurf.exe` | Electron (VS Code fork) | ✅ Yes | Formerly Codeium |
| **Google Antigravity** | `Antigravity.exe` | Electron (VS Code fork) | ✅ Yes | Built on VS Code base |
| **GitHub Copilot** | — | Extension / Plugin | ✅ Yes (inherited) | Runs inside VS Code or browser |
| **WhatsApp Desktop** | `WhatsApp.Root.exe` | WebView2 | ✅ Yes | Confirmed via `--webview-exe-name=WhatsApp.Root.exe` |
| **Microsoft 365 Copilot** | `M365Copilot.exe` | WebView2 | ✅ Yes | Confirmed via `--webview-exe-name=M365Copilot.exe` |
| **Gemini (macOS)** | `Gemini` | Native (Swift/WKWebView) | ✅ Partial | macOS native shell + WKWebView for content |
| **Sider (Chrome ext.)** | — | Chrome Extension | ✅ Yes (inherited) | Side Panel API, runs inside Chrome process |
| **Wispr Flow** | `Wispr Flow.exe` | Unknown / likely Electron | ✅ Likely | Not confirmed in this session |
| **Google Chrome** | `chrome.exe` | Chromium | ✅ Yes | The reference implementation |

---

## Claude Desktop — Detailed Findings

**Confirmed engine: Bundled Chromium (Tauri framework)**

### Evidence collected:
```
Directory: C:\Program Files\WindowsApps\Claude_1.7196.0.0_x64__pzs8sxrjxfjjc\app\

chrome_100_percent.pak    ← Chromium asset file
chrome_200_percent.pak    ← Chromium HiDPI asset file
LICENSES.chromium.html    ← Explicit Chromium license (19MB)
icudtl.dat                ← Chromium Unicode/ICU library
v8_context_snapshot.bin   ← V8 JavaScript engine
snapshot_blob.bin         ← V8 startup data
libEGL.dll                ← Chromium GPU (EGL)
libGLESv2.dll             ← Chromium GPU (OpenGL ES)
ffmpeg.dll                ← Media (identical to Chrome)
vk_swiftshader.dll        ← Vulkan software renderer
claude.exe (223MB)        ← Chromium bundled inside binary
```

### What this means for UI rendering:
- **Chat window** and **Artifact panel** both render in the **same Chromium engine**
- They are equivalent to two panes inside a single hidden Chrome browser
- Full HTML5, CSS3, JavaScript support — identical to Chrome behavior
- BiDi (bidirectional text), RTL, Unicode: fully supported
- **No dependency on system WebView2** — rendering is consistent across all Windows versions
- Installed via Microsoft Store (MSIX package format)
- 12 parallel `claude.exe` processes = Chromium's standard multi-process architecture (one per renderer/worker)

### What was NOT found:
- `msedgewebview2.exe` with `claude.exe` as parent → confirms no WebView2 dependency
- `electron.exe` → not Electron (Tauri uses a lighter host process)
- `WebView2Loader.dll` → not runtime WebView2 loading

---

## Quick Detection Cheatsheet for Agent Use

```
1. Run: Get-Process | Where-Object {$_.MainWindowTitle -ne ""} | Select-Object Name, Id, MainWindowTitle
   → Identify which process = which app

2. Run: Get-Process -Name "APPNAME" | Select-Object Path
   → Get install path

3. Run: Get-ChildItem "INSTALL_PATH" | Select-Object Name, Length
   → Look for chrome_*.pak, v8_*.bin, LICENSES.chromium.html

4. Run: Get-CimInstance Win32_Process -Filter "name='msedgewebview2.exe'" | Select-Object ProcessId, ParentProcessId, CommandLine | Format-List
   → Check if app owns WebView2 processes (look for --webview-exe-name=APPNAME)

5. Conclusion logic:
   - chrome_*.pak found         → Bundled Chromium (Tauri/CEF)
   - msedgewebview2 parent match → WebView2
   - electron.exe or app.asar   → Electron
   - Qt*.dll found              → Qt Native
   - None of the above          → Unknown / fully native
```
