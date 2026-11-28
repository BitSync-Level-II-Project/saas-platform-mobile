# SiteTrace Mobile

SiteTrace is a field operations platform for managing warehouses, assigning work, collecting structured data, and reviewing results. This repository contains the worker app built with Expo, Expo Router, React Native, and TypeScript. It is designed to use the same SiteTrace API as the web workspace.

| Repository | Role | Integration branch |
| --- | --- | --- |
| [SiteTrace Web](https://github.com/BitSync-Level-II-Project/saas-platform-web) | Browser workspace for managers and supervisors | `chore/web-foundation` |
| [SiteTrace API](https://github.com/BitSync-Level-II-Project/saas-platform-api) | Shared backend and PostgreSQL database | `chore/api-foundation` |
| [SiteTrace Mobile](https://github.com/BitSync-Level-II-Project/saas-platform-mobile) | Worker task and form capture app | `main` |

## What works today

The current build uses demo tasks and form versions supplied by the app. The demo runs without a backend.

- Open a demo task, enter answers, and review the form before simulating a submission.
- Scan a barcode on a supported device or enter the code manually.
- Capture photo evidence on a supported device. Forms marked as requiring a photo block review until evidence is provided.
- Resume native drafts after closing the app. Draft records use SQLite-backed storage; saved photographs are copied into the app's local documents directory.
- Retry a simulated submission with the same attempt ID and payload, and display its local confirmation.

Demo confirmations stay on the device. Authenticated task retrieval, live submissions, server receipts, photo upload, and synchronization across devices are not available in this build. The [worker mobile API contract](https://github.com/BitSync-Level-II-Project/saas-platform-api/blob/chore/api-foundation/docs/worker-mobile-api-contract.md) describes the planned integration.

## Run locally

**Prerequisites:** Git, Node.js 24 (see [`.nvmrc`](./.nvmrc)), npm, and a supported client for the project's Expo SDK. The repository uses Expo SDK 58.

```bash
git clone https://github.com/BitSync-Level-II-Project/saas-platform-mobile.git
cd saas-platform-mobile
npm ci
```

Choose a way to run the app:

| Target | Command | What to expect |
| --- | --- | --- |
| Installed development build | `npm run start -- --dev-client` | Start Metro, then open the project from the development build on your device or emulator. |
| Android from source | `npm run android` | Build and run the native app with the Android SDK and a configured emulator or connected device. |
| iOS from source | `npm run ios` | Build and run on macOS with Xcode installed. |
| Browser preview | `npm run web` | Inspect screens and manual barcode entry. Storage is in memory; use a native device to verify persistence, scanning, and photo capture. |

For native verification, use a [development build](https://docs.expo.dev/develop/development-builds/use-development-builds/) that matches the project. Rebuild it when native dependencies or config plugins change. Use the project's [Expo SDK documentation](https://docs.expo.dev/versions/v58.0.0/) and [`AGENTS.md`](./AGENTS.md) before changing native features.

### API configuration for future integration

[`.env.example`](./.env.example) reserves `EXPO_PUBLIC_API_URL`. It is not required by the current demo and setting it does not activate live submissions. The example uses `http://10.0.2.2:3000/api/v1` for the Android Studio emulator. When testing the future integration on a physical phone, use a development API address reachable from that phone instead of the phone's `localhost`. Treat `EXPO_PUBLIC_*` values as public configuration.

## Project layout

| Path | Purpose |
| --- | --- |
| [`src/app/`](./src/app) | Expo Router screens, including the demo task list, task detail, and capture routes |
| [`src/features/worker/`](./src/features/worker) | Form capture, validation, review, and local attempt workflow |
| [`src/features/worker/worker-offline-store.native.ts`](./src/features/worker/worker-offline-store.native.ts) | Native SQLite and photo storage |
| [`src/features/worker/worker-offline-store.ts`](./src/features/worker/worker-offline-store.ts) | In-memory browser preview storage |
| [`test/`](./test) | Automated worker form and local storage tests |
| [`app.json`](./app.json) | Expo settings and native plugin configuration |

## Verify a change

```bash
npm run check
npm run lint
npm run test:worker
```

On Windows PowerShell, use `npm.cmd` if the PowerShell wrapper is blocked. The [mobile CI workflow](./.github/workflows/ci.yml) runs type checking, lint, and worker tests for changes targeting `main`.

On a physical device, save a partial form with a photo, close and reopen the app, and confirm both are still present. Check that permission denial leaves manual barcode entry usable. Simulate a submission, reopen the app, retry, and confirm that the attempt ID stays the same and the confirmation appears only once. Document these as demo checks until a real API receipt is available.

## Contribute

Use the existing mobile branch for your work (for example, `chore/mobile-foundation`) and open reviewed PRs against `main`. Link the Jira issue, document automated checks, and record the device or emulator used. Distinguish demo or fixture results from results verified against the shared API.

- [BitSync Jira board](https://gunasekarapdvp.atlassian.net/jira/software/projects/SCRUM/boards/1)
- [Repository license](./LICENSE)
