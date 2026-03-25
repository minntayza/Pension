
---

## 2) `Pension` — polished version

**GitHub About line**  
`Frontend prototype for a pension mini app with OTP, biometric verification, bilingual UI, and representative workflows.`

```md
# Pension Mini App Prototype

A frontend prototype for a pension mini app built from a business requirements document (BRD). The application focuses on secure pension withdrawal flows, representative handling, and a simple bilingual user experience.

## Overview

This project was designed as a competition-ready mini app prototype. It simulates a real digital financial service journey by combining identity verification, OTP validation, biometric checks, review steps, and digital receipt generation.

## Main User Flows

### 1. Withdraw Pension
- Identity and OTP verification
- Biometric / face verification
- Review and confirm
- Success screen with E-receipt

### 2. Pensioner Representative
- View representative members and statuses
- Submit representative request
- Poll approval status updates
- Start withdrawal flow with pre-filled identity when approved

## Key Features

- OTP request and verification flow
- Retry and temporary lockout protection
- PIN validation
- Biometric / liveness-style verification flow
- Bilingual UI (English / Myanmar)
- Representative request workflow
- Mock API service layer for realistic frontend behavior
- Analytics event hooks for key checkpoints
- Success screen with E-receipt flow
- Sensitive data cleanup after successful actions

## Tech Stack

- **Frontend:** React, Vite, JavaScript
- **State/UI Logic:** React Hooks
- **Mock Services:** Custom mock API layer
- **Other Concepts:** Validation, analytics hooks, bilingual content

## Screenshots

> Add screenshots in `/screenshots`.

- Home / flow selection  
  `![Home](./screenshots/home.png)`
- OTP verification  
  `![OTP](./screenshots/otp.png)`
- Biometric verification  
  `![Biometric](./screenshots/biometric.png)`
- Success / receipt screen  
  `![Receipt](./screenshots/receipt.png)`

## Run Locally

```bash
git clone https://github.com/minntayza/Pension.git
cd Pension
npm install
npm run dev
