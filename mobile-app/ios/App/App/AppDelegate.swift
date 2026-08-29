import UIKit
import Capacitor
import QuickLook
import UniformTypeIdentifiers
import WebKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        // Called when the app was launched with a url. Feel free to add additional processing here,
        // but if you want the App API to support tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Called when the app was launched with an activity, including Universal Links.
        // Feel free to add additional processing here, but if you want the App API to support
        // tracking app url opens, make sure to keep this call
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}

final class OffGridBridgeViewController: CAPBridgeViewController {
    private let offGridNativeHandler = OffGridNativeMessageHandler()

    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        offGridNativeHandler.presenter = self
        configuration.userContentController.add(offGridNativeHandler, name: "offgridNative")
        configuration.userContentController.addUserScript(
            WKUserScript(
                source: Self.bridgeJavaScript,
                injectionTime: .atDocumentStart,
                forMainFrameOnly: true
            )
        )
        return super.webView(with: frame, configuration: configuration)
    }

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        offGridNativeHandler.prepareFieldGuidesDirectory()
    }

    private static let bridgeJavaScript = """
    (() => {
      const nativeHandler = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.offgridNative;
      if (!nativeHandler) return;

      const send = (method, args, previewHtml = '') => {
        nativeHandler.postMessage({ method, args, previewHtml });
      };
      const success = (details = {}) => JSON.stringify(Object.assign({ ok: true, platform: 'ios' }, details));
      const pdfUri = filename => `offgrid-native://${encodeURIComponent(filename || 'offgrid-ai-field-guide.pdf')}`;
      const uniquePdfFilename = (prompt, title, requestedFilename) => {
        const source = String(prompt || title || requestedFilename || 'OffGrid AI FieldGuide')
          .replace(/\\.pdf$/i, '')
          .replace(/[^a-zA-Z0-9\\s-]/g, '')
          .replace(/\\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
          .slice(0, 70) || 'OffGrid-AI-FieldGuide';
        const now = new Date();
        const two = value => String(value).padStart(2, '0');
        const three = value => String(value).padStart(3, '0');
        const stamp = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())}-${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}-${three(now.getMilliseconds())}`;
        return `${source}-${stamp}.pdf`;
      };

      window.OffGridNative = Object.assign(window.OffGridNative || {}, {
        saveFieldGuidePdf(image, title, question, answer, filename) {
          const preview = document.querySelector('.app-pdf-document');
          const previewHtml = preview ? preview.innerHTML : '';
          const uniqueFilename = uniquePdfFilename(question, title, filename);
          send('saveFieldGuidePdf', [previewHtml ? '' : image, title, question, answer, uniqueFilename], previewHtml);
          return success({ uri: pdfUri(uniqueFilename), filename: uniqueFilename });
        },
        shareFieldGuidePdf(image, title, question, answer, filename) {
          const preview = document.querySelector('.app-pdf-document');
          const previewHtml = preview ? preview.innerHTML : '';
          const uniqueFilename = uniquePdfFilename(question, title, filename);
          send('shareFieldGuidePdf', [previewHtml ? '' : image, title, question, answer, uniqueFilename], previewHtml);
          return success({ uri: pdfUri(uniqueFilename), filename: uniqueFilename });
        },
        openSavedGuides() {
          send('openSavedGuides', []);
          return success({ action: 'pick-pdf', location: 'On My iPhone/OffGrid AI FieldGuide/Field Guides' });
        },
        openPdf(uri) {
          send('openPdf', [uri]);
          return success({ uri });
        }
      });

      const patchIosSaveMessages = () => {
        const original = window.showSaveToast;
        if (typeof original !== 'function' || original.__offgridIosPatched) return;
        const replacements = new Map([
          ['Look in Downloads > OffGrid AI.', 'Saved automatically in Files under On My iPhone → OffGrid AI FieldGuide → Field Guides.'],
          ['Choose an app or contact from the Android share sheet.', 'Choose an app or contact from the share sheet.'],
          ['Tap Save Field Guide to keep it in Downloads > OffGrid AI, or Share PDF to send it.', 'Tap Save Field Guide to keep it in Files and Saved Field Guides, or Share PDF to send it.']
        ]);
        const patched = function(message, subtitle, actionLabel, action) {
          return original(message, replacements.get(subtitle) || subtitle, actionLabel, action);
        };
        patched.__offgridIosPatched = true;
        window.showSaveToast = patched;
        if (typeof window.openSavedGuides === 'function') {
          window.requestOpenSavedGuides = () => window.openSavedGuides();
        }
      };
      const applyIosStatusBarLayout = async () => {
        const statusBar = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.StatusBar;
        if (!statusBar) return false;
        try {
          // Force Capacitor to recalculate the WebView frame after every reload.
          // Calling false alone can be ignored when the plugin remembers its old state.
          await statusBar.setOverlaysWebView({ overlay: true });
          await statusBar.setOverlaysWebView({ overlay: false });
          await statusBar.setBackgroundColor({ color: '#c58b00' });
          await statusBar.setStyle({ style: 'LIGHT' });
          return true;
        } catch (_) {
          return false;
        }
      };
      document.addEventListener('DOMContentLoaded', () => {
        patchIosSaveMessages();
        applyIosStatusBarLayout().then(applied => {
          if (!applied) setTimeout(applyIosStatusBarLayout, 400);
        });
      }, { once: true });
      window.addEventListener('pageshow', applyIosStatusBarLayout);
    })();
    """
}

