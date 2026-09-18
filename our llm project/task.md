# Task List — Balanced Device Trust & Web Client Activation

- [x] **Backend Component Updates**
  - [x] Allow `'web'` platform in `/me/devices/reset-request` validation in `backend/src/routes/auth.ts`
  - [x] Pre-register approved device as trusted in `/device-resets/:id/action` in `backend/src/routes/admin.ts`
- [x] **Dashboard UI Updates**
  - [x] Update `ResetRequest` interface and tag styling in `dashboard/src/app/dashboard/device-resets/page.tsx`
- [x] **Verification & Validation**
  - [x] Run backend tests and verify they pass
  - [x] Verify dashboard compilation
