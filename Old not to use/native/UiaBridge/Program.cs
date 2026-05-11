using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using Interop.UIAutomationClient;

// FixMixAI - UiaBridge POC
// Phase 1: Scan Claude Desktop window using Windows UIAutomation COM API
// Output: JSON to stdout for Node.js parent process consumption

namespace UiaBridge
{
    // --- Data Models ---

    internal record BoundingRect(
        [property: JsonPropertyName("x")] int X,
        [property: JsonPropertyName("y")] int Y,
        [property: JsonPropertyName("width")] int Width,
        [property: JsonPropertyName("height")] int Height
    );

    internal record UiaElement(
        [property: JsonPropertyName("type")] string Type,
        [property: JsonPropertyName("content")] string Content,
        [property: JsonPropertyName("bounds")] BoundingRect Bounds
    );

    internal record ScanResult(
        [property: JsonPropertyName("windowHandle")] string WindowHandle,
        [property: JsonPropertyName("appName")] string AppName,
        [property: JsonPropertyName("elements")] List<UiaElement> Elements
    );

    internal record ErrorResult(
        [property: JsonPropertyName("error")] string Error,
        [property: JsonPropertyName("details")] string Details
    );

    // --- Main Program ---

    internal class Program
    {
        // Known process names for Claude Desktop (Electron app)
        private static readonly string[] ClaudeProcessNames = { "claude", "Claude" };

        private static readonly CUIAutomation8 UiaClient = new CUIAutomation8();

        static int Main(string[] args)
        {
            try
            {
                Console.OutputEncoding = Encoding.UTF8;

                // Run the scan on an STA background thread
                // (COM UIAutomation requires Single-Threaded Apartment)
                ScanResult? result = null;
                Exception? scanException = null;

                var scanThread = new Thread(() =>
                {
                    try
                    {
                        result = ScanClaudeWindow();
                    }
                    catch (Exception ex)
                    {
                        scanException = ex;
                    }
                });

                scanThread.IsBackground = true;
                scanThread.SetApartmentState(ApartmentState.STA);
                scanThread.Start();

                // Wait up to 10 seconds
                bool completed = scanThread.Join(TimeSpan.FromSeconds(10));

                if (!completed)
                {
                    WriteError("TIMEOUT", "Scan did not complete within 10 seconds. Claude Desktop may be unresponsive.");
                    return 2;
                }

                if (scanException != null)
                    throw scanException;

                if (result == null)
                {
                    WriteError("NOT_FOUND", "Claude Desktop window was not found. Please ensure Claude Desktop is open and visible.");
                    return 1;
                }

                var options = new JsonSerializerOptions { WriteIndented = true };
                Console.WriteLine(JsonSerializer.Serialize(result, options));
                return 0;
            }
            catch (Exception ex)
            {
                WriteError("UNHANDLED_EXCEPTION", ex.ToString());
                return 99;
            }
        }

        // --- Window Discovery ---

        /// <summary>
        /// Finds the Claude Desktop process and scans its main window via UIAutomation COM API.
        /// Returns null if Claude Desktop is not running or has no visible window.
        /// </summary>
        private static ScanResult? ScanClaudeWindow()
        {
            // Step 1: Locate Claude Desktop process
            Process? claudeProcess = null;
            foreach (var name in ClaudeProcessNames)
            {
                foreach (var p in Process.GetProcessesByName(name))
                {
                    if (p.MainWindowHandle != IntPtr.Zero)
                    {
                        claudeProcess = p;
                        break;
                    }
                }
                if (claudeProcess != null) break;
            }

            if (claudeProcess == null)
                return null;

            IntPtr hwnd = claudeProcess.MainWindowHandle;
            string appName = string.IsNullOrWhiteSpace(claudeProcess.MainWindowTitle)
                ? "Claude"
                : claudeProcess.MainWindowTitle;

            // Step 2: Get the root AutomationElement for the window via COM
            IUIAutomationElement? windowElement = null;
            try
            {
                windowElement = UiaClient.ElementFromHandle(hwnd);
            }
            catch
            {
                return null;
            }

            if (windowElement == null)
                return null;

            string windowHandleHex = $"0x{hwnd:X}";

            // Step 3: Walk the element tree and collect relevant text elements
            var elements = new List<UiaElement>();
            WalkElements(windowElement, elements, depth: 0, maxDepth: 15);

            return new ScanResult(windowHandleHex, appName, elements);
        }

        // --- UIAutomation Tree Walker ---