private final class OffGridNativeMessageHandler: NSObject, WKScriptMessageHandler, QLPreviewControllerDataSource, UIDocumentPickerDelegate {
    weak var presenter: UIViewController?
    private var previewURL: URL?
    private var pdfRenderJobs: [UUID: OffGridHTMLPDFRenderJob] = [:]

    func prepareFieldGuidesDirectory() {
        _ = try? fieldGuidesDirectory()
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard
            let body = message.body as? [String: Any],
            let method = body["method"] as? String
        else { return }

        let args = body["args"] as? [Any] ?? []
        let previewHtml = body["previewHtml"] as? String ?? ""

        DispatchQueue.main.async { [weak self] in
            guard let self else { return }
            do {
                switch method {
                case "saveFieldGuidePdf":
                    self.createFieldGuidePDF(args: args, previewHtml: previewHtml) { [weak self] result in
                        self?.handleRenderedPDF(result, action: .save)
                    }
                case "shareFieldGuidePdf":
                    self.createFieldGuidePDF(args: args, previewHtml: previewHtml) { [weak self] result in
                        self?.handleRenderedPDF(result, action: .share)
                    }
                case "openSavedGuides":
                    self.presentSavedGuides()
                case "openPdf":
                    try self.openPDF(uri: self.stringArg(args, 0))
                default:
                    break
                }
            } catch {
                self.presentError(error.localizedDescription)
            }
        }
    }

    private func createFieldGuidePDF(
        args: [Any],
        previewHtml: String,
        completion: @escaping (Result<URL, Error>) -> Void
    ) {
        do {
            let imageDataUrl = stringArg(args, 0)
            let title = stringArg(args, 1).trimmingCharacters(in: .whitespacesAndNewlines)
            let question = stringArg(args, 2)
            let answer = stringArg(args, 3)
            let filename = safePDFFilename(stringArg(args, 4), fallbackTitle: title)
            let outputURL = try fieldGuidesDirectory().appendingPathComponent(filename, isDirectory: false)

            let markup = previewHtml.isEmpty
                ? fallbackMarkup(title: title, question: question, answer: answer, imageDataUrl: imageDataUrl)
                : previewHtml
            let html = """
            <!doctype html>
            <html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <style>
              @page { size: letter; margin: 0.5in; }
              html, body { margin: 0; padding: 0; background: #fff; }
              body { font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif; color: #171717; font-size: 12pt; line-height: 1.45; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              img { max-width: 100%; height: auto; page-break-inside: avoid; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #aaa; padding: 6px; vertical-align: top; }
              h1, h2, h3 { color: #2c1810; page-break-after: avoid; }
            </style></head><body>
            \(markup)
            <style id="offgrid-ios-pdf-overrides">
              body { max-width: none !important; margin: 0 !important; padding: 0 !important; font-size: 18px !important; line-height: 1.5 !important; }
              body > img:first-of-type { width: auto !important; max-width: 100% !important; height: auto !important; max-height: 736px !important; margin: 0 auto !important; break-after: page; page-break-after: always; }
              h1 { font-size: 30px !important; line-height: 1.18 !important; margin: 0 0 16px !important; padding-bottom: 8px !important; }
              h2 { font-size: 23px !important; line-height: 1.25 !important; margin: 22px 0 10px !important; padding: 7px 12px !important; }
              h3, h4 { font-size: 20px !important; line-height: 1.3 !important; margin: 16px 0 8px !important; }
              p { margin: 8px 0 !important; }
              ul, ol { padding-left: 28px !important; margin: 7px 0 !important; }
              li { margin: 5px 0 !important; }
              blockquote { margin: 10px 0 !important; padding: 7px 14px !important; }
              table { font-size: 16px !important; }
              .footer { margin-top: 24px !important; font-size: 11px !important; }
            </style>
            </body></html>
            """

            let jobID = UUID()
            let job = OffGridHTMLPDFRenderJob(html: html, hostView: presenter?.view) { [weak self] result in
                guard let self else { return }
                self.pdfRenderJobs.removeValue(forKey: jobID)
                do {
                    let data = try result.get()
                    guard data.count > 4_096 else {
                        throw OffGridNativeError(message: "The field guide PDF rendered without its content. Please try again.")
                    }
                    try data.write(to: outputURL, options: .atomic)
                    completion(.success(outputURL))
                } catch {
                    completion(.failure(error))
                }
            }
            pdfRenderJobs[jobID] = job
            job.start()
        } catch {
            completion(.failure(error))
        }
    }

