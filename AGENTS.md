# Repository Guidelines

## Project Structure & Module Organization

TinyAct is a cross-platform micro-commitment app. The iOS app lives in `microcommit/`: SwiftUI source is under `microcommit/micro-commit/`, widget code in `MicroCommitWidget/`, unit tests in `TinyActTests/`, and UI tests in `TinyActUITests/`. Android lives in `TinyAct---Android/` as a multi-module Gradle project: `app/` is the entry point, `core/*` holds shared infrastructure, and `feature/<name>/` contains Compose feature modules. Firebase Cloud Functions are in `microcommit/functions/`. The Astro website is in `tinyact-website/`. Shared algorithm fixtures are in `shared/test-vectors/`.

## Build, Test, and Development Commands

- `cd TinyAct---Android && ./gradlew assembleDebug`: build the Android debug APK.
- `cd TinyAct---Android && ./gradlew test`: run Android JVM unit tests.
- `cd TinyAct---Android && ./gradlew connectedAndroidTest`: run Android instrumented tests on a device or emulator.
- `xcodebuild -scheme TinyAct -project microcommit/micro-commit.xcodeproj test`: run iOS tests.
- `cd microcommit/functions && npm run build`: compile TypeScript Firebase Functions.
- `cd microcommit/functions && npm run serve`: build and start local Firebase emulators for functions.
- `cd tinyact-website && npm run dev`: start the Astro site locally.
- `cd tinyact-website && npm run build`: create the static site build.

## Coding Style & Naming Conventions

Follow existing platform idioms. Use SwiftUI/MVVM naming on iOS (`CommitmentDetailView.swift`, `CommitmentDetailViewModel.swift`) and Kotlin/Compose/MVVM naming on Android (`CommitmentDetailScreen.kt`, `CommitmentDetailViewModel.kt`). Keep business logic in domain/services rather than views. Use TypeScript for functions and scripts, with camelCase functions and PascalCase types. Preserve existing indentation and formatting; no repository-wide formatter is configured.

## Testing Guidelines

Add focused tests beside the affected platform. iOS tests use XCTest in `microcommit/TinyActTests/` with helpers under `TestHelpers/`. Android unit tests use JUnit under each module’s `src/test/`; instrumented tests belong in `src/androidTest/`. For shared streak, XP, and award logic, update `shared/test-vectors/*.json` and verify parity. Name tests after the behavior protected, for example `StreakTests` or `AlgorithmParityTests`.

## Commit & Pull Request Guidelines

Recent history uses short imperative summaries, often with scope, such as `Update auth and streaks SKILL.md` or `Add Claude workspace`. Keep commits focused and mention the platform or subsystem when useful. Pull requests should include a concise summary, test commands run, linked issues or docs, and screenshots for UI changes.

## Security & Configuration Tips

Firebase config files and signing artifacts exist in the tree; avoid rotating or editing credentials unless required. Do not commit generated dependency folders or local user state. Treat Firestore rules, notification code, and image encryption paths as security-sensitive.
