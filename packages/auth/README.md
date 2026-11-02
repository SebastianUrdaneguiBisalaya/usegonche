# @usegonche/auth

Supabase Auth for Hono: email + password, Google, and OTP-code password recovery.

## Supabase setup (once)

1. **Auth > Sign In / Providers**: enable _Email_ with _Confirm email_ ON, minimum password length 8. Enable _Google_ (Client ID/secret from Google Cloud; its redirect URI is `https://<ref>.supabase.co/auth/v1/callback`).
2. **Auth > URL Configuration**: add the API callback (`https://<api>/auth/callback`, and `http://localhost:4000/auth/callback` for dev) to _Redirect URLs_.
3. **Auth > Email Templates > Reset Password**: render the code instead of the link: `Your code: {{ .Token }}`. Set _Email OTP length_ to 6 and a short expiry.
4. Run `sql/block_cross_provider_identity.sql` in the SQL Editor (one account = one sign-in method).

## Routes (`app.route('/auth', createAuthRoutes({ onSignIn }))`)

| Route                   | Body                         | Notes                                                                            |
| ----------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| `POST /signup`          | `email`, `password`          | Always `202` (no account enumeration). Confirmation link returns to `/callback`. |
| `POST /login`           | `email`, `password`          | `403 email_not_confirmed`, `401 invalid_credentials`, `409 provider_conflict`.   |
| `POST /logout`          |                              |                                                                                  |
| `GET /google`           |                              | Redirects to Google. First sign-in creates the account.                          |
| `GET /callback`         | `?code`                      | Redirects to `AUTH_REDIRECT_URL` (`?error=<code>` on failure).                   |
| `POST /forgot-password` | `email`                      | Emails an OTP code. Always `202`.                                                |
| `POST /reset-password`  | `email`, `token`, `password` | Only for password accounts; signs out other sessions.                            |

Mobile apps can send `Authorization: Bearer <access_token>` to protected routes (`requireAuth`).
Native Google sign-in done on the device bypasses these routes; the database trigger still blocks provider mixing.
