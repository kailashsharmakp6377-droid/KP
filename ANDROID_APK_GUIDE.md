# KP HUBE — Android Studio APK Build Guide

- **App Name**: KP HUBE
- **Package Name (Application ID)**: `com.kphube.app`
- **Price**: ₹499 (`KP HUBE Complete Course`)
- **Backend URL Variable**: `VITE_API_BASE_URL` (defaults to your hosted KP HUBE server URL)

---

## Step 1: Install Dependencies & Sync Android Project
On your computer (with Node.js 20+ installed), run inside the project folder:

```bash
npm install
npm run cap:sync
```

> If your backend server is hosted on a custom domain, create `.env` from `.env.example` and set:
> `VITE_API_BASE_URL="https://your-live-kphube-server.com"`
> before running `npm run cap:sync`.

---

## Step 2: Open in Android Studio
1. Install **Android Studio** (latest stable version with Android SDK & Java JDK 17/21).
2. Run:
   ```bash
   npm run cap:open
   ```
   (or open the `android/` folder directly via **File → Open** in Android Studio).
3. Wait 1–3 minutes for **Gradle Sync** to finish automatically.

---

## Step 3: Build Installable Android APK (Debug or Signed Release)

### Option A — Quick Testing APK (Debug APK)
1. In Android Studio top menu, click **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
2. Or from terminal:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```
3. Your installable APK will be generated at:
   `android/app/build/outputs/apk/debug/app-debug.apk`
4. Copy `app-debug.apk` to any Android phone and tap **Install**.

### Option B — Play Store / Production Signed Release APK
1. In Android Studio, click **Build → Generate Signed Bundle / APK...**
2. Select **APK** (or **Android App Bundle** for Google Play Store) and click **Next**.
3. Click **Create new...** to create a Keystore file (keep your `.jks` file and passwords backed up safely).
4. Choose **release** build variant and click **Finish**.
5. Your signed release APK will be generated at:
   `android/app/release/app-release.apk`
