---
name: Encrypted Image Cache — Layered Strategy
description: EncryptedImageFetcher now checks BitmapMemoryCache then DecryptedDiskCache before network. Fixed 2026-04-01.
type: project
---

**Before:** `EncryptedImageFetcher` always hit the network regardless of DecryptedDiskCache state. BitmapMemoryCache and DecryptedDiskCache were populated by composables manually but ignored by the fetcher.

**After:** `EncryptedImageFetcher` implements 3-layer cache lookup:
1. `BitmapMemoryCache` (keyed by `userID:url`) — sub-millisecond in-process hit
2. `DecryptedDiskCache` — avoids network + decryption on repeat views; populates memory cache on hit
3. Network — downloads encrypted bytes, decrypts, writes to both caches

**File:** `core/data/service/EncryptedImageLoader.kt`

**Coil config** (`TinyActApplication.kt`):
- Memory cache: 25% of heap (was hardcoded 50MB)
- `respectCacheHeaders(false)` added — Firebase Storage signed URLs rotate so cache headers are not reliable for expiry
- Disk cache: 100MB (unchanged)
- Crossfade: 200ms (unchanged)

**Why:** Firebase Storage signed URLs have short expiry headers. Without `respectCacheHeaders(false)`, Coil evicts perfectly valid cached images, forcing redundant network fetches for encrypted photos.

**How to apply:** Never rely on Firebase Storage URL cache headers for eviction decisions. Always set `respectCacheHeaders(false)` for Firebase Storage images.
