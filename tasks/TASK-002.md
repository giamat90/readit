# TASK-002: Supabase wiring + auth flow + profiles

## Status: APPROVED

## Overview
Connect ReadIt to Supabase and build the authentication flow: email/password sign-up and sign-in, session persistence across app restarts, an auth routing guard, and the `profiles` table (migration 001) auto-populated on sign-up. Google Sign-In is included as a second phase behind manual Supabase console setup. After this task every later feature (documents, positions, Pro gating) has a real `user_id` to hang off.

## User story
As a user, I want to create an account and stay signed in so that my library and playback positions follow me.

## Acceptance criteria
- [ ] New user can sign up with email + password, lands on the Library tab
- [ ] Existing user can sign in; wrong credentials show a translated error, not a crash
- [ ] Session survives app kill + relaunch (AsyncStorage persistence)
- [ ] Signed-out users are redirected to the login screen from any route
- [ ] Sign out from Settings → Account row works and redirects to login
- [ ] A `profiles` row is auto-created on sign-up (DB trigger) and loaded into `useUserStore`
- [ ] RLS verified: a signed-in user cannot read another user's profile row
- [ ] `npx tsc --noEmit` passes; app runs on device
- [ ] (Phase 2, after console setup) Google Sign-In completes the same flow

## Technical plan

### Files to create
| File | Purpose |
|------|---------|
| `lib/supabase.ts` | Supabase client: `createClient(EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY)` with AsyncStorage session storage, `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`; import `react-native-url-polyfill/auto` first |
| `app/(auth)/_layout.tsx` | Stack for auth screens, no header |
| `app/(auth)/login.tsx` | Single screen with sign-in / sign-up mode toggle, email + password fields, submit button, error banner, Google button (hidden until Phase 2 flag on) |
| `supabase/migrations/001_profiles.sql` | `profiles` table per CLAUDE.md schema + RLS (select/update own row only) + `on_auth_user_created` trigger inserting a profile row |
| `.env.example` | `EXPO_PUBLIC_SUPABASE_URL=` / `EXPO_PUBLIC_SUPABASE_ANON_KEY=` (committed; real `.env` stays gitignored) |

### Files to modify
| File | Change |
|------|--------|
| `app/_layout.tsx` | Add session state + `onAuthStateChange` listener + routing guard (mirror GreenThumb's `_layout.tsx` pattern, minus onboarding/notifications): no session → `router.replace("/(auth)/login")`; session on auth screen → `router.replace("/(tabs)")`. Register `(auth)` in the Stack. Fetch profile into `useUserStore` on sign-in; fall back to a minimal profile from auth metadata if the trigger row isn't there yet |
| `app/(tabs)/settings.tsx` | Account row becomes active: shows user email, tap → confirm dialog → `supabase.auth.signOut()` |
| `store/user.ts` | Add `session: Session \| null`, `setSession`; keep existing profile fields |
| `package.json` | Add `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill` (use `npx expo install` for the async-storage version) |

### Database changes
_Migration number: 001_
`profiles` table exactly as in CLAUDE.md §Database schema, plus:
- `ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;`
- Policies: `profiles_select_own` (`auth.uid() = id`) for SELECT, `profiles_update_own` for UPDATE. No INSERT policy — rows come from the trigger (SECURITY DEFINER)
- Trigger: `on_auth_user_created` AFTER INSERT ON `auth.users` → `INSERT INTO profiles (id) VALUES (new.id)`

### Edge functions
None.

### i18n keys
`auth.signIn`, `auth.signUp`, `auth.email`, `auth.password`, `auth.submitSignIn`, `auth.submitSignUp`, `auth.toggleToSignUp`, `auth.toggleToSignIn`, `auth.errorInvalidCredentials`, `auth.errorGeneric`, `auth.signOut`, `auth.signOutConfirm`, `settings.signedInAs` — en + it.

## Implementation steps
1. `npx expo install @react-native-async-storage/async-storage`; `npm install @supabase/supabase-js react-native-url-polyfill`
2. Write migration 001 and `.env.example`
3. **⚡ Manual step (Giacomo)**: create the Supabase project at supabase.com, paste URL + anon key into `.env`, run migration 001 in the SQL editor (or `npx supabase db push`), then record the project ref in CONTEXT.md
4. Build `lib/supabase.ts`, extend `store/user.ts`
5. Build `(auth)` screens; wire the routing guard in `app/_layout.tsx`
6. Activate the Settings account row (email + sign out)
7. Verify acceptance criteria on device; commit on `feat/task-002-auth`
8. **Phase 2 (separate commit, after Giacomo configures the Google provider + `readit://` redirect in the Supabase console)**: Google button via `signInWithOAuth` + `expo-web-browser` deep-link flow

## Testing checklist
- [ ] Works on free tier (all users are free at this point)
- [ ] Works on Pro tier (n/a until TASK-009)
- [ ] Works offline / poor network — login shows translated error, no hang; already-signed-in user still reaches Library
- [ ] i18n: tested in en + it
- [ ] No hardcoded pixel values
- [ ] No layout regressions on Moto G 5G (keyboard: `softwareKeyboardLayoutMode: resize` is already set — verify inputs stay visible)

## Dependencies
TASK-001 (TESTED, merged).

## Notes
- Do NOT gate the app behind email verification in v1.0 — Supabase "Confirm email" setting should be OFF for now (⚡ manual console toggle), otherwise sign-up appears broken on device.
- Keep the auth guard tolerant of the trigger race: profile row may lag the auth user by a moment (GreenThumb hit this — see its `fetchProfile` fallback).
- Never log emails or tokens; error banner text comes from i18n, not raw Supabase messages.
- Session type import: `import type { Session } from "@supabase/supabase-js"`.
