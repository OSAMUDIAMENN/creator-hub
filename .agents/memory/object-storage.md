---
name: Object Storage provisioning
description: Object Storage is provisioned; env vars are auto-set.
---

## Rule
Object Storage was provisioned via `setupObjectStorage()`. The following secrets are now set automatically: `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PUBLIC_OBJECT_SEARCH_PATHS`, `PRIVATE_OBJECT_DIR`. The API server must be restarted after provisioning for the env vars to take effect.

**Why:** The upload route (`/api/uploads/request-url`) and `ObjectStorageService` class in `artifacts/api-server/src/lib/objectStorage.ts` throw if these vars are not set. File uploads will fail silently on the client side if the server errors.

**How to apply:** If file uploads break again, check that the API server has the env vars (restart it). Do NOT call setupObjectStorage() again — it's already provisioned.