    private func handleRenderedPDF(_ result: Result<URL, Error>, action: PDFAction) {
        switch result {
        case .success(let url):
            switch action {
            case .save:
                UINotificationFeedbackGenerator().notificationOccurred(.success)
            case .share:
                presentShareSheet(for: url)
            }
        case .failure(let error):
            presentError(error.localizedDescription)
        }
    }

    private func fieldGuidesDirectory() throws -> URL {
        guard let documents = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else {
            throw OffGridNativeError(message: "The app's Documents folder is unavailable.")
        }
        let directory = documents.appendingPathComponent("Field Guides", isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        return directory
    }

    private func presentShareSheet(for url: URL) {
        let controller = UIActivityViewController(
            activityItems: [url],
            applicationActivities: nil
        )
        if let popover = controller.popoverPresentationController, let view = topPresenter()?.view {
            popover.sourceView = view
            popover.sourceRect = CGRect(x: view.bounds.midX, y: view.bounds.maxY - 32, width: 1, height: 1)
        }
        topPresenter()?.present(controller, animated: true)
    }

    private func presentSavedGuides() {
        do {
            let directory = try fieldGuidesDirectory()
            presentFilesBrowser(startingAt: directory)
        } catch {
            presentError(error.localizedDescription)
        }
    }

    private func presentFilesBrowser(startingAt directory: URL) {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.pdf], asCopy: false)
        picker.directoryURL = directory
        picker.delegate = self
        picker.modalPresentationStyle = .formSheet
        topPresenter()?.present(picker, animated: true)
    }

    func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        guard let url = urls.first else { return }
        DispatchQueue.main.async { [weak self] in
            self?.presentPreview(for: url)
        }
    }

    private func openPDF(uri: String) throws {
        guard !uri.isEmpty else {
            throw OffGridNativeError(message: "No saved PDF was provided.")
        }
        let filename: String
        if uri.hasPrefix("offgrid-native://") {
            let encoded = String(uri.dropFirst("offgrid-native://".count))
            filename = encoded.removingPercentEncoding ?? encoded
        } else {
            filename = URL(string: uri)?.lastPathComponent ?? uri
        }
        let url = try fieldGuidesDirectory().appendingPathComponent(safePDFFilename(filename, fallbackTitle: "OffGrid AI FieldGuide"))
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw OffGridNativeError(message: "That saved PDF could not be found on this iPhone.")
        }
        presentPreview(for: url)
    }

    private func presentPreview(for url: URL) {
        previewURL = url
        let preview = QLPreviewController()
        preview.dataSource = self
        topPresenter()?.present(preview, animated: true)
    }

    func numberOfPreviewItems(in controller: QLPreviewController) -> Int {
        previewURL == nil ? 0 : 1
    }

    func previewController(_ controller: QLPreviewController, previewItemAt index: Int) -> QLPreviewItem {
        previewURL! as NSURL
    }

    private func topPresenter() -> UIViewController? {
        var current = presenter
        while let presented = current?.presentedViewController {
            current = presented
        }
        return current
    }

    private func presentError(_ message: String) {
        presentMessage(title: "PDF Save Failed", message: message)
    }

    private func presentMessage(title: String, message: String) {
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        topPresenter()?.present(alert, animated: true)
    }

    private func safePDFFilename(_ filename: String, fallbackTitle: String) -> String {
        var value = filename.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.isEmpty { value = fallbackTitle.isEmpty ? "offgrid-ai-field-guide" : fallbackTitle }
        let allowed = CharacterSet.alphanumerics.union(CharacterSet(charactersIn: "-_."))
        value = value.unicodeScalars.map { allowed.contains($0) ? Character(String($0)) : "-" }.reduce(into: "") { $0.append($1) }
        while value.contains("--") { value = value.replacingOccurrences(of: "--", with: "-") }
        value = String(value.prefix(100)).trimmingCharacters(in: CharacterSet(charactersIn: ".-"))
        if !value.lowercased().hasSuffix(".pdf") { value += ".pdf" }
        return value.isEmpty ? "offgrid-ai-field-guide.pdf" : value
    }

    private func fallbackMarkup(title: String, question: String, answer: String, imageDataUrl: String) -> String {
        let image = imageDataUrl.isEmpty ? "" : "<img src=\"\(escapeHTML(imageDataUrl))\" alt=\"Field guide visual\">"
        return """
        <h1>\(escapeHTML(title.isEmpty ? "OffGrid AI FieldGuide" : title))</h1>
        \(image)
        <h2>Question</h2><p>\(escapeHTML(question).replacingOccurrences(of: "\n", with: "<br>"))</p>
        <h2>Field Guide</h2><p>\(escapeHTML(answer).replacingOccurrences(of: "\n", with: "<br>"))</p>
        """
    }

    private func escapeHTML(_ value: String) -> String {
        value
            .replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
            .replacingOccurrences(of: "\"", with: "&quot;")
    }

    private func stringArg(_ args: [Any], _ index: Int) -> String {
        guard index < args.count, !(args[index] is NSNull) else { return "" }
        return args[index] as? String ?? String(describing: args[index])
    }
}

