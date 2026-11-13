import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';

export async function initCapacitorAndroid() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await StatusBar.setBackgroundColor({ color: '#6D28D9' });
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // ignore on platforms without StatusBar support
  }
  try {
    await SplashScreen.hide();
  } catch {
    // ignore
  }
}

export function registerAndroidBackHandler(onBack: () => boolean) {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }
  const listenerPromise = CapApp.addListener('backButton', ({ canGoBack }) => {
    const handled = onBack();
    if (!handled) {
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    }
  });

  return () => {
    listenerPromise.then((handle) => handle.remove()).catch(() => {});
  };
}
