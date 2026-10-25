# Domain Auth App

A cross-platform authentication and task-management application built with React Native, React Native Web, Expo, Firebase Authentication, and Cloud Firestore.

## Features

- Google sign-in for web and mobile.
- Restricts access to verified Google accounts ending in `@hbplus.fit`.
- Protected dashboard and logout.
- Responsive dark-themed task dashboard.
- Create, edit, complete, and delete tasks.
- Task priorities: Low, Medium, and High.
- Task descriptions and due dates.
- Real-time task synchronization with Cloud Firestore.
- User-specific task storage and security rules.
- TypeScript support.

## Tech Stack

- React Native and React Native Web
- Expo and Expo Router
- TypeScript
- Firebase Authentication
- Cloud Firestore
- Google OAuth

## Prerequisites

- Node.js and npm
- A Firebase project
- Google sign-in configured in Firebase Authentication
- A configured Google OAuth web client ID
- Cloud Firestore enabled

## Getting Started

Clone the repository:

```bash
git clone https://github.com/Ashish-kumar-pal-1436/domain-auth-app.git
cd domain-auth-app
npm install
```

Create a local `.env.local` file using the variable names below. Obtain the corresponding values from your Firebase project and Google OAuth configuration.

```dotenv
EXPO_PUBLIC_ALLOWED_DOMAIN=hbplus.fit
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=
```

Fill in the values locally. Do not commit `.env.local` or private credentials.

## Run Locally

Start the Expo development server:

```bash
npx expo start
```

Run the web version:

```bash
npx expo start --web
```

## Validation

Check TypeScript:

```bash
npx tsc --noEmit
```

Build the production web export:

```bash
npx expo export --platform web
```

The web build is exported to the `dist` directory.

## Firebase Configuration

The Firebase project used for this assignment is `reactnativeassignment-7d13c`.

1. Enable Google as a sign-in provider in Firebase Authentication.
2. Configure the relevant Google OAuth client IDs.
3. Enable Cloud Firestore.
4. Deploy the repository's Firestore rules using:

```bash
npx firebase-tools deploy --only firestore:rules --project reactnativeassignment-7d13c
```

5. Add the production website hostname to Firebase Authentication's authorized domains.
6. Test permitted and rejected Google accounts.

The client-side domain check improves the sign-in experience. Firestore security rules independently restrict database access to the authenticated user and the authorized email domain.

## Firestore Data Structure

Tasks are stored at:

`users/{userId}/tasks/{taskId}`

The task document contains:

- `title`: string
- `description`: string
- `priority`: `Low`, `Medium`, or `High`
- `dueDate`: string
- `completed`: boolean
- `createdAt`: timestamp

## Security

- Firestore rules restrict users to their own task documents.
- Task fields and values are validated by Firestore rules.
- Local environment files and build artifacts are excluded from Git.
- Never publish service-account credentials or private keys.

## Manual Testing Checklist

- [ ] Sign in with an authorized `@hbplus.fit` account.
- [ ] Verify an unauthorized account is rejected.
- [ ] Confirm signed-out users cannot access the dashboard.
- [ ] Create, edit, complete, and delete tasks.
- [ ] Confirm tasks persist after refreshing the app.
- [ ] Verify a second authorized user cannot access another user's tasks.
- [ ] Test logout and login again.
- [ ] Verify the deployed web application works.

## Project Status

The web production export has been generated, and the Firestore security rules have been deployed. Complete the live authentication and database tests before treating the assignment as fully verified.