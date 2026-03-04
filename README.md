# Pension Mini App (Frontend)

React frontend prototype for App Cube, implemented from the provided Pension BRD.

## Implemented flows

- Scenario 1: Withdraw Pension
  - Step-based navigation: Identity & OTP → Biometric Verify → Review & Confirm → Success
  - Validation for Pensioner No, Pension Card No, OTP, and PIN
  - Retry and lockout protection for OTP and PIN flows
  - Loading and failure states for every async action
  - Success screen with downloadable E-receipt

- Scenario 2: Pensioner Representative
  - Representative list with status badges (`APPROVED`, `PENDING`, `UNDER REVIEW`)
  - Representative request form with validation + PIN confirmation
  - Status polling simulation (`PENDING` → `UNDER REVIEW` → `APPROVED`)
  - Approved members can directly launch withdrawal with pre-filled identity

## Competition-ready enhancements

- Bilingual UI toggle (EN/MM)
- Mock API service layer for OTP, biometric, withdrawal, representative requests, and polling
- Analytics event hook for key journey checkpoints (OTP request/verify, withdrawal success, status updates)
- Sensitive data cleanup after successful withdrawal (OTP and PIN reset)

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Build

```bash
npm run build
```
