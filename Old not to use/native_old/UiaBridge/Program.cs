// RTL AI Fixer — UiaBridge
// Watches the foreground window via WinEventHook,
// scans for Hebrew text using UIAutomation,
// and outputs JSON lines to stdout for the Electron engine.
//
// Output format (one JSON line per event):
//   {"type":"elements","app":"AppName","elements":[{"text":"...","x":0,"y":0,"w":0,"h":0},...]}
//   {"type":"heartbeat"}
//   {"type":"error","message":"..."}
//
// Commands accepted on stdin:
//   "stop\n" — clean shutdown

using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;
using System.Windows.Automation.Text;

class Program
{
    // ─── Win32 P/Invoke ────────────────────────────────────────────────────────

    delegate void WinEventDelegate(
        IntPtr hWinEventHook, uint eventType, IntPtr hwnd,
        int idObject, int idChild, uint dwEventThread, uint dwmsEventTime);

    [DllImport("user32.dll")]
    static extern IntPtr SetWinEventHook(
        uint eventMin, uint eventMax,
        IntPtr hmodWinEventProc, WinEventDelegate lpfnWinEventProc,
        uint idProcess, uint idThread, uint dwFlags);

    [DllImport("user32.dll")]
    static extern bool UnhookWinEvent(IntPtr hWinEventHook);

    [DllImport("user32.dll")]
    static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    static extern bool TranslateMessage([In] ref MSG lpMsg);

    [DllImport("user32.dll")]
    static extern IntPtr DispatchMessage([In] ref MSG lpmsg);

    [DllImport("user32.dll")]
    static extern void PostQuitMessage(int nExitCode);

    [StructLayout(LayoutKind.Sequential)]
    public struct MSG
    {
        public IntPtr hwnd;
        public uint message;
        public UIntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public int ptX, ptY;
    }

    // ─── Win32 Constants ───────────────────────────────────────────────────────

    const uint EVENT_SYSTEM_FOREGROUND    = 0x0003;
    const uint EVENT_OBJECT_LOCATIONCHANGE = 0x800B; // For scrolling updates
    const uint EVENT_OBJECT_VALUECHANGE   = 0x800E;
    const uint EVENT_OBJECT_SHOW          = 0x8002;
    const uint WINEVENT_OUTOFCONTEXT      = 0x0000;

    static readonly object _lock = new object();
    static bool _running = true;

    static WinEventDelegate _eventDelegate;
    static IntPtr _hookFore, _hookLoc, _hookVal, _hookShow;

    static DateTime _lastHeavyScan = DateTime.MinValue;
    static DateTime _lastLightScan = DateTime.MinValue;
    const int HEAVY_SCAN_THROTTLE_MS = 1000;  // FindAll is heavy, max 1 per second
    const int LIGHT_SCAN_THROTTLE_MS = 100;   // Position updates can be 10 FPS (100ms)

    // CACHE arrays for fast position updates during scroll
    static string _cachedAppName = "";
    static List<Tuple<TextPatternRange, string>> _cachedHebrewRanges = new List<Tuple<TextPatternRange, string>>();
    
    // Heartbeat ticker
    static int _tickCount = 0;

    static CancellationTokenSource _scanCts = new CancellationTokenSource();

