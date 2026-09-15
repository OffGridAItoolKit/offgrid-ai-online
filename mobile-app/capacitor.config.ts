import type { CapacitorConfig } from '@capacitor/cli';

declare const process: { env: Record<string, string | undefined> };

const mobilePlatform = String(process.env.OFFGRID_MOBILE_PLATFORM || '').trim().toLowerCase();
const platformQuery = ['ios', 'android'].includes(mobilePlatform) ? `&platform=${mobilePlatform}` : '';
const serverUrl = process.env.OFFGRID_MOBILE_SERVER_URL || `https://offgridtoolkit.ai/online?surface=app${platformQuery}`;

const config: CapacitorConfig = {
  appId: 'com.offgridaitoolkit.app',
  appName: 'OffGrid AI FieldGuide',
  webDir: 'www',
  server: {
    url: serverUrl,
    cleartext: serverUrl.startsWith('http://'),
    allowNavigation: ['offgridtoolkit.ai']
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
