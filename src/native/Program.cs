// FixMixAI — Clipboard Change Bridge
// Listens for Windows clipboard change notifications via AddClipboardFormatListener.
// When ANY app puts new content on the clipboard, emits "CAPTURE:<processName>" on stdout.
// No target process name needed — works for ALL apps automatically.
//
// Protocol (stdout):
//   READY              — listener registered, watching for clipboard changes
//   CAPTURE:<name>     — clipboard changed; <name> is the foreground app's process name
//
// Send any line to stdin (or close stdin) to shut down cleanly.

using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Windows.Forms;

internal sealed class ClipboardListenerForm : Form
{
    [DllImport("user32.dll")]
    private static extern bool AddClipboardFormatListener(IntPtr hwnd);

    [DllImport("user32.dll")]
    private static extern bool RemoveClipboardFormatListener(IntPtr hwnd);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern IntPtr GetClipboardOwner();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    // Voice-dictation apps write to the clipboard as their paste mechanism.
    // We check the clipboard OWNER (who wrote it), not the foreground window,
    // because the foreground is always the target app (e.g. Claude), not the dictation tool.
    private static readonly HashSet<string> VoiceDictationApps = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        "wispr flow helper", "wispr flow",          // Wispr Flow (confirmed process name)
        "whisperflow", "whisper", "wispr", "wisprflow",
        "dragon", "dragonspeak", "naturallyspeaking",
        "speechrecognition", "windowsspeechrecognition",
        "voicetype", "dictate", "dictation",
        "snippingtool", "sniptool",                 // Windows Snipping Tool — screenshots, not text
        "unknown",                                  // Wispr Flow clipboard cleanup leaves empty clipboard
    };

    private const int WM_CLIPBOARDUPDATE = 0x031D;

    // Hide the form permanently — we only need the HWND for the message pump
    protected override void SetVisibleCore(bool value)
    {
        if (!IsHandleCreated)
        {
            CreateHandle();
            AddClipboardFormatListener(Handle);
            Bridge.Emit("READY");
            Bridge.Log("Clipboard change listener active — watching all apps");
        }
        base.SetVisibleCore(false);
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WM_CLIPBOARDUPDATE)
        {
            // Check WHO wrote to the clipboard, not who has focus.
            // Voice-dictation apps (Wispr Flow, Dragon, etc.) write to clipboard
            // as a paste mechanism — foreground is the target app, owner is the dictation tool.
            string ownerProc = GetClipboardOwnerProcessName();
            string foregroundProc = GetForegroundProcessName();

            // Always log both names so we can identify unknown dictation apps
            Bridge.Log($"Clipboard event — owner: [{ownerProc}]  foreground: [{foregroundProc}]");

            if (VoiceDictationApps.Contains(ownerProc))
            {
                Bridge.Log($"Blocked: voice-dictation app [{ownerProc}]");
                base.WndProc(ref m);
                return;
            }

            Bridge.Emit($"CAPTURE:{foregroundProc}");
        }
        base.WndProc(ref m);
    }

    protected override void OnFormClosed(FormClosedEventArgs e)
    {
        RemoveClipboardFormatListener(Handle);
        base.OnFormClosed(e);
    }

    private static string GetForegroundProcessName()
    {
        try
        {
            IntPtr hwnd = GetForegroundWindow();
            GetWindowThreadProcessId(hwnd, out uint pid);
            return Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant();
        }
        catch
        {
            return "unknown";
        }
    }

    private static string GetClipboardOwnerProcessName()
    {
        try
        {
            IntPtr hwnd = GetClipboardOwner();
            if (hwnd == IntPtr.Zero) return "unknown";
            GetWindowThreadProcessId(hwnd, out uint pid);
            return Process.GetProcessById((int)pid).ProcessName.ToLowerInvariant();
        }
        catch
        {
            return "unknown";
        }
    }
}

internal static class Bridge
{
    internal static void Emit(string msg) { Console.WriteLine(msg); Console.Out.Flush(); }
    internal static void Log(string msg) => Console.Error.WriteLine($"[ClipboardBridge] {msg}");
}

internal static class Program
{

    [STAThread]
    static void Main()
    {
        Bridge.Log("Starting clipboard change bridge...");
        Application.EnableVisualStyles();

        var form = new ClipboardListenerForm();

        // When Electron closes stdin, exit cleanly on the UI thread
        var stdinWatcher = new Thread(() =>
        {
            Console.In.ReadLine();
            Bridge.Log("Stdin closed — shutting down");
            try
            {
                if (form.IsHandleCreated)
                    form.Invoke(Application.Exit);
            }
            catch { }
            Application.Exit();
        }) { IsBackground = true };
        stdinWatcher.Start();

        Application.Run(form);
        Bridge.Log("Done");
    }
}