    static void Main(string[] args)
    {
        Console.OutputEncoding = System.Text.Encoding.UTF8;

        // Periodic background worker for heartbeat & fallback scan
        var workerThread = new Thread(() =>
        {
            while (_running)
            {
                Thread.Sleep(500); // Trigger a light scan for position syncing
                EmitCachedPositions();
                
                _tickCount++;
                // Every 2.5 seconds, force a heavy scan to pick up new elements
                if (_tickCount % 5 == 0) {
                    ThreadPool.QueueUserWorkItem(_ => PerformHeavyScan());
                }
                // Every 5 seconds, heartbeat
                if (_tickCount >= 10) {
                    EmitRawJson("{\"type\":\"heartbeat\"}");
                    _tickCount = 0;
                }
            }
        }) { IsBackground = true };
        workerThread.Start();

        var stdinThread = new Thread(() =>
        {
            while (_running)
            {
                try
                {
                    string line = Console.In.ReadLine();
                    if (line != null && line.Trim().ToLower() == "stop")
                    {
                        _running = false;
                        PostQuitMessage(0);
                    }
                }
                catch { break; }
            }
        }) { IsBackground = true };
        stdinThread.Start();

        PerformHeavyScan();

        _eventDelegate = OnWinEvent;
        _hookFore = SetWinEventHook(EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND, IntPtr.Zero, _eventDelegate, 0, 0, WINEVENT_OUTOFCONTEXT);
        _hookVal  = SetWinEventHook(EVENT_OBJECT_VALUECHANGE, EVENT_OBJECT_VALUECHANGE, IntPtr.Zero, _eventDelegate, 0, 0, WINEVENT_OUTOFCONTEXT);
        _hookLoc  = SetWinEventHook(EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_LOCATIONCHANGE, IntPtr.Zero, _eventDelegate, 0, 0, WINEVENT_OUTOFCONTEXT);
        _hookShow = SetWinEventHook(EVENT_OBJECT_SHOW, EVENT_OBJECT_SHOW, IntPtr.Zero, _eventDelegate, 0, 0, WINEVENT_OUTOFCONTEXT);

        MSG msg;
        while (_running && GetMessage(out msg, IntPtr.Zero, 0, 0) > 0)
        {
            TranslateMessage(ref msg);
            DispatchMessage(ref msg);
        }

        if (_hookFore != IntPtr.Zero) UnhookWinEvent(_hookFore);
        if (_hookVal != IntPtr.Zero) UnhookWinEvent(_hookVal);
        if (_hookLoc != IntPtr.Zero) UnhookWinEvent(_hookLoc);
        if (_hookShow != IntPtr.Zero) UnhookWinEvent(_hookShow);
    }

    static void OnWinEvent(IntPtr hook, uint eventType, IntPtr hwnd, int idObj, int idChild, uint thread, uint time)
    {
        var now = DateTime.UtcNow;

        if (eventType == EVENT_OBJECT_LOCATIONCHANGE)
        {
            // Scrolling -> Use ultra-fast cached rect extraction
            lock (_lock)
            {
                if ((now - _lastLightScan).TotalMilliseconds < LIGHT_SCAN_THROTTLE_MS) return;
                _lastLightScan = now;
            }
            ThreadPool.QueueUserWorkItem(_ => EmitCachedPositions());
        }
        else
        {
            // Text change or focus -> Need full tree parsing
            lock (_lock)
            {
                if ((now - _lastHeavyScan).TotalMilliseconds < HEAVY_SCAN_THROTTLE_MS) return;
                _lastHeavyScan = now;
            }
            ThreadPool.QueueUserWorkItem(_ => PerformHeavyScan());
        }
    }

    static void EmitCachedPositions()
    {
        try
        {
            List<Tuple<TextPatternRange, string>> localCache;
            string localAppName;
            lock (_lock)
            {
                localCache = new List<Tuple<TextPatternRange, string>>(_cachedHebrewRanges);
                localAppName = _cachedAppName;
            }

            if (localCache.Count == 0) return; // Nothing to update

            List<string> resultJsons = new List<string>();

            // Only extract rects, do NOT traverse TreeWalker (avoids CPU freeze)
            foreach (var item in localCache)
            {
                try
                {
                    var range = item.Item1;
                    string cachedText = item.Item2;

                    System.Windows.Rect[] rects = range.GetBoundingRectangles();
                    if (rects == null || rects.Length == 0) continue;

                    foreach (var rect in rects)
                    {
                        // Check if rect is visible on screen (not negative or wildly offscreen)
                        if (rect.Width <= 0 || rect.Height <= 0) continue;

                        int x = (int)rect.X;
                        int y = (int)rect.Y;
                        int w = (int)rect.Width;
                        int h = (int)rect.Height;

                        string safeText = EscapeJsonString(cachedText);
                        resultJsons.Add(string.Format("{{\"text\":\"{0}\",\"x\":{1},\"y\":{2},\"w\":{3},\"h\":{4}}}", safeText, x, y, w, h));
                    }
                }
                catch { /* range went stale, will be cleared next HeavyScan */ }
            }

            string safeAppName = EscapeJsonString(localAppName);
            string elementsArray = string.Join(",", resultJsons.ToArray());
            EmitRawJson(string.Format("{{\"type\":\"elements\",\"app\":\"{0}\",\"elements\":[{1}]}}", safeAppName, elementsArray));
        }
        catch { }
    }

