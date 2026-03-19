# TinyAct Project Navigation Guide

Use this as your starting map before touching any file. Read only the exact files you need.

---

## iOS (`microcommit/micro-commit/`)

### Where features live
| Feature | Screen | ViewModel |
|---------|--------|-----------|
| Goals / My Goals | `Core/Presentation/Screens/MyGoals/MyGoalsView.swift` | `MyGoalsViewModel.swift` (separate file) |
| Group Detail | `Core/Presentation/Screens/Groups/GroupDetailView.swift` | same file (bottom of file) |
| Check-in | `Core/Presentation/Screens/CheckIn/CheckInView.swift` | same file |
| Archive | `Core/Presentation/Screens/Archive/ArchiveView.swift` | `ArchiveViewModel.swift` |
| Profile | `Core/Presentation/Screens/Profile/ProfileView.swift` | same file |
| Feed | `Core/Presentation/Screens/Feed/FeedView.swift` | same file |
| Auth / Onboarding | `Core/Presentation/Screens/Authentication/` | |
| Invitations / Notifications | `Core/Presentation/Screens/Invitations/InvitationsView.swift` | `InvitationsViewModel.swift` |
| Settings | `Core/Presentation/Screens/Settings/` | |

### Domain models (source of truth for fields)
- `Core/Domain/Models/Commitment.swift`
- `Core/Domain/Models/Streak.swift`
- `Core/Domain/Models/User.swift`
- `Core/Domain/Models/Group.swift`
- `Core/Domain/Models/Completion.swift`

### Services
- `Infrastructure/Services/StreakCalculationService.swift` — streak math
- `Infrastructure/Services/AwardService.swift` — XP / awards
- `Infrastructure/Services/AuthenticationService.swift`
- `Infrastructure/Services/PushNotificationService.swift`
- `Infrastructure/Services/ImageEncryptionService.swift`
- `Infrastructure/Services/WidgetDataService.swift`

### Data layer
- `Core/Data/Repositories/Firebase*Repository.swift` — Firestore implementations
- `Core/Data/Local/` — SwiftData stack + entities
- `Core/Data/SyncEngine/` — offline queue

### Tests (`TinyActTests/`)
- `AlgorithmParityTests.swift` — canonical JSON vector tests (DO NOT break)
- `StreakTests.swift` — Streak model unit tests
- `TestHelpers/TestDataFactory.swift` — factory helpers
- `TestHelpers/MockRepositories.swift`

### Entry point
- `micro_commitApp.swift` → `ContentView.swift`
- Navigation: each screen is pushed/presented directly (no central nav graph)

---

## Android (`TinyAct---Android/`)

### Where features live (each is a Gradle module)
| Feature | Module path |
|---------|-------------|
| Goals / My Goals | `feature/goals/` → `MyGoalsScreen.kt` + `MyGoalsViewModel.kt` |
| Commitment Detail | `feature/goals/` → `CommitmentDetailScreen.kt` + `CommitmentDetailViewModel.kt` |
| Archive | `feature/archive/` → `ArchiveScreen.kt` + `ArchiveViewModel.kt` |
| Check-in | `feature/checkin/` |
| Feed | `feature/feed/` → `FeedScreen.kt` |
| Profile | `feature/profile/` |
| Auth | `feature/auth/` |
| Settings | `feature/settings/` |
| Onboarding | `feature/onboarding/` |
| Create commitment | `feature/create/` |
| Groups | `feature/groups/` |
| Invitations / Notifications | `feature/goals/` → `NotificationsScreen.kt` + `NotificationsViewModel.kt` |
| Partnership management | `feature/profile/` → `PartnershipManagementScreen.kt` + `PartnershipManagementViewModel.kt` |

### Domain models
- `core/domain/src/main/java/com/lokesh/tinyact/core/domain/model/`
  - `Commitment.kt`, `Streak.kt`, `User.kt`, `Group.kt`, `Completion.kt`

### Services
- `core/domain/src/main/java/com/lokesh/tinyact/core/domain/service/StreakCalculationService.kt`

### Data layer
- `core/data/src/main/java/com/lokesh/tinyact/core/data/repository/Firebase*Repository.kt`
- `core/data/src/main/java/com/lokesh/tinyact/core/data/local/` — Room DB
- `core/data/src/main/java/com/lokesh/tinyact/core/data/di/DataModule.kt` — Hilt bindings

### Common / shared UI
- `core/common/src/main/java/com/lokesh/tinyact/core/common/`
  - `BrandColors.kt` — `BrandCoral`, `BrandGreen`, `BrandPurple`, `BrandOrange`
  - `AppTypography.kt`
  - `HapticManager.kt`
  - `AwardPopupService.kt`

### Navigation
- `app/src/main/java/com/lokesh/tinyact/navigation/TinyActNavGraph.kt` — root nav graph
- `feature/goals/GoalsNavigation.kt` — goals sub-graph (detail screen lives here)

### Tests
- `core/domain/src/test/.../AlgorithmParityTest.kt` — canonical JSON vector tests (DO NOT break)

### Key config
- `gradle/libs.versions.toml` — all dependency versions
- `app/google-services.json` — Firebase config (SHA-1 fingerprints registered here)

---

## Shared / Backend

### Algorithm source of truth (read in this order)
1. `Streakalgorithm.md` — **product spec** (source of truth)
2. `algorithm-spec.md` — technical translation
3. `microcommit/functions/src/algorithms/streakCalculation.ts` — canonical implementation
4. `shared/test-vectors/streak-vectors.json` — JSON test vectors consumed by both platforms

### Firebase Cloud Functions
- `microcommit/functions/src/` — TypeScript source
- `microcommit/functions/src/algorithms/` — streak calculation
- `microcommit/functions/src/index.ts` — function entry points
  - `onStreakUpdated` — streak break notifications
  - `onGroupInvitationCreated/Updated` — group invite notifications
  - `onPartnershipInvitationCreated/Updated` — partnership invite notifications
  - `sendSmartNudges` — scheduled nudge notifications
  - `onCompletionCreated` — completion notifications
  - `onGroupUpdated`, `onGroupDeleted` — group lifecycle notifications

---

## Naming conventions (find files faster)

| What you want | iOS pattern | Android pattern |
|---------------|-------------|-----------------|
| A screen | `*View.swift` | `*Screen.kt` |
| A view model | `*ViewModel.swift` (bottom of View file or separate) | `*ViewModel.kt` |
| A repo interface | `*Repository.swift` (in `Core/Domain/`) | `*Repository.kt` (in `core/domain/`) |
| A repo implementation | `Firebase*Repository.swift` | `Firebase*Repository.kt` |
| A model | `Core/Domain/Models/*.swift` | `core/domain/model/*.kt` |
| A DI module | N/A (uses `@Environment`/`@StateObject`) | `core/data/di/DataModule.kt` |

---

## Token-saving rules

1. **Never glob the whole repo** — use the tables above to go directly to the file.
2. **Read only the function/struct you need** — use `offset` + `limit` on Read for large files.
3. **Search before reading** — use Grep with a precise pattern on a specific path before opening a file.
4. **Models are stable** — if you only need field names, read the model file, not the repository.
5. **Algorithm changes** — always update all four layers: `Streakalgorithm.md` → `algorithm-spec.md` → `streakCalculation.ts` → `streak-vectors.json` → both platform services.
6. **Build errors after model changes** — search for the removed property name across `*.swift` or `*.kt` before assuming the build is clean.
