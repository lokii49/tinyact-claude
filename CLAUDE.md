# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TinyAct is a cross-platform micro-commitment tracking app with two native implementations sharing the same Firebase backend:

- **iOS** (`microcommit/`): Swift/SwiftUI app named "MicroCommit"
- **Android** (`TinyAct---Android/`): Kotlin/Jetpack Compose app
- **Backend** (`microcommit/functions/`): Firebase Cloud Functions (TypeScript/Node.js)

The primary development goal is maintaining **feature parity** between the iOS and Android apps.

## Commands

### iOS (open in Xcode)
```bash
open microcommit/micro-commit.xcodeproj
# Build: Cmd+B | Run tests: Cmd+U | Run: Cmd+R
```

### Firebase Cloud Functions
```bash
cd microcommit/functions
npm run build          # Compile TypeScript
npm run serve          # Local emulator (builds first)
npm run deploy         # Deploy to Firebase
npm run seed-demo      # Seed demo data
```

### Android
```bash
cd TinyAct---Android
./gradlew assembleDebug          # Debug APK
./gradlew assembleRelease        # Release APK (requires keystore)
./gradlew test                   # Unit tests
./gradlew connectedAndroidTest   # Instrumented tests (requires device/emulator)
```

## Architecture

Both platforms use **Clean Architecture + MVVM**:

```
User Action → View → ViewModel → Repository → Firebase (remote)
                                            → Room/SwiftData (local cache)
```

### Layers

- **Domain**: Pure business logic, no framework dependencies. Core models: `User`, `Commitment`, `Group`, `Completion`, `Streak`, `Award`.
- **Data**: Repository implementations connecting domain to Firebase Firestore/Auth/Storage and local DB. Includes a Sync Engine for offline-first operation.
- **Presentation**: MVVM — ViewModels hold `StateFlow`/`@Published` state, Views are declarative (Compose/SwiftUI).
- **Infrastructure/Services**: Cross-cutting concerns — auth, push notifications, streak calculation, image encryption, awards/XP, deep linking.

### iOS-Specific Structure
- `Core/Domain/` — models and repository protocols
- `Core/Data/` — Firebase DTOs, repository implementations, SwiftData local stack, sync engine
- `Core/Presentation/` — screens organized by feature, each with `*View.swift` + `*ViewModel.swift`
- `Infrastructure/Services/` — `AuthenticationService`, `PushNotificationService`, `StreakCalculationService`, `AwardService`, `ImageEncryptionService`, `WidgetDataService`, etc.
- `MicroCommitWidget/` — iOS widget extension sharing data via app group

### Android-Specific Structure
Multi-module Gradle project:
- `app/` — entry point (`MainActivity.kt`), navigation graph, theme
- `core/domain/` — models, repository interfaces, `StreakCalculationService`
- `core/data/` — Firebase repositories, Room DB (entities + DAOs), sync engine, DI modules (Hilt)
- `core/common/` — shared utilities, brand colors, typography, `HapticManager`, `AwardPopupService`
- `feature/<name>/` — one module per feature: `auth`, `feed`, `checkin`, `goals`, `groups`, `profile`, `settings`, `onboarding`, `archive`, `create`

Dependencies are managed via version catalog at `gradle/libs.versions.toml` (Kotlin 2.0.21, AGP 8.5.1, Hilt 2.53.1, Compose BOM 2024.12.01, Room 2.6.1).

### Firebase Backend (Cloud Functions)
Handles server-side notifications only: group invitations, partnership invitations, streak break alerts, user removal from groups. All other notification scheduling is done client-side.

## Key Design Decisions

- **Offline-first**: Writes go to a local queue (SwiftData/Room), the sync engine flushes to Firestore when online. UI loads from cache immediately.
- **Image encryption**: Check-in photo proofs are encrypted at rest in Firebase Storage for privacy.
- **Deep linking**: Both apps handle custom URL schemes for navigation from push notifications (`microcommit://`).
- **Streak logic**: Complex pause/resume support with partner accountability — see `StreakCalculationService` on both platforms.
- **iOS naming**: The iOS app/project is named "MicroCommit" (legacy); the brand name is "TinyAct".

## Testing

### iOS (`microcommit/TinyActTests/`)
- `MockRepositories.swift` and `TestDataFactory.swift` provide test infrastructure
- `InMemorySwiftDataStack.swift` for local DB tests
- Key test files: `StreakTests.swift`, `CommitmentTests.swift`, `UserTests.swift`, `ArchiveFilteringTests.swift`, `RenewalTests.swift`

### Android
- Unit tests use JUnit 4; Hilt injection works in tests via `@HiltAndroidTest`
- Instrumented tests use Espresso and require a connected device or emulator

## Active Development Notes

- `TinyAct---Android/todo.md` — current UI/UX and performance tasks
- `TinyAct---Android/checklist.md` — iOS/Android parity QA checklist
- `TinyAct---Android/audit-remediation-status.md` — security audit tracking
