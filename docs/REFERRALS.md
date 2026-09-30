# Fointer referrals

Invite-link growth system: unlimited invites, qualify on email verify, badge + notify (no cash).

## Product rules

- Every member gets a unique `referralCode` and invite URL: `https://fointer.net/signup?ref=CODE`
- First-touch `ref` is stored in the browser (localStorage + cookie, 14 days)
- Signup also has an **optional Referral code** field (manual entry); link auto-fills it
- Signup / Google / Facebook send `referralCode` when present
- Referral stays **pending** until email OTP verify succeeds, then **qualified**
- Unlimited qualified referrals (no monthly cap)
- Reward v1: in-app notification + **Inviter** / **Community Builder** achievements
- Community invites remain a separate feature

## Backend

| Piece | Path |
|---|---|
| Model | `Fointer-backend/models/referral.js` |
| Service | `Fointer-backend/services/referral.service.js` |
| API | `GET /api/referrals/me`, `GET /api/referrals/me/link` |
| User fields | `referralCode`, `referredBy` |
| Hooks | `auth.controller` signup, Google, Facebook, `verifyEmailOtp` |
| Notify type | `referral_qualified` |

### Indexes (scale)

- Unique `referee` on Referral (one attribution per new account)
- `{ referrer, status, createdAt }` for dashboards
- Partial unique `User.referralCode`

### Idempotency

- `qualifyReferralForUser` uses `findOneAndUpdate` pending → qualified
- Notify stamped once via `notifiedAt`

## Frontend

- Capture: `shared/lib/referralCapture.js` on `/signup` and `/login`
- Profile → **Invite friends** card (`InviteFriendsCard`)
- Social auth passes stored code

## Account delete

- Pending referrals for the deleted referee are removed
- Qualified history for referrers is kept (referee may render as deleted)
- `referredBy` pointers to the deleted user are cleared

## Manual test

1. User A opens Profile → copy invite link
2. Incognito: open link → signup → verify OTP
3. User A gets notification + Inviter badge; stats show +1
4. Google/Facebook new user with `?ref=` also qualifies after OTP
