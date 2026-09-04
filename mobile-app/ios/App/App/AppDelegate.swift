import UIKit
import Capacitor
import AVFoundation
import QuickLook
import PhotosUI
import Speech
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
        let webView = super.webView(with: frame, configuration: configuration)
        offGridNativeHandler.webView = webView
        return webView
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
        },
        startVoiceInput() {
          send('startVoiceInput', []);
          return success({ status: 'requesting-permission' });
        },
        stopVoiceInput() {
          send('stopVoiceInput', []);
          return success({ status: 'stopping' });
        },
        openAppSettings() {
          send('openAppSettings', []);
          return success({ action: 'open-settings' });
        },
        pickVideo(source = 'library') {
          send('pickVideo', [source]);
          return success({ action: 'pick-video', source });
        }
      });

      const patchIosVoiceInput = () => {
        if (window.__offgridIosVoicePatched) return;
        window.__offgridIosVoicePatched = true;

        const state = { active: false, input: null, recording: null };
        const setVisualState = active => {
          document.querySelectorAll('.voice-btn').forEach(button => {
            button.classList.toggle('voice-active', active);
          });
          if (state.recording) state.recording.classList.toggle('active', active);
        };
        const finish = () => {
          const input = state.input;
          state.active = false;
          setVisualState(false);
          state.input = null;
          state.recording = null;
          if (input) input.focus();
        };
        const resizeInput = input => {
          if (!input) return;
          if (input.id === 'welcomeMessageInput' && typeof window.autoResizeWelcome === 'function') {
            window.autoResizeWelcome(input);
          } else if (typeof window.autoResize === 'function') {
            window.autoResize(input);
          }
        };
        const start = moveToChat => {
          if (state.active) {
            window.OffGridNative.stopVoiceInput();
            finish();
            return;
          }
          if (moveToChat && document.getElementById('welcome') && typeof window.transitionToChat === 'function') {
            window.transitionToChat();
          }
          const input = document.getElementById('messageInput') || document.getElementById('welcomeMessageInput');
          if (!input) {
            alert('Voice input could not find the message box. Please reopen the app and try again.');
            return;
          }
          state.active = true;
          state.input = input;
          state.recording = document.getElementById('voiceRecording');
          setVisualState(true);
          window.OffGridNative.startVoiceInput();
        };

        window.addEventListener('offgrid-native-voice-result', event => {
          const detail = event.detail || {};
          if (!state.active || !state.input || typeof detail.transcript !== 'string') return;
          state.input.value = detail.transcript;
          resizeInput(state.input);
        });
        window.addEventListener('offgrid-native-voice-state', event => {
          const status = event.detail && event.detail.status;
          if (status === 'stopped') finish();
        });
        window.addEventListener('offgrid-native-voice-error', event => {
          const detail = event.detail || {};
          const message = detail.message || 'Voice input could not start. Please try again.';
          finish();
          if (detail.canOpenSettings) {
            const openSettings = confirm(`${message}\n\nOpen OffGrid AI FieldGuide settings now?`);
            if (openSettings) window.OffGridNative.openAppSettings();
          } else {
            alert(message);
          }
        });

        window.toggleVoiceInput = () => start(false);
        window.startVoiceInputWithButton = () => start(false);
        window.startVoiceInput = () => start(true);
        window.stopVoiceInput = () => {
          if (!state.active) return;
          window.OffGridNative.stopVoiceInput();
          finish();
        };

        const restoreVoiceCard = () => {
          const voiceCard = document.getElementById('voiceInputCard');
          if (!voiceCard) return;
          voiceCard.style.opacity = '';
          voiceCard.style.pointerEvents = '';
          voiceCard.removeAttribute('aria-disabled');
          const description = voiceCard.querySelector('.quick-action-desc');
          if (description && /not supported/i.test(description.textContent || '')) {
            description.textContent = 'Speak your question';
          }
          voiceCard.onclick = window.startVoiceInput;
        };
        restoreVoiceCard();
        // The hosted page performs its Web Speech support check later in the same
        // load event. Restore the native iOS action after that check finishes.
        setTimeout(restoreVoiceCard, 0);
        window.addEventListener('pageshow', restoreVoiceCard);
      };

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
      const patchIosVideoInput = () => {
        if (window.__offgridIosVideoPatched) return;
        window.__offgridIosVideoPatched = true;

        const prepareVideoChat = () => {
          if (document.getElementById('videoPreview')) return;
          const welcomeInput = document.getElementById('welcomeMessageInput');
          const savedText = welcomeInput ? welcomeInput.value : '';
          if (typeof window.transitionToChat === 'function') window.transitionToChat();
          const welcome = document.getElementById('welcome');
          if (welcome) welcome.remove();
          if (savedText) {
            const messageInput = document.getElementById('messageInput');
            if (messageInput) {
              messageInput.value = savedText;
              if (typeof window.autoResize === 'function') window.autoResize(messageInput);
            }
          }
        };

        // Keep the native bridge self-contained so a newly installed iOS build
        // can use native video extraction before the hosted UI is deployed.
        if (typeof window.acceptNativeVideoSelection !== 'function') {
          window.acceptNativeVideoSelection = details => {
            if (!details || !Array.isArray(details.frames) || details.frames.length === 0) {
              throw new Error('Native video selection did not return any frames.');
            }
            selectedVideo = {
              frames: details.frames,
              name: details.name || 'video.mov',
              size: Number(details.size) || 0,
              duration: Number(details.duration) || 0,
              thumbnailUrl: details.thumbnailUrl || details.frames[0],
              frameCount: details.frames.length,
              mimeType: details.mimeType || 'video/quicktime'
            };
            prepareVideoChat();
            removeImage();
            showVideoPreview();
            if (window.innerWidth <= 768 && document.activeElement) document.activeElement.blur();
            return true;
          };
        }

        const removeIndicator = () => {
          const indicator = document.getElementById('offgridNativeVideoProgress');
          if (indicator) indicator.remove();
        };
        const showIndicator = () => {
          removeIndicator();
          const indicator = document.createElement('div');
          indicator.id = 'offgridNativeVideoProgress';
          indicator.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(44,24,16,0.94);color:white;padding:20px 30px;border-radius:14px;z-index:2000;text-align:center;border:1px solid rgba(184,134,11,0.5);box-shadow:0 8px 30px rgba(0,0,0,0.3);';
          indicator.innerHTML = '<div style="text-align:center"><div style="font-size:24px;margin-bottom:8px">Video</div>Processing video frames...<br><small>Preparing video for AI analysis</small></div>';
          document.body.appendChild(indicator);
        };

        window.addEventListener('offgrid-native-video-state', event => {
          const status = event.detail && event.detail.status;
          if (status === 'processing') showIndicator();
          if (status === 'cancelled') removeIndicator();
        });
        window.addEventListener('offgrid-native-video-ready', event => {
          removeIndicator();
          try {
            if (typeof window.acceptNativeVideoSelection !== 'function') {
              throw new Error('The video interface is not ready. Please reopen the app and try again.');
            }
            window.acceptNativeVideoSelection(event.detail || {});
          } catch (error) {
            alert(error && error.message ? error.message : 'The selected video could not be prepared.');
          }
        });
        window.addEventListener('offgrid-native-video-error', event => {
          removeIndicator();
          const detail = event.detail || {};
          alert(detail.message || 'The selected video could not be prepared. Please try a shorter clip.');
        });

        window.triggerVideoUpload = () => {
          prepareVideoChat();
          window.OffGridNative.pickVideo('library');
        };
        window.triggerVideoRecord = () => {
          prepareVideoChat();
          window.OffGridNative.pickVideo('camera');
        };
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
        patchIosVoiceInput();
        patchIosVideoInput();
        applyIosStatusBarLayout().then(applied => {
          if (!applied) setTimeout(applyIosStatusBarLayout, 400);
        });
      }, { once: true });
      window.addEventListener('pageshow', patchIosVideoInput);
      window.addEventListener('pageshow', applyIosStatusBarLayout);
    })();
    """
}

private final class OffGridNativeMessageHandler: NSObject, WKScriptMessageHandler, QLPreviewControllerDataSource, UIDocumentPickerDelegate, PHPickerViewControllerDelegate, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    weak var presenter: UIViewController?
    weak var webView: WKWebView?
    private var previewURL: URL?
    private var pdfRenderJobs: [UUID: OffGridHTMLPDFRenderJob] = [:]
    private let audioEngine = AVAudioEngine()
    private let speechRecognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private var speechRequest: SFSpeechAudioBufferRecognitionRequest?
    private var speechTask: SFSpeechRecognitionTask?
    private var speechSessionActive = false
    private var speechTapInstalled = false
    private var voiceStartRequested = false

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
                case "startVoiceInput":
                    self.requestVoicePermissionsAndStart()
                case "stopVoiceInput":
                    self.stopVoiceInput(notifyWebView: true)
                case "openAppSettings":
                    self.openAppSettings()
                case "pickVideo":
                    self.presentVideoPicker(source: self.stringArg(args, 0))
                default:
                    break
                }
            } catch {
                self.presentError(error.localizedDescription)
            }
        }
    }

    private func requestVoicePermissionsAndStart() {
        guard !speechSessionActive, !voiceStartRequested else { return }
        voiceStartRequested = true
        emitVoiceEvent("offgrid-native-voice-state", details: ["status": "requesting-permission"])

        SFSpeechRecognizer.requestAuthorization { [weak self] status in
            DispatchQueue.main.async {
                guard let self else { return }
                guard self.voiceStartRequested else { return }
                guard status == .authorized else {
                    self.voiceStartRequested = false
                    self.emitVoicePermissionError(for: status)
                    return
                }
                self.requestMicrophonePermission()
            }
        }
    }

    private func requestMicrophonePermission() {
        let completion: (Bool) -> Void = { [weak self] allowed in
            DispatchQueue.main.async {
                guard let self else { return }
                guard self.voiceStartRequested else { return }
                guard allowed else {
                    self.voiceStartRequested = false
                    self.emitVoiceEvent(
                        "offgrid-native-voice-error",
                        details: [
                            "code": "microphone-permission-denied",
                            "message": "Microphone access is required for Voice Input.",
                            "canOpenSettings": true
                        ]
                    )
                    return
                }
                self.startVoiceInput()
            }
        }

        if #available(iOS 17.0, *) {
            AVAudioApplication.requestRecordPermission(completionHandler: completion)
        } else {
            AVAudioSession.sharedInstance().requestRecordPermission(completion)
        }
    }

    private func startVoiceInput() {
        guard voiceStartRequested else { return }
        guard let speechRecognizer, speechRecognizer.isAvailable else {
            voiceStartRequested = false
            emitVoiceEvent(
                "offgrid-native-voice-error",
                details: [
                    "code": "speech-recognizer-unavailable",
                    "message": "Speech Recognition is temporarily unavailable. Check your connection and try again.",
                    "canOpenSettings": false
                ]
            )
            return
        }

        stopVoiceInput(notifyWebView: false)

        do {
            let audioSession = AVAudioSession.sharedInstance()
            try audioSession.setCategory(.record, mode: .measurement, options: [.duckOthers])
            try audioSession.setActive(true, options: .notifyOthersOnDeactivation)

            let request = SFSpeechAudioBufferRecognitionRequest()
            request.shouldReportPartialResults = true
            speechRequest = request
            speechSessionActive = true

            let inputNode = audioEngine.inputNode
            let format = inputNode.outputFormat(forBus: 0)
            guard format.sampleRate > 0, format.channelCount > 0 else {
                throw OffGridNativeError(message: "The iPhone microphone did not provide a usable audio format.")
            }
            inputNode.installTap(onBus: 0, bufferSize: 1_024, format: format) { [weak self] buffer, _ in
                self?.speechRequest?.append(buffer)
            }
            speechTapInstalled = true

            speechTask = speechRecognizer.recognitionTask(with: request) { [weak self] result, error in
                DispatchQueue.main.async {
                    guard let self, self.speechSessionActive else { return }
                    if let result {
                        self.emitVoiceEvent(
                            "offgrid-native-voice-result",
                            details: [
                                "transcript": result.bestTranscription.formattedString,
                                "isFinal": result.isFinal
                            ]
                        )
                        if result.isFinal {
                            self.stopVoiceInput(notifyWebView: true)
                            return
                        }
                    }
                    if let error {
                        self.stopVoiceInput(notifyWebView: false)
                        self.emitVoiceEvent(
                            "offgrid-native-voice-error",
                            details: [
                                "code": "recognition-failed",
                                "message": "Voice Input stopped: \(error.localizedDescription)",
                                "canOpenSettings": false
                            ]
                        )
                    }
                }
            }

            audioEngine.prepare()
            try audioEngine.start()
            emitVoiceEvent("offgrid-native-voice-state", details: ["status": "listening"])
        } catch {
            stopVoiceInput(notifyWebView: false)
            emitVoiceEvent(
                "offgrid-native-voice-error",
                details: [
                    "code": "audio-start-failed",
                    "message": "Voice Input could not start: \(error.localizedDescription)",
                    "canOpenSettings": false
                ]
            )
        }
    }

    private func stopVoiceInput(notifyWebView: Bool) {
        let wasActive = speechSessionActive || audioEngine.isRunning
        voiceStartRequested = false
        speechSessionActive = false

        if audioEngine.isRunning { audioEngine.stop() }
        if speechTapInstalled {
            audioEngine.inputNode.removeTap(onBus: 0)
            speechTapInstalled = false
        }
        speechRequest?.endAudio()
        speechTask?.cancel()
        speechTask = nil
        speechRequest = nil
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)

        if notifyWebView && wasActive {
            emitVoiceEvent("offgrid-native-voice-state", details: ["status": "stopped"])
        }
    }

    private func emitVoicePermissionError(for status: SFSpeechRecognizerAuthorizationStatus) {
        let message: String
        switch status {
        case .restricted:
            message = "Speech Recognition is restricted on this iPhone."
        case .denied:
            message = "Speech Recognition access is required for Voice Input."
        case .notDetermined:
            message = "Speech Recognition permission was not completed. Please try again."
        case .authorized:
            return
        @unknown default:
            message = "Speech Recognition permission is unavailable."
        }
        emitVoiceEvent(
            "offgrid-native-voice-error",
            details: [
                "code": "speech-permission-denied",
                "message": message,
                "canOpenSettings": status == .denied
            ]
        )
    }

    private func emitVoiceEvent(_ name: String, details: [String: Any]) {
        emitWebEvent(name, details: details)
    }

    private func emitVideoEvent(_ name: String, details: [String: Any]) {
        emitWebEvent(name, details: details)
    }

    private func emitWebEvent(_ name: String, details: [String: Any]) {
        guard
            JSONSerialization.isValidJSONObject(details),
            let data = try? JSONSerialization.data(withJSONObject: details),
            let json = String(data: data, encoding: .utf8),
            let nameData = try? JSONSerialization.data(withJSONObject: [name]),
            let nameArray = String(data: nameData, encoding: .utf8)
        else { return }

        let encodedName = String(nameArray.dropFirst().dropLast())
        let script = "window.dispatchEvent(new CustomEvent(\(encodedName), { detail: \(json) }));"
        DispatchQueue.main.async { [weak self] in
            self?.webView?.evaluateJavaScript(script) { _, error in
                if let error { NSLog("OffGrid native bridge event failed: %@", error.localizedDescription) }
            }
        }
    }

    private func presentVideoPicker(source: String) {
        guard topPresenter()?.presentedViewController == nil else {
            emitVideoError("Close the current screen before choosing a video.")
            return
        }

        if source == "camera" {
            guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
                emitVideoError("Video recording is not available on this device.")
                return
            }
            let picker = UIImagePickerController()
            picker.sourceType = .camera
            picker.mediaTypes = [UTType.movie.identifier]
            picker.cameraCaptureMode = .video
            picker.videoMaximumDuration = 20
            picker.videoQuality = .typeMedium
            picker.delegate = self
            picker.modalPresentationStyle = .fullScreen
            topPresenter()?.present(picker, animated: true)
            return
        }

        var configuration = PHPickerConfiguration(photoLibrary: .shared())
        configuration.filter = .videos
        configuration.selectionLimit = 1
        configuration.preferredAssetRepresentationMode = .current
        let picker = PHPickerViewController(configuration: configuration)
        picker.delegate = self
        picker.modalPresentationStyle = .fullScreen
        topPresenter()?.present(picker, animated: true)
    }

    func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        picker.dismiss(animated: true)
        guard let result = results.first else {
            emitVideoEvent("offgrid-native-video-state", details: ["status": "cancelled"])
            return
        }

        emitVideoEvent("offgrid-native-video-state", details: ["status": "processing"])
        let provider = result.itemProvider
        guard provider.hasItemConformingToTypeIdentifier(UTType.movie.identifier) else {
            emitVideoError("Please choose a video file.")
            return
        }

        provider.loadFileRepresentation(forTypeIdentifier: UTType.movie.identifier) { [weak self] url, error in
            guard let self else { return }
            if let error {
                self.emitVideoError("The selected video could not be opened: \(error.localizedDescription)")
                return
            }
            guard let url else {
                self.emitVideoError("The selected video could not be opened.")
                return
            }

            do {
                let ext = url.pathExtension.isEmpty ? "mov" : url.pathExtension
                let copyURL = FileManager.default.temporaryDirectory
                    .appendingPathComponent("offgrid-video-\(UUID().uuidString)")
                    .appendingPathExtension(ext)
                try FileManager.default.copyItem(at: url, to: copyURL)
                let suggestedName = provider.suggestedName.map { name in
                    (name as NSString).pathExtension.isEmpty ? "\(name).\(ext)" : name
                } ?? "video.\(ext)"
                self.processVideo(at: copyURL, displayName: suggestedName)
            } catch {
                self.emitVideoError("The selected video could not be copied for analysis: \(error.localizedDescription)")
            }
        }
    }

    func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        emitVideoEvent("offgrid-native-video-state", details: ["status": "cancelled"])
    }

    func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        picker.dismiss(animated: true)
        guard let url = info[.mediaURL] as? URL else {
            emitVideoError("The recorded video could not be opened.")
            return
        }
        emitVideoEvent("offgrid-native-video-state", details: ["status": "processing"])
        processVideo(at: url, displayName: url.lastPathComponent)
    }

    private func processVideo(at url: URL, displayName: String) {
        DispatchQueue.global(qos: .userInitiated).async { [weak self] in
            guard let self else { return }
            defer { try? FileManager.default.removeItem(at: url) }

            do {
                let fileSize = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard fileSize <= 200 * 1_024 * 1_024 else {
                    throw OffGridNativeError(message: "Video file is too large. Maximum size is 200 MB.")
                }

                let asset = AVURLAsset(url: url)
                let duration = CMTimeGetSeconds(asset.duration)
                guard duration.isFinite, duration > 0 else {
                    throw OffGridNativeError(message: "The selected video does not have a usable duration.")
                }
                guard duration <= 20.05 else {
                    throw OffGridNativeError(message: "Video is too long (\(Int(duration.rounded())) seconds). Maximum duration is 20 seconds for AI analysis.")
                }

                let generator = AVAssetImageGenerator(asset: asset)
                generator.appliesPreferredTrackTransform = true
                generator.maximumSize = CGSize(width: 512, height: 384)
                generator.requestedTimeToleranceBefore = CMTime(seconds: 0.08, preferredTimescale: 600)
                generator.requestedTimeToleranceAfter = CMTime(seconds: 0.08, preferredTimescale: 600)

                let targetFrameCount = 8
                var frames: [String] = []
                for index in 0..<targetFrameCount {
                    let second = min(max(0, duration - 0.05), (Double(index) + 0.5) / Double(targetFrameCount) * duration)
                    let image = try generator.copyCGImage(
                        at: CMTime(seconds: second, preferredTimescale: 600),
                        actualTime: nil
                    )
                    guard let jpeg = UIImage(cgImage: image).jpegData(compressionQuality: 0.62) else { continue }
                    frames.append("data:image/jpeg;base64,\(jpeg.base64EncodedString())")
                }

                guard !frames.isEmpty else {
                    throw OffGridNativeError(message: "No frames could be extracted from the selected video.")
                }

                let ext = url.pathExtension.lowercased()
                let mimeType = ext == "mp4" || ext == "m4v" ? "video/mp4" : "video/quicktime"
                self.emitVideoEvent(
                    "offgrid-native-video-ready",
                    details: [
                        "frames": frames,
                        "thumbnailUrl": frames[0],
                        "name": displayName,
                        "size": fileSize,
                        "duration": duration,
                        "mimeType": mimeType
                    ]
                )
            } catch {
                self.emitVideoError(error.localizedDescription)
            }
        }
    }

    private func emitVideoError(_ message: String) {
        DispatchQueue.main.async { [weak self] in
            self?.emitVideoEvent("offgrid-native-video-error", details: ["message": message])
        }
    }

    private func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
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
