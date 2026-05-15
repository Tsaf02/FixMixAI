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
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

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
            string procName = GetForegroundProcessName();
            Bridge.Emit($"CAPTURE:{procName}");
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
