---
name: Navigation Transitions — Full Audit & Fix
description: All detail screens now have slide push/pop transitions; tab roots use fade. Fixed 2026-04-01.
type: project
---

All composable declarations in navigation files were using default crossfade. Fixed 2026-04-01.

**Files updated:**
- `feature/goals/GoalsNavigation.kt` — slide on COMMITMENT_DETAIL, CONVERT_SOLO_TO_GROUP, COMMITMENT_PHOTOS; fade on GOALS_ROUTE
- `feature/groups/navigation/GroupsNavigation.kt` — slide on GROUP_DETAIL; fade on GROUPS_ROUTE
- `feature/settings/navigation/SettingsNavigation.kt` — slide on SETTINGS, SETTINGS_PROFILE, SETTINGS_ACHIEVEMENTS, SETTINGS_NOTIFICATIONS, SETTINGS_SUGGESTIONS
- `feature/profile/navigation/ProfileNavigation.kt` — fade on PROFILE_ROUTE; slide on PARTNERSHIP_MANAGEMENT
- `app/navigation/TinyActNavGraph.kt` — fade on FEED_ROUTE, CHECKIN_ROUTE; slide on "archive", "notifications"
- `feature/create/navigation/CreateNavigation.kt` — slide on CREATE_COMMITMENT_ROUTE

**Spec applied:**
- Detail push: `slideInHorizontally { it }` / `slideOutHorizontally { -it/3 }` / `slideInHorizontally { -it/3 }` / `slideOutHorizontally { it }` all at `tween(300, FastOutSlowInEasing)`
- Tab roots: `fadeIn/fadeOut` at `tween(200)`

**Why:** Tab roots feel natural with fade (no directional hierarchy). Detail screens feel native with iOS-style slide-from-right push and parallax-pop.

**How to apply:** Any new composable that is a "pushed" detail screen (has a back button) must use the slide spec. New tab roots use fade.