private enum PDFAction {
    case save
    case share
}

private final class OffGridHTMLPDFRenderJob: NSObject, WKNavigationDelegate {
    private let html: String
    private weak var hostView: UIView?
    private let completion: (Result<Data, Error>) -> Void
    private var webView: WKWebView?
    private var completed = false

    init(html: String, hostView: UIView?, completion: @escaping (Result<Data, Error>) -> Void) {
        self.html = html
        self.hostView = hostView
        self.completion = completion
    }

    func start() {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        let webView = WKWebView(
            frame: CGRect(x: -10_000, y: 0, width: 612, height: 792),
            configuration: configuration
        )
        self.webView = webView
        webView.navigationDelegate = self
        hostView?.addSubview(webView)
        webView.loadHTMLString(html, baseURL: URL(string: "https://offgridtoolkit.ai"))
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let waitForAssets = """
        const images = Array.from(document.images);
        await Promise.all(images.map(image => image.complete
          ? Promise.resolve()
          : new Promise(resolve => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            })));
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        return { textLength: document.body.innerText.length, imageCount: images.length };
        """

        webView.callAsyncJavaScript(
            waitForAssets,
            arguments: [:],
            in: nil,
            in: .page,
            completionHandler: { [weak self] _ in
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                self?.renderLoadedWebView()
            }
        })
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        finish(.failure(error))
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        finish(.failure(error))
    }

    private func renderLoadedWebView() {
        guard let webView, !completed else { return }

        let renderer = OffGridPrintPageRenderer()
        renderer.addPrintFormatter(webView.viewPrintFormatter(), startingAtPageAt: 0)
        renderer.prepare(forDrawingPages: NSRange(location: 0, length: 0))
        guard renderer.numberOfPages > 0 else {
            finish(.failure(OffGridNativeError(message: "The field guide content did not produce any PDF pages.")))
            return
        }

        let data = NSMutableData()
        UIGraphicsBeginPDFContextToData(data, renderer.paperRect, nil)
        for page in 0..<renderer.numberOfPages {
            UIGraphicsBeginPDFPage()
            renderer.drawPage(at: page, in: UIGraphicsGetPDFContextBounds())
        }
        UIGraphicsEndPDFContext()

        finish(.success(data as Data))
    }

    private func finish(_ result: Result<Data, Error>) {
        guard !completed else { return }
        completed = true
        webView?.navigationDelegate = nil
        webView?.removeFromSuperview()
        webView = nil
        completion(result)
    }
}

private final class OffGridPrintPageRenderer: UIPrintPageRenderer {
    private let pageBounds = CGRect(x: 0, y: 0, width: 612, height: 792)
    private let contentBounds = CGRect(x: 24, y: 24, width: 564, height: 744)

    override var paperRect: CGRect { pageBounds }
    override var printableRect: CGRect { contentBounds }
}

private struct OffGridNativeError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}
