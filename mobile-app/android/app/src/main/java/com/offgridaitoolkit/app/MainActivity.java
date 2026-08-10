package com.offgridaitoolkit.app;

import android.content.ContentValues;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.text.Html;
import android.text.Layout;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.text.TextUtils;
import android.text.style.LeadingMarginSpan;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.widget.Toast;
import android.view.Surface;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.content.FileProvider;
import com.getcapacitor.BridgeActivity;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
    private SensorManager sensorManager;
    private Sensor nativeCompassSensor;
    private SensorEventListener nativeCompassListener;
    private float nativeCompassHeading = Float.NaN;
    private int nativeCompassAccuracy = SensorManager.SENSOR_STATUS_UNRELIABLE;
    private long lastCompassEmitMs = 0;
    private ActivityResultLauncher<Intent> savedGuidePickerLauncher;
    private TextToSpeech nativeTextToSpeech;
    private volatile boolean nativeTtsReady = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        savedGuidePickerLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            result -> {
                if (result.getResultCode() != RESULT_OK || result.getData() == null) return;
                Uri guideUri = result.getData().getData();
                if (guideUri == null) return;

                Intent viewIntent = new Intent(Intent.ACTION_VIEW);
                viewIntent.setDataAndType(guideUri, "application/pdf");
                viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivity(viewIntent);
                } catch (Exception error) {
                    Toast.makeText(MainActivity.this, "No PDF viewer found", Toast.LENGTH_LONG).show();
                }
            }
        );

        getBridge().getWebView().addJavascriptInterface(new OffGridNativeBridge(), "OffGridNative");
        initializeNativeTextToSpeech();
    }

    @Override
    public void onPause() {
        stopNativeCompass();
        super.onPause();
    }

    @Override
    public void onDestroy() {
        if (nativeTextToSpeech != null) {
            nativeTextToSpeech.stop();
            nativeTextToSpeech.shutdown();
            nativeTextToSpeech = null;
        }
        nativeTtsReady = false;
        super.onDestroy();
    }

    private void initializeNativeTextToSpeech() {
        nativeTextToSpeech = new TextToSpeech(getApplicationContext(), status -> {
            if (status != TextToSpeech.SUCCESS || nativeTextToSpeech == null) {
                nativeTtsReady = false;
                return;
            }

            int languageResult = nativeTextToSpeech.setLanguage(Locale.getDefault());
            if (languageResult == TextToSpeech.LANG_MISSING_DATA || languageResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                languageResult = nativeTextToSpeech.setLanguage(Locale.US);
            }
            nativeTextToSpeech.setSpeechRate(0.96f);
            nativeTtsReady = languageResult != TextToSpeech.LANG_MISSING_DATA
                && languageResult != TextToSpeech.LANG_NOT_SUPPORTED;
            nativeTextToSpeech.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {
                }

                @Override
                public void onDone(String utteranceId) {
                    if (utteranceId != null && utteranceId.endsWith("-last")) {
                        notifyNativeSpeechFinished();
                    }
                }

                @Override
                public void onError(String utteranceId) {
                    notifyNativeSpeechFinished();
                }
            });
        });
    }

    private void notifyNativeSpeechFinished() {
        runOnUiThread(() -> {
            if (getBridge() == null || getBridge().getWebView() == null) return;
            getBridge().getWebView().evaluateJavascript(
                "if(window.handleNativeToolkitTTSFinished){window.handleNativeToolkitTTSFinished();}",
                null
            );
        });
    }

    private static List<String> chunkTextForNativeSpeech(String text) {
        List<String> chunks = new ArrayList<>();
        String remaining = text == null ? "" : text.trim();
        int maxLength = Math.min(3000, TextToSpeech.getMaxSpeechInputLength() - 100);

        while (remaining.length() > maxLength) {
            int splitAt = -1;
            for (char boundary : new char[] {'.', '!', '?', ';', ':', '\n'}) {
                splitAt = Math.max(splitAt, remaining.lastIndexOf(boundary, maxLength));
            }
            if (splitAt < maxLength / 2) {
                splitAt = remaining.lastIndexOf(' ', maxLength);
            }
            if (splitAt <= 0) splitAt = maxLength;
            else splitAt += 1;

            chunks.add(remaining.substring(0, splitAt).trim());
            remaining = remaining.substring(splitAt).trim();
        }
        if (!remaining.isEmpty()) chunks.add(remaining);
        return chunks;
    }

    private class OffGridNativeBridge {
        @JavascriptInterface
        public void openAppSettings() {
            runOnUiThread(() -> {
                Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getPackageName()));
                startActivity(intent);
            });
        }

        @JavascriptInterface
        public String speakText(String text) {
            try {
                String spokenText = text == null ? "" : text.trim();
                if (spokenText.isEmpty()) {
                    throw new IllegalArgumentException("There is no text to read.");
                }
                if (!nativeTtsReady || nativeTextToSpeech == null) {
                    throw new IllegalStateException("The phone text-to-speech voice is still starting or is unavailable.");
                }

                List<String> chunks = chunkTextForNativeSpeech(spokenText);
                runOnUiThread(() -> {
                    nativeTextToSpeech.stop();
                    String sessionId = "offgrid-tts-" + System.currentTimeMillis();
                    for (int index = 0; index < chunks.size(); index++) {
                        String utteranceId = sessionId + (index == chunks.size() - 1 ? "-last" : "-" + index);
                        nativeTextToSpeech.speak(
                            chunks.get(index),
                            index == 0 ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD,
                            null,
                            utteranceId
                        );
                    }
                });

                return new JSONObject()
                    .put("ok", true)
                    .put("chunks", chunks.size())
                    .toString();
            } catch (Exception error) {
                return nativeError(error);
            }
        }

        @JavascriptInterface
        public String stopSpeaking() {
            try {
                if (nativeTextToSpeech != null) {
                    runOnUiThread(() -> nativeTextToSpeech.stop());
                }
                return new JSONObject().put("ok", true).toString();
            } catch (Exception error) {
                return nativeError(error);
            }
        }

        @JavascriptInterface
        public String saveImageToGallery(String dataUrl, String filename) {
            try {
                ImagePayload payload = parseImagePayload(dataUrl);
                String safeName = safeImageName(filename, payload.extension);

                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, safeName);
                values.put(MediaStore.Images.Media.MIME_TYPE, payload.mimeType);
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/OffGrid AI");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);

                Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    throw new IllegalStateException("Could not create gallery image.");
                }

                try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                    if (output == null) {
                        throw new IllegalStateException("Could not open gallery image.");
                    }
                    output.write(payload.bytes);
                }

                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                getContentResolver().update(uri, values, null, null);

                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved to Gallery > OffGrid AI", Toast.LENGTH_LONG).show());
                return new JSONObject()
                    .put("ok", true)
                    .put("uri", uri.toString())
                    .put("filename", safeName)
                    .toString();
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Image save failed", Toast.LENGTH_LONG).show());
                return nativeError(error);
            }
        }

        @JavascriptInterface
        public String shareImage(String dataUrl, String filename) {
            try {
                ImagePayload payload = parseImagePayload(dataUrl);
                String safeName = safeImageName(filename, payload.extension);
                File shareDir = new File(getCacheDir(), "shared_images");
                if (!shareDir.exists() && !shareDir.mkdirs()) {
                    throw new IllegalStateException("Could not create share cache.");
                }

                File imageFile = new File(shareDir, safeName);
                try (FileOutputStream output = new FileOutputStream(imageFile)) {
                    output.write(payload.bytes);
                }

                Uri uri = FileProvider.getUriForFile(
                    MainActivity.this,
                    getPackageName() + ".fileprovider",
                    imageFile
                );

                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType(payload.mimeType);
                shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
                shareIntent.putExtra(Intent.EXTRA_TEXT, "Made with OffGrid AI Image Studio.");
                shareIntent.setClipData(ClipData.newRawUri("OffGrid AI Image Studio visual", uri));
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                runOnUiThread(() -> startActivity(Intent.createChooser(shareIntent, "Share OffGrid AI visual")));
                return new JSONObject()
                    .put("ok", true)
                    .put("uri", uri.toString())
                    .put("filename", safeName)
                    .toString();
            } catch (Exception error) {
                return nativeError(error);
            }
        }

        @JavascriptInterface
        public String saveFieldGuidePdf(String imageDataUrl, String title, String question, String answer, String filename) {
            PdfDocument document = null;
            try {
                ImagePayload imagePayload = parseImagePayload(imageDataUrl);
                Bitmap visual = BitmapFactory.decodeByteArray(imagePayload.bytes, 0, imagePayload.bytes.length);
                if (visual == null) {
                    throw new IllegalArgumentException("Could not decode field guide image.");
                }

                String safeName = safePdfName(filename, title);
                document = new PdfDocument();
                PdfWriter writer = new PdfWriter(document);
                writer.writeFieldGuide(title, question, answer, visual);

                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, safeName);
                values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/OffGrid AI");
                values.put(MediaStore.Downloads.IS_PENDING, 1);

                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    throw new IllegalStateException("Could not create PDF file.");
                }

                try (OutputStream output = getContentResolver().openOutputStream(uri)) {
                    if (output == null) {
                        throw new IllegalStateException("Could not open PDF file.");
                    }
                    document.writeTo(output);
                }

                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                getContentResolver().update(uri, values, null, null);

                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Saved PDF to Downloads > OffGrid AI", Toast.LENGTH_LONG).show());
                return new JSONObject()
                    .put("ok", true)
                    .put("uri", uri.toString())
                    .put("filename", safeName)
                    .toString();
            } catch (Exception error) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "PDF save failed", Toast.LENGTH_LONG).show());
                return nativeError(error);
            } finally {
                if (document != null) {
                    document.close();
                }
            }
        }

        @JavascriptInterface
        public String shareFieldGuidePdf(String imageDataUrl, String title, String question, String answer, String filename) {
            PdfDocument document = null;
            try {
                ImagePayload imagePayload = parseImagePayload(imageDataUrl);
                Bitmap visual = BitmapFactory.decodeByteArray(imagePayload.bytes, 0, imagePayload.bytes.length);
                if (visual == null) {
                    throw new IllegalArgumentException("Could not decode field guide image.");
                }

                String safeName = safePdfName(filename, title);
                document = new PdfDocument();
                PdfWriter writer = new PdfWriter(document);
                writer.writeFieldGuide(title, question, answer, visual);

                File shareDir = new File(getCacheDir(), "shared_field_guides");
                if (!shareDir.exists() && !shareDir.mkdirs()) {
                    throw new IllegalStateException("Could not create field guide share cache.");
                }

                File pdfFile = new File(shareDir, safeName);
                try (FileOutputStream output = new FileOutputStream(pdfFile)) {
                    document.writeTo(output);
                }

                Uri uri = FileProvider.getUriForFile(
                    MainActivity.this,
                    getPackageName() + ".fileprovider",
                    pdfFile
                );

                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType("application/pdf");
                shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
                shareIntent.putExtra(Intent.EXTRA_SUBJECT, title == null || title.trim().isEmpty() ? "OffGrid AI FieldGuide" : title.trim());
                shareIntent.setClipData(ClipData.newRawUri("OffGrid AI FieldGuide", uri));
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                runOnUiThread(() -> startActivity(Intent.createChooser(shareIntent, "Share field guide PDF")));
                return new JSONObject()
                    .put("ok", true)
                    .put("uri", uri.toString())
                    .put("filename", safeName)
                    .toString();
            } catch (Exception error) {
                return nativeError(error);
            } finally {
                if (document != null) {
                    document.close();
                }
            }
        }

        @JavascriptInterface
        public String openPdf(String uriString) {
            try {
                if (uriString == null || uriString.trim().isEmpty()) {
                    throw new IllegalArgumentException("No PDF URI was provided.");
                }
                Uri uri = Uri.parse(uriString);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/pdf");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                runOnUiThread(() -> {
                    try {
                        startActivity(intent);
                    } catch (Exception error) {
                        Toast.makeText(MainActivity.this, "No PDF viewer found", Toast.LENGTH_LONG).show();
                    }
                });
                return new JSONObject()
                    .put("ok", true)
                    .put("uri", uri.toString())
                    .toString();
            } catch (Exception error) {
                return nativeError(error);
            }
        }

        @JavascriptInterface
        public String openSavedGuides() {
            try {
                Uri folderUri = Uri.parse("content://com.android.externalstorage.documents/document/primary%3ADownload%2FOffGrid%20AI");
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/pdf");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, folderUri);
                }

                runOnUiThread(() -> {
                    try {
                        savedGuidePickerLauncher.launch(intent);
                    } catch (Exception error) {
                        Toast.makeText(
                            MainActivity.this,
                            "Saved PDFs: Files > Downloads > OffGrid AI. Images: Gallery > OffGrid AI.",
                            Toast.LENGTH_LONG
                        ).show();
                    }
                });

                return new JSONObject()
                    .put("ok", true)
                    .put("action", "pick-pdf")
                    .put("location", "Downloads/OffGrid AI")
                    .toString();
            } catch (Exception error) {
                return nativeError(error);
            }
        }

        @JavascriptInterface
        public String startCompass() {
            try {
                boolean started = startNativeCompass();
                return new JSONObject()
                    .put("ok", started)
                    .put("source", "android-rotation-vector")
                    .put("error", started ? JSONObject.NULL : "No rotation-vector compass sensor was available.")
                    .toString();
            } catch (Exception error) {
                return nativeError(error);
            }
        }

        @JavascriptInterface
        public String stopCompass() {
            stopNativeCompass();
            try {
                return new JSONObject()
                    .put("ok", true)
                    .toString();
            } catch (Exception error) {
                return nativeError(error);
            }
        }

        private String nativeError(Exception error) {
            try {
                return new JSONObject()
                    .put("ok", false)
                    .put("error", error.getMessage())
                    .toString();
            } catch (Exception ignored) {
                return "{\"ok\":false,\"error\":\"Native bridge error\"}";
            }
        }

        private ImagePayload parseImagePayload(String dataUrl) {
            if (dataUrl == null || !dataUrl.startsWith("data:image/")) {
                throw new IllegalArgumentException("Expected an image data URL.");
            }

            int commaIndex = dataUrl.indexOf(',');
            if (commaIndex < 0) {
                throw new IllegalArgumentException("Invalid image data URL.");
            }

            String header = dataUrl.substring(5, commaIndex);
            String base64Data = dataUrl.substring(commaIndex + 1);
            String mimeType = header.split(";")[0];
            String extension = mimeType.contains("jpeg") ? "jpg" : mimeType.substring(mimeType.indexOf('/') + 1);
            byte[] bytes = Base64.decode(base64Data, Base64.DEFAULT);
            return new ImagePayload(mimeType, extension, bytes);
        }

        private String safeImageName(String filename, String extension) {
            String base = filename == null || filename.trim().isEmpty()
                ? "offgrid-ai-visual"
                : filename.trim();
            base = base.replaceAll("[^a-zA-Z0-9._-]", "-");
            if (!base.toLowerCase().endsWith("." + extension.toLowerCase())) {
                base = base.replaceAll("\\.[a-zA-Z0-9]+$", "") + "." + extension;
            }
            return base;
        }

        private String safePdfName(String filename, String title) {
            String base = filename == null || filename.trim().isEmpty()
                ? (title == null || title.trim().isEmpty() ? "offgrid-ai-field-guide" : title.trim())
                : filename.trim();
            base = base.replaceAll("[^a-zA-Z0-9._-]", "-");
            if (!base.toLowerCase().endsWith(".pdf")) {
                base = base.replaceAll("\\.[a-zA-Z0-9]+$", "") + ".pdf";
            }
            return base;
        }
    }

    private boolean startNativeCompass() {
        if (sensorManager == null) {
            sensorManager = (SensorManager) getSystemService(SENSOR_SERVICE);
        }
        if (sensorManager == null) return false;

        stopNativeCompass();
        nativeCompassSensor = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
        if (nativeCompassSensor == null) {
            nativeCompassSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR);
        }
        if (nativeCompassSensor == null) return false;

        nativeCompassHeading = Float.NaN;
        nativeCompassAccuracy = SensorManager.SENSOR_STATUS_UNRELIABLE;
        lastCompassEmitMs = 0;

        nativeCompassListener = new SensorEventListener() {
            @Override
            public void onSensorChanged(SensorEvent event) {
                if (event.sensor.getType() != Sensor.TYPE_ROTATION_VECTOR
                    && event.sensor.getType() != Sensor.TYPE_GEOMAGNETIC_ROTATION_VECTOR) {
                    return;
                }

                float[] rotationMatrix = new float[9];
                float[] remappedMatrix = new float[9];
                float[] orientation = new float[3];
                SensorManager.getRotationMatrixFromVector(rotationMatrix, event.values);

                int axisX = SensorManager.AXIS_X;
                int axisY = SensorManager.AXIS_Y;
                int rotation = getWindowManager().getDefaultDisplay().getRotation();
                if (rotation == Surface.ROTATION_90) {
                    axisX = SensorManager.AXIS_Y;
                    axisY = SensorManager.AXIS_MINUS_X;
                } else if (rotation == Surface.ROTATION_180) {
                    axisX = SensorManager.AXIS_MINUS_X;
                    axisY = SensorManager.AXIS_MINUS_Y;
                } else if (rotation == Surface.ROTATION_270) {
                    axisX = SensorManager.AXIS_MINUS_Y;
                    axisY = SensorManager.AXIS_X;
                }

                SensorManager.remapCoordinateSystem(rotationMatrix, axisX, axisY, remappedMatrix);
                SensorManager.getOrientation(remappedMatrix, orientation);
                float heading = (float) ((Math.toDegrees(orientation[0]) + 360.0) % 360.0);

                nativeCompassHeading = Float.isNaN(nativeCompassHeading)
                    ? heading
                    : smoothHeading(nativeCompassHeading, heading, 0.24f);

                long now = System.currentTimeMillis();
                if (now - lastCompassEmitMs >= 120) {
                    lastCompassEmitMs = now;
                    emitCompassHeading(nativeCompassHeading, nativeCompassAccuracy);
                }
            }

            @Override
            public void onAccuracyChanged(Sensor sensor, int accuracy) {
                nativeCompassAccuracy = accuracy;
            }
        };

        return sensorManager.registerListener(
            nativeCompassListener,
            nativeCompassSensor,
            SensorManager.SENSOR_DELAY_GAME
        );
    }

    private void stopNativeCompass() {
        if (sensorManager != null && nativeCompassListener != null) {
            sensorManager.unregisterListener(nativeCompassListener);
        }
        nativeCompassListener = null;
        nativeCompassSensor = null;
        nativeCompassHeading = Float.NaN;
        lastCompassEmitMs = 0;
    }

    private float smoothHeading(float previous, float next, float weight) {
        float delta = ((next - previous + 540f) % 360f) - 180f;
        return (previous + (delta * weight) + 360f) % 360f;
    }

    private String compassAccuracyLabel(int accuracy) {
        if (accuracy == SensorManager.SENSOR_STATUS_ACCURACY_HIGH) return "high";
        if (accuracy == SensorManager.SENSOR_STATUS_ACCURACY_MEDIUM) return "medium";
        if (accuracy == SensorManager.SENSOR_STATUS_ACCURACY_LOW) return "low";
        return "calibrating";
    }

    private void emitCompassHeading(float heading, int accuracy) {
        runOnUiThread(() -> {
            try {
                JSONObject payload = new JSONObject()
                    .put("heading", Math.round(heading))
                    .put("accuracy", compassAccuracyLabel(accuracy));
                String script = "window.offgridNativeCompassUpdate && window.offgridNativeCompassUpdate(" + payload.toString() + ");";
                getBridge().getWebView().evaluateJavascript(script, null);
            } catch (Exception ignored) {
                // Compass updates are best-effort; the web layer can fall back to browser events.
            }
        });
    }

    private static class ImagePayload {
        final String mimeType;
        final String extension;
        final byte[] bytes;

        ImagePayload(String mimeType, String extension, byte[] bytes) {
            this.mimeType = mimeType;
            this.extension = extension;
            this.bytes = bytes;
        }
    }

    private static class PdfWriter {
        private static final int PAGE_WIDTH = 540;
        private static final int PAGE_HEIGHT = 900;
        private static final int MARGIN = 34;
        private final PdfDocument document;
        private Canvas canvas;
        private int pageNumber = 0;
        private float y;
        private Paint paint;

        PdfWriter(PdfDocument document) {
            this.document = document;
        }

        void writeFieldGuide(String title, String question, String answer, Bitmap visual) {
            startPage();
            drawImageFullPage(visual);
            finishPage();

            if (answer != null && !answer.trim().isEmpty()) {
                startPage();
                drawSection("Field Guide");
                drawMarkdown(answer, 16.5f);
                finishPage();
            }
        }

        private void startPage() {
            PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, ++pageNumber).create();
            PdfDocument.Page page = document.startPage(pageInfo);
            canvas = page.getCanvas();
            canvas.drawColor(Color.WHITE);
            paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            y = MARGIN;
            currentPage = page;
        }

        private PdfDocument.Page currentPage;

        private void finishPage() {
            if (currentPage != null) {
                document.finishPage(currentPage);
                currentPage = null;
            }
        }

        private void newPage() {
            finishPage();
            startPage();
        }

        private void ensureSpace(float needed) {
            if (y + needed > PAGE_HEIGHT - MARGIN) {
                newPage();
            }
        }

        private void drawTitle(String title) {
            paint.setColor(Color.rgb(44, 24, 16));
            paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            paint.setTextSize(22f);
            for (String line : wrapText(title, paint, PAGE_WIDTH - (MARGIN * 2))) {
                ensureSpace(28f);
                canvas.drawText(line, MARGIN, y, paint);
                y += 27f;
            }
            paint.setStrokeWidth(3f);
            paint.setColor(Color.rgb(184, 134, 11));
            canvas.drawLine(MARGIN, y + 4f, PAGE_WIDTH - MARGIN, y + 4f, paint);
            y += 24f;
        }

        private void drawImage(Bitmap bitmap) {
            float availableWidth = PAGE_WIDTH - (MARGIN * 2);
            float availableHeight = PAGE_HEIGHT - (MARGIN * 2) - 90f;
            float scale = Math.min(availableWidth / bitmap.getWidth(), availableHeight / bitmap.getHeight());
            float width = bitmap.getWidth() * scale;
            float height = bitmap.getHeight() * scale;
            ensureSpace(height + 24f);
            float left = MARGIN + ((availableWidth - width) / 2f);
            RectF target = new RectF(left, y, left + width, y + height);
            paint.setStyle(Paint.Style.FILL);
            canvas.drawBitmap(bitmap, null, target, paint);
            y += height + 26f;
        }

        private void drawImageFullPage(Bitmap bitmap) {
            float margin = 24f;
            float availableWidth = PAGE_WIDTH - (margin * 2f);
            float availableHeight = PAGE_HEIGHT - (margin * 2f);
            float scale = Math.min(availableWidth / bitmap.getWidth(), availableHeight / bitmap.getHeight());
            float width = bitmap.getWidth() * scale;
            float height = bitmap.getHeight() * scale;
            float left = margin + ((availableWidth - width) / 2f);
            float top = margin + ((availableHeight - height) / 2f);
            RectF target = new RectF(left, top, left + width, top + height);
            paint.setStyle(Paint.Style.FILL);
            canvas.drawBitmap(bitmap, null, target, paint);
        }

        private void drawSection(String section) {
            ensureSpace(52f);
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(Color.rgb(250, 245, 235));
            canvas.drawRect(MARGIN, y, PAGE_WIDTH - MARGIN, y + 38f, paint);
            paint.setColor(Color.rgb(184, 134, 11));
            canvas.drawRect(MARGIN, y, MARGIN + 5f, y + 38f, paint);
            paint.setColor(Color.rgb(44, 24, 16));
            paint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
            paint.setTextSize(19.5f);
            canvas.drawText(section, MARGIN + 14f, y + 26f, paint);
            y += 52f;
        }

        private void drawParagraph(String text, float textSize, boolean bold) {
            paint.setColor(Color.rgb(26, 26, 26));
            paint.setTypeface(Typeface.create(Typeface.DEFAULT, bold ? Typeface.BOLD : Typeface.NORMAL));
            paint.setTextSize(textSize);
            float lineHeight = textSize + 6f;
            String[] blocks = safeText(text, "").split("\\n");
            for (String block : blocks) {
                if (block.trim().isEmpty()) {
                    y += lineHeight * 0.55f;
                    continue;
                }
                for (String line : wrapText(block.trim(), paint, PAGE_WIDTH - (MARGIN * 2))) {
                    ensureSpace(lineHeight);
                    canvas.drawText(line, MARGIN, y, paint);
                    y += lineHeight;
                }
                y += 4f;
            }
        }

        private void drawMarkdown(String markdown, float textSize) {
            String html = markdownToPdfHtml(markdown);
            Spanned styled = Html.fromHtml(html, Html.FROM_HTML_MODE_LEGACY);
            drawStyledText(applyMobileListIndents(styled), textSize);
        }

        private CharSequence applyMobileListIndents(Spanned styled) {
            SpannableStringBuilder indented = new SpannableStringBuilder(styled);
            int lineStart = 0;
            while (lineStart < indented.length()) {
                int lineEnd = TextUtils.indexOf(indented, '\n', lineStart);
                if (lineEnd < 0) lineEnd = indented.length();
                String line = indented.subSequence(lineStart, lineEnd).toString().trim();
                if (line.startsWith("•") || line.matches("^\\d+[.)].*")) {
                    indented.setSpan(
                        new LeadingMarginSpan.Standard(16, 38),
                        lineStart,
                        lineEnd,
                        Spanned.SPAN_EXCLUSIVE_EXCLUSIVE
                    );
                }
                lineStart = lineEnd + 1;
            }
            return indented;
        }

        private void drawStyledText(CharSequence text, float textSize) {
            TextPaint textPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
            textPaint.setColor(Color.rgb(26, 26, 26));
            textPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
            textPaint.setTextSize(textSize);
            int width = PAGE_WIDTH - (MARGIN * 2);
            int offset = 0;

            while (offset < text.length()) {
                float availableHeight = PAGE_HEIGHT - MARGIN - y;
                if (availableHeight < textSize * 2f) {
                    newPage();
                    availableHeight = PAGE_HEIGHT - MARGIN - y;
                }

                CharSequence remaining = text.subSequence(offset, text.length());
                StaticLayout remainingLayout = createTextLayout(remaining, textPaint, width);

                int fittingLines = 0;
                for (int line = 0; line < remainingLayout.getLineCount(); line++) {
                    if (remainingLayout.getLineBottom(line) > availableHeight) break;
                    fittingLines = line + 1;
                }

                if (fittingLines == 0) {
                    newPage();
                    continue;
                }

                int chunkEnd = remainingLayout.getLineEnd(fittingLines - 1);
                CharSequence chunk = remaining.subSequence(0, chunkEnd);
                StaticLayout chunkLayout = createTextLayout(chunk, textPaint, width);

                canvas.save();
                canvas.translate(MARGIN, y);
                chunkLayout.draw(canvas);
                canvas.restore();
                y += chunkLayout.getHeight() + 3f;
                offset += chunkEnd;

                if (offset < text.length()) newPage();
            }
        }

        private StaticLayout createTextLayout(CharSequence text, TextPaint textPaint, int width) {
            return StaticLayout.Builder.obtain(text, 0, text.length(), textPaint, width)
                .setAlignment(Layout.Alignment.ALIGN_NORMAL)
                .setIncludePad(false)
                .setLineSpacing(2.5f, 1.08f)
                .build();
        }

        private static List<String> wrapText(String text, Paint paint, float maxWidth) {
            List<String> lines = new ArrayList<>();
            String[] words = safeText(text, "").split("\\s+");
            StringBuilder line = new StringBuilder();
            for (String word : words) {
                String candidate = line.length() == 0 ? word : line + " " + word;
                if (paint.measureText(candidate) <= maxWidth) {
                    line = new StringBuilder(candidate);
                } else {
                    if (line.length() > 0) lines.add(line.toString());
                    line = new StringBuilder(word);
                }
            }
            if (line.length() > 0) lines.add(line.toString());
            return lines;
        }

        private static String markdownToPdfHtml(String markdown) {
            String normalized = safeText(markdown, "")
                .replaceFirst("(?s)^---\\s*\\n.*?\\n---\\s*\\n?", "")
                .replaceAll("(?m)^```(?:\\w+)?\\s*$", "");
            StringBuilder html = new StringBuilder();

            for (String rawLine : normalized.split("\\r?\\n", -1)) {
                String line = rawLine.trim();
                if (line.isEmpty()) {
                    html.append("<br>");
                    continue;
                }
                if (line.matches("^[-*_]{3,}$")) {
                    html.append("<br>------------------------------<br>");
                    continue;
                }
                if (line.matches("^\\|?(?:\\s*:?-{3,}:?\\s*\\|)+\\s*:?-{3,}:?\\s*\\|?$")) {
                    continue;
                }

                String prefix = "";
                String suffix = "<br>";
                if (line.matches("^#{1,6}\\s+.*")) {
                    int level = line.indexOf(' ');
                    line = line.substring(level + 1).trim();
                    prefix = level <= 2 ? "<b><big>" : "<b>";
                    suffix = level <= 2 ? "</big></b><br>" : "</b><br>";
                } else if (line.matches("^[-*+]\\s+.*")) {
                    line = line.replaceFirst("^[-*+]\\s+", "");
                    prefix = "&#8226;&nbsp;&nbsp;";
                } else if (line.matches("^\\d+[.)]\\s+.*")) {
                    String marker = line.replaceFirst("^(\\d+[.)]).*$", "$1");
                    line = line.replaceFirst("^\\d+[.)]\\s+", "");
                    prefix = TextUtils.htmlEncode(marker) + "&nbsp;&nbsp;";
                } else if (line.startsWith("> ")) {
                    line = line.substring(2).trim();
                    prefix = "&#9656;&nbsp;&nbsp;<i>";
                    suffix = "</i><br>";
                } else if (line.contains("|")) {
                    line = line.replaceFirst("^\\|", "").replaceFirst("\\|$", "").replace("|", "  |  ");
                    prefix = "<tt>";
                    suffix = "</tt><br>";
                }

                String inline = TextUtils.htmlEncode(line)
                    .replaceAll("!\\[([^\\]]*)\\]\\(([^)]+)\\)", "$1")
                    .replaceAll("\\[([^\\]]+)\\]\\(([^)]+)\\)", "$1")
                    .replaceAll("\\*\\*\\*(.+?)\\*\\*\\*", "<b><i>$1</i></b>")
                    .replaceAll("\\*\\*(.+?)\\*\\*", "<b>$1</b>")
                    .replaceAll("(?<!\\*)\\*([^*]+)\\*(?!\\*)", "<i>$1</i>")
                    .replaceAll("`([^`]+)`", "<tt>$1</tt>")
                    .replaceAll("~~([^~]+)~~", "<s>$1</s>");
                html.append(prefix).append(inline).append(suffix);
            }

            return html.toString();
        }

        private static String markdownToPlainText(String markdown) {
            return safeText(markdown, "")
                .replaceAll("(?m)^#{1,6}\\s*", "")
                .replaceAll("\\*\\*(.*?)\\*\\*", "$1")
                .replaceAll("\\*(.*?)\\*", "$1")
                .replaceAll("`([^`]+)`", "$1")
                .replaceAll("(?m)^[-*]\\s+", "• ")
                .replaceAll("\\[([^\\]]+)\\]\\(([^)]+)\\)", "$1");
        }

        private static String safeText(String value, String fallback) {
            return value == null || value.trim().isEmpty() ? fallback : value.trim();
        }
    }
}
