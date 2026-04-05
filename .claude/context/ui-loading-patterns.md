# UI Loading Patterns

## Two-State Loading Model

Both platforms use a two-state model to distinguish cold launch from stale-cache refresh:

| State | When | UI shown |
|---|---|---|
| `isLoading = true` | Cold launch — no cached data exists | Skeleton loading cards |
| `isRefreshing = true` | Return navigation — stale cached data exists | Pull-to-refresh spinner / "Refreshing…" |

Never use `isLoading` for return visits when data is already present. That collapses the two states and makes the skeleton unreachable.

---

## Android Feed (FeedViewModel + FeedScreen)

**Key files:**
- `TinyAct---Android/feature/feed/src/main/java/com/lokesh/tinyact/feature/feed/FeedViewModel.kt`
- `TinyAct---Android/feature/feed/src/main/java/com/lokesh/tinyact/feature/feed/FeedScreen.kt`

**`FeedDataCache`** — process-scoped Kotlin `object` singleton (lines 44–46 of FeedViewModel). Stores `lastSnapshot: FeedUiState?`. Survives tab navigation within the same process. Reset on process death only.

**Init pattern:**
```kotlin
private val _uiState = MutableStateFlow(
    FeedDataCache.lastSnapshot?.copy(isLoading = false, isRefreshing = true)
        ?: FeedUiState(isLoading = true, ...)
)
```

**Skeleton condition** (`FeedScreen.kt`):
```kotlin
when {
    uiState.isLoading -> { /* show 3x SkeletonFeedCard */ }
    ...
}
```

**Throttle guard (10 seconds):** `loadFeed()` exits early if called within 10s of last fetch. The early-return path must clear `isLoading = false, isRefreshing = false` before returning — otherwise the spinner hangs forever.

**Critical trap — local cache kills skeleton:**
The local Room snapshot path (`loadFeedSnapshot(uid, localOnly = true)`) resolves in ~20–80ms. If this path sets `isLoading = false`, the skeleton dies before Compose commits a visible frame. Rule: **`isLoading` must only be cleared by the remote fetch completion or failure path** — never by the local snapshot update.

---

## iOS Feed (FeedView + HomeViewModel)

**Key files:**
- `microcommit/micro-commit/Core/Presentation/Screens/Feed/FeedView.swift`
- `microcommit/micro-commit/Core/Presentation/Screens/Home/HomeViewModel.swift`

**`@Published var isLoadingFeed: Bool`** — starts `false`, set to `true` only on cold launch (empty cache).
**`@Published var isRefreshing: Bool`** — set to `true` on warm re-entry; cleared when remote fetch completes or fails.

**Skeleton condition** (`FeedView.swift`):
```swift
if viewModel.isLoadingFeed && viewModel.groupCompletions.isEmpty {
    // show SkeletonFeedCard
}
```

**Throttle guard (30 seconds):** `loadRecentActivityFast()` and `loadRecentActivity()` exit early when cache is fresh. Early-return must set `isRefreshing = false` before returning.

**Critical trap — `showSkeleton` 80ms delay (removed):**
Originally `FeedView` had a local `@State var showSkeleton = false` with an 80ms `.task` delay in `.onAppear`. This was added to prevent warm-cache flash but also blocked the skeleton on cold launch when SwiftData resolved in under 80ms. The variable and delay have been removed. Do not reintroduce this pattern.

---

## Rules for Future Agents

1. **`isLoading` = no data at all.** Skeleton shows. Only cleared by remote fetch result.
2. **`isRefreshing` = have stale data, fetching update.** Spinner shows over content. Cleared by remote fetch result or throttle early-return.
3. **Never clear `isLoading` from a local/Room/SwiftData cache path** — local cache is too fast; skeleton won't render.
4. **Throttle early-returns must always clear both flags** — leaving either `true` causes a hanging spinner.
5. **Do not add view-layer delays** (e.g., `Task.sleep`, `DispatchQueue.asyncAfter`) to gate skeleton visibility — they race against fast local storage and lose.
