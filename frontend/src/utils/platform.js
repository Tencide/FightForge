import { Capacitor } from '@capacitor/core';

/** True only in the web build (Vercel), false inside the native iOS app. */
export function isWebPlatform() {
  return !Capacitor.isNativePlatform();
}