    static void PerformHeavyScan()
    {
        try
        {
            _scanCts.Cancel();
            _scanCts = new CancellationTokenSource();
            var token = _scanCts.Token;

            var focused = AutomationElement.FocusedElement;
            if (focused == null) return;

            var scanRoot = FindScanRoot(focused);

            string appName = "Unknown";
            try { appName = scanRoot.Current.Name; } catch { }

            var condition = new PropertyCondition(AutomationElement.IsTextPatternAvailableProperty, true);
            AutomationElementCollection textElements;
            try { textElements = scanRoot.FindAll(TreeScope.Subtree, condition); }
            catch { return; }

            var newCache = new List<Tuple<TextPatternRange, string>>();
            List<string> resultJsons = new List<string>();

            foreach (AutomationElement el in textElements)
            {
                if (token.IsCancellationRequested) return;

                try
                {
                    object patternObj;
                    if (!el.TryGetCurrentPattern(TextPattern.Pattern, out patternObj)) continue;
                    TextPattern textPattern = patternObj as TextPattern;
                    if (textPattern == null) continue;

                    foreach (var range in textPattern.GetVisibleRanges())
                    {
                        string text;
                        try { text = range.GetText(-1); }
                        catch { continue; }

                        if (!ContainsHebrew(text)) continue;

                        // Cache the COM object so we can query its coordinates later without searching DOM
                        newCache.Add(new Tuple<TextPatternRange, string>(range, text));

                        System.Windows.Rect[] rects;
                        try { rects = range.GetBoundingRectangles(); } catch { continue; }
                        if (rects == null || rects.Length == 0) continue;

                        foreach (var rect in rects)
                        {
                            string safeText = EscapeJsonString(text);
                            resultJsons.Add(string.Format("{{\"text\":\"{0}\",\"x\":{1},\"y\":{2},\"w\":{3},\"h\":{4}}}", safeText, (int)rect.X, (int)rect.Y, (int)rect.Width, (int)rect.Height));
                        }
                    }
                }
                catch { }
            }

            // Sync Cache
            lock (_lock)
            {
                _cachedHebrewRanges = newCache;
                _cachedAppName = appName;
            }

            // Always emit heavily scanned results, even if empty, so Frontend clears stale overlays!
            string sApp = EscapeJsonString(appName);
            string arr = string.Join(",", resultJsons.ToArray());
            EmitRawJson(string.Format("{{\"type\":\"elements\",\"app\":\"{0}\",\"elements\":[{1}]}}", sApp, arr));
        }
        catch (Exception ex)
        {
            string safeMsg = EscapeJsonString(ex.Message);
            EmitRawJson(string.Format("{{\"type\":\"error\",\"message\":\"{0}\"}}", safeMsg));
        }
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private static AutomationElement FindScanRoot(AutomationElement focused)
    {
        try
        {
            var walker = TreeWalker.ControlViewWalker;
            var current = focused;
            int depth = 0;

            while (current != null 
                   && current != AutomationElement.RootElement 
                   && depth < 6)
            {
                // Nearest scrollable container
                object dummyObj;
                if (current.TryGetCurrentPattern(ScrollPattern.Pattern, out dummyObj))
                    return current;

                // Document type
                if (current.Current.ControlType == ControlType.Document)
                    return current;

                current = walker.GetParent(current);
                depth++;
            }
        }
        catch { }

        return focused;
    }

    static bool ContainsHebrew(string text)
    {
        if (string.IsNullOrEmpty(text)) return false;
        foreach (char c in text)
        {
            // Hebrew Unicode block: U+0590–U+05FF
            if (c >= '\u0590' && c <= '\u05FF') return true;
        }
        return false;
    }

    static string EscapeJsonString(string s)
    {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder();
        foreach (char c in s)
        {
            switch (c)
            {
                case '"': sb.Append("\\\""); break;
                case '\\': sb.Append("\\\\"); break;
                case '\b': sb.Append("\\b"); break;
