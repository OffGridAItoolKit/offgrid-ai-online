import type { CapacitorConfig } from '@capacitor/cli';

declare const process: { env: Record<string, string | undefined> };

const serverUrl = process.env.OFFGRID_MOBILE_SERVER_URL || 'https://offgridtoolkit.ai/online?surface=app';

const config: CapacitorConfig = {
  appId: 'com.offgridaitoolkit.app',
  appName: 'OffGrid AI FieldGuide',
  webDir: 'www',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://')
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      backgroundColor: '#2c1810',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false
    },
    StatusBar: {
      // Capacitor names this for the bar background: LIGHT produces dark indicators.
      style: 'LIGHT',
      backgroundColor: '#c58b00',
      overlaysWebView: false
    }
  }
};

export default config;