        /// <summary>
        /// Recursively walks the UIAutomation element tree using the ControlView TreeWalker.
        /// Collects text/edit elements that have non-empty content and valid bounding boxes.
        /// </summary>
        private static void WalkElements(IUIAutomationElement element, List<UiaElement> collected, int depth, int maxDepth)
        {
            if (depth > maxDepth) return;

            try
            {
                int controlTypeId = element.CurrentControlType;
                string name = element.CurrentName ?? string.Empty;
                string automationId = element.CurrentAutomationId ?? string.Empty;

                // Classify element
                string? elementType = ClassifyElement(controlTypeId, name, automationId);

                if (elementType != null)
                {
                    string content = ExtractText(element);
                    tagRECT rect = element.CurrentBoundingRectangle;
                    var bounds = new BoundingRect(rect.left, rect.top, rect.right - rect.left, rect.bottom - rect.top);

                    if (!string.IsNullOrWhiteSpace(content) && bounds.Width > 0 && bounds.Height > 0)
                    {
                        collected.Add(new UiaElement(elementType, content.Trim(), bounds));
                    }
                }

                // Walk children using ControlView tree walker
                IUIAutomationTreeWalker walker = UiaClient.ControlViewWalker;
                IUIAutomationElement? child = null;
                try
                {
                    child = walker.GetFirstChildElement(element);
                }
                catch { return; }

                while (child != null)
                {
                    WalkElements(child, collected, depth + 1, maxDepth);
                    try
                    {
                        child = walker.GetNextSiblingElement(child);
                    }
                    catch { break; }
                }
            }
            catch
            {
                // Element may have been destroyed during scan - skip silently
            }
        }

        // --- Element Classification ---

        // UIAutomation control type IDs (from UIA_ControlTypeIds)
        private const int UIA_EditControlTypeId = 50004;
        private const int UIA_DocumentControlTypeId = 50030;
        private const int UIA_TextControlTypeId = 50020;
        private const int UIA_PaneControlTypeId = 50033;
        private const int UIA_GroupControlTypeId = 50026;

        /// <summary>
        /// Classifies a UIA element as "InputArea", "ResponseArea", or "Text".
        /// Returns null to skip the element entirely.
        /// </summary>
        private static string? ClassifyElement(int controlTypeId, string name, string automationId)
        {
            string lowerHint = (name + "|" + automationId).ToLowerInvariant();

            // Edit/Document controls → likely input area (prompt box)
            if (controlTypeId == UIA_EditControlTypeId || controlTypeId == UIA_DocumentControlTypeId)
            {
                if (lowerHint.Contains("input") || lowerHint.Contains("prompt") ||
                    lowerHint.Contains("composer") || lowerHint.Contains("chat"))
                    return "InputArea";

                // Even without a matching hint, Edit controls are usually input areas
                return "InputArea";
            }

            // Text controls → inline text nodes (response content)
            if (controlTypeId == UIA_TextControlTypeId)
                return "Text";

            // Pane/Group with response-related hints → response container
            if (controlTypeId == UIA_PaneControlTypeId || controlTypeId == UIA_GroupControlTypeId)
            {
                if (lowerHint.Contains("response") || lowerHint.Contains("message") ||
                    lowerHint.Contains("output") || lowerHint.Contains("content") ||
                    lowerHint.Contains("conversation"))
                    return "ResponseArea";
            }

            return null;
        }

        // --- Text Extraction ---

        // UIAutomation pattern IDs
        private const int UIA_TextPatternId = 10014;
        private const int UIA_ValuePatternId = 10002;

        /// <summary>
        /// Extracts text content from a COM UIAutomation element.
        /// Priority: TextPattern → ValuePattern → Name property.
        /// </summary>
        private static string ExtractText(IUIAutomationElement element)
        {
            // Try TextPattern (best for rich text / document areas)
            try
            {
                var textPatternObj = element.GetCurrentPattern(UIA_TextPatternId);
                if (textPatternObj is IUIAutomationTextPattern textPattern)
                {
                    IUIAutomationTextRange docRange = textPattern.DocumentRange;
                    string text = docRange.GetText(5000);
                    if (!string.IsNullOrWhiteSpace(text))
                        return text;
                }
            }
            catch { }

            // Try ValuePattern (for single-line edits)
            try
            {
                var valuePatternObj = element.GetCurrentPattern(UIA_ValuePatternId);
                if (valuePatternObj is IUIAutomationValuePattern valuePattern)
                {
                    string val = valuePattern.CurrentValue;
                    if (!string.IsNullOrWhiteSpace(val))
                        return val;
                }
            }
            catch { }

            // Fallback: Name property
            return element.CurrentName ?? string.Empty;
        }

        // --- Error Output ---

        private static void WriteError(string code, string details)
        {
            var error = new ErrorResult(code, details);
            var options = new JsonSerializerOptions { WriteIndented = true };
            Console.Error.WriteLine(JsonSerializer.Serialize(error, options));
        }
    }
}
