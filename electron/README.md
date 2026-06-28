# DisciplineOS Desktop (Electron)

Wraps the published DisciplineOS web app as a native Windows / macOS / Linux desktop app.

## One-time setup

```bash
npm install --save-dev electron @electron/packager
```

Add to `package.json`:

```json
{
  "main": "electron/main.cjs",
  "scripts": {
    "electron": "electron .",
    "pack:win": "electron-packager . DisciplineOS --platform=win32 --arch=x64 --out=electron-release --overwrite --ignore='node_modules' --ignore='^/src' --ignore='^/public'",
    "pack:mac": "electron-packager . DisciplineOS --platform=darwin --arch=universal --out=electron-release --overwrite",
    "pack:linux": "electron-packager . DisciplineOS --platform=linux --arch=x64 --out=electron-release --overwrite"
  }
}
```

## Run locally

```bash
npm run electron
```

## Build installers

```bash
npm run pack:win    # Windows .exe folder
npm run pack:mac    # macOS .app
npm run pack:linux  # Linux binary
```

Zip the output folder and host it at `/downloads/DisciplineOS-Setup-win-x64.zip` (the link used by the in-app `/download` page).

## Configure

Set `DISCIPLINEOS_URL` env var to point the desktop shell at a custom-domain deployment.