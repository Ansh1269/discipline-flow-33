# DisciplineOS Native Mobile (Capacitor)

Wraps the DisciplineOS web app as native iOS and Android apps that can ship to the App Store and Google Play.

## One-time setup

```bash
npm install --save-dev @capacitor/cli
npm install @capacitor/core @capacitor/ios @capacitor/android
npx cap add ios
npx cap add android
```

The shared config lives in `capacitor.config.ts` and points both shells at the published web URL.

## Sync and open

After any change to `capacitor.config.ts`:

```bash
npx cap sync
npx cap open ios       # opens Xcode      → Product > Archive to ship to TestFlight / App Store
npx cap open android   # opens Android Studio → Build > Generate Signed App Bundle → upload to Play Console
```

## App identifiers

- iOS / Android bundle id: `app.disciplineos.client`
- Display name: `DisciplineOS`

Update these in `capacitor.config.ts` before publishing under your own developer account.