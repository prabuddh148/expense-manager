# Expense Manager

A mobile expense manager and salary planner: a React Native (Expo SDK 57) app in TypeScript
backed by a Java Spring Boot REST API on PostgreSQL.

Salary is the parent balance for a month. Categories carve budgets out of it, expenses draw
both down, and EMI payments deduct from the same month, so every screen agrees on what is
actually left.

---

## Features

**Money**
- Monthly salary with an optional target salary, target date and progress
- Category budgets with spent / remaining / overspend tracking
- Expenses against a category, or one-off expenses under **Other** with a required name
- Full history: search, category filter, date range, sort, pagination, edit, delete
- Loans with append-only EMI payment history; balance always derived from payments
- Weekly / monthly / custom-range analytics
- Salary planner: split a salary into sections and export as image or PDF

**Mobile**
- Bottom tabs plus stack navigation, modal sheets, FAB, pull-to-refresh
- Light / dark / system theme with an in-app switch
- Native date and time pickers
- Loading, empty, error and offline states everywhere
- Toasts and confirmation dialogs before anything destructive
- Cached dashboard, categories and loans so the app still renders offline

**Platform**
- JWT access tokens with rotating refresh tokens, stored in the device keystore
- Automatic token refresh with a single shared in-flight refresh and request retry
- Google Sign-In through expo-auth-session, verified server-side
- BigDecimal money maths end to end - no floating point anywhere in the money path

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Mobile | React Native 0.86, Expo SDK 57, TypeScript, React Navigation 7 |
| Charts | react-native-svg (hand-built donut, line and bar charts) |
| Storage | expo-secure-store (tokens), AsyncStorage (theme + display cache) |
| Networking | axios with request/response interceptors |
| Export | expo-print, react-native-view-shot, expo-sharing, expo-file-system |
| Backend | Java 25, Spring Boot 3.5, Spring Security, Spring Data JPA |
| Auth | jjwt (HS256), BCrypt, opaque rotating refresh tokens, Google API client |
| Database | PostgreSQL 14+ (H2 in PostgreSQL mode for tests) |
| Tests | JUnit 5, MockMvc, AssertJ, Spring Security Test |

---

## Architecture

```
React Native app (Expo)
  screens -> hooks -> api/services -> axios client
                                        |  Authorization: Bearer <jwt>
                                        v
Spring Boot API
  controller -> service -> repository -> PostgreSQL
       |            |
      DTO      BigDecimal maths, per-user scoping
```

Entities never leave the controllers; every response is a DTO. Every service resolves the
caller through `CurrentUser` and filters by user id, so one account can never read another's
rows - covered by tests.

---

## Folder structure

```
expense-manager/
├── backend/
│   └── src/main/java/com/expensemanager/
│       ├── config/        SecurityConfig, CORS
│       ├── controller/    REST endpoints
│       ├── service/       business rules and calculations
│       ├── repository/    Spring Data JPA + specifications
│       ├── entity/        JPA entities
│       ├── dto/           request/response records
│       ├── mapper/        entity -> DTO
│       ├── security/      JWT, filters, Google verification, CurrentUser
│       ├── exception/     ApiException hierarchy + global handler
│       └── util/          Money, DateRanges
│
├── frontend/
│   ├── App.tsx            provider stack
│   └── src/
│       ├── api/           axios client, token storage, service modules
│       ├── components/    Screen, Card, Button, fields, charts, states
│       ├── constants/     env-driven config
│       ├── hooks/         useAsyncData, useSubmit, useGoogleSignIn
│       ├── navigation/    root / auth / app stacks and tabs
│       ├── screens/       auth + main screens
│       ├── store/         auth, network, toast contexts
│       ├── theme/         palettes, tokens, ThemeProvider
│       ├── types/         API types
│       └── utils/         formatting, dates, planner export
│
└── README.md
```

---

## Database schema

| Table | Key columns | Notes |
| --- | --- | --- |
| `users` | id, name, email (unique), password_hash, google_id, provider | Google-only accounts have no password hash |
| `refresh_tokens` | id, token (unique), user_id, expiry_date, revoked | Rotated on every refresh |
| `salaries` | id, user_id, amount, target_amount, target_date, period_year, period_month | Unique per user per month |
| `categories` | id, user_id, name, allocated_amount, color, icon | Unique name per user |
| `expenses` | id, user_id, category_id (nullable), amount, expense_name, description, expense_date, expense_time | Null category means **Other** |
| `loans` | id, user_id, name, original_amount, remaining_amount, monthly_emi, interest_rate, start_date, end_date, status | Status closes automatically at zero |
| `emi_payments` | id, loan_id, amount, payment_date, description | Append-only |
| `salary_planners` | id, user_id, name, total_salary | |
| `salary_planner_items` | id, planner_id, name, amount, percentage, color, position | Percentage recomputed on every write |

Relationships: `users` 1-N everything; `loans` 1-N `emi_payments`; `salary_planners` 1-N
`salary_planner_items` (cascade + orphan removal). Deleting a category does **not** delete its
expenses - they fall back to Other carrying the old category name, so history and totals
never change silently.

All money columns are `NUMERIC(15,2)` and handled as `BigDecimal` in Java.

---

## API

All endpoints except `/api/auth/**` and `/api/health` require
`Authorization: Bearer <accessToken>`.

### Auth
| Method | Path | Body / query |
| --- | --- | --- |
| POST | `/api/auth/signup` | `{ name, email, password }` (min 8 chars) |
| POST | `/api/auth/login` | `{ email, password }` |
| POST | `/api/auth/google` | `{ idToken }` |
| POST | `/api/auth/refresh` | `{ refreshToken }` - rotates the pair |
| POST | `/api/auth/logout` | `{ refreshToken }` |
| GET | `/api/auth/me` | - |

### Salary
| Method | Path | Body / query |
| --- | --- | --- |
| GET | `/api/salary` | `?year&month` (defaults to now) |
| GET | `/api/salary/history` | - |
| POST | `/api/salary` | `{ amount, targetAmount?, targetDate?, year?, month? }` - upsert |
| PUT | `/api/salary/{id}` | same body |

### Categories
| Method | Path | Body / query |
| --- | --- | --- |
| GET | `/api/categories` | `?year&month` scopes the spent figures |
| GET | `/api/categories/{id}` | - |
| POST | `/api/categories` | `{ name, allocatedAmount, color?, icon? }` |
| PUT | `/api/categories/{id}` | same body |
| DELETE | `/api/categories/{id}` | - |

### Expenses
| Method | Path | Body / query |
| --- | --- | --- |
| GET | `/api/expenses` | `?search&categoryId&from&to&minAmount&maxAmount&page&size&sortBy&direction` |
| GET | `/api/expenses/{id}` | - |
| POST | `/api/expenses` | `{ amount, categoryId?, expenseName?, description?, date?, time? }` |
| PUT | `/api/expenses/{id}` | same body |
| DELETE | `/api/expenses/{id}` | - |

`categoryId=0` is the agreed shorthand for filtering to **Other**. Omitting `categoryId` in a
create body means Other, and then `expenseName` is mandatory.

### Loans & EMI
| Method | Path |
| --- | --- |
| GET / POST | `/api/loans` |
| GET / PUT / DELETE | `/api/loans/{id}` |
| GET / POST | `/api/loans/{loanId}/payments` |
| PUT / DELETE | `/api/loans/{loanId}/payments/{paymentId}` |

A payment larger than the outstanding balance is rejected with 400. Editing or deleting a
payment re-derives the balance from the remaining rows.

### Analytics & dashboard
| Method | Path | Query |
| --- | --- | --- |
| GET | `/api/analytics` | `period` = `this_week`, `last_week`, `this_month`, `last_month`, `this_year`, `custom` (+ `from`, `to`) |
| GET | `/api/analytics/weekly` | `period` |
| GET | `/api/analytics/monthly` | `period` |
| GET | `/api/analytics/category` | `period`, `from`, `to` |
| GET | `/api/dashboard` | `year`, `month` |

### Salary planner
| Method | Path |
| --- | --- |
| GET / POST | `/api/salary-planner` |
| GET / PUT / DELETE | `/api/salary-planner/{id}` |
| POST | `/api/salary-planner/{id}/items` |
| PUT / DELETE | `/api/salary-planner/{id}/items/{itemId}` |

### Errors

```json
{
  "timestamp": "2026-09-06T11:04:22Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Validation failed",
  "path": "/api/expenses",
  "fieldErrors": { "amount": "must be greater than zero" }
}
```

---

## Environment variables

### Backend (`backend/.env`, never committed)

| Variable | Purpose |
| --- | --- |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` | Local PostgreSQL (dev profile) |
| `DB_URL` | Full JDBC URL (prod profile) |
| `JWT_SECRET` | HS256 signing key, **32+ bytes**. The app refuses to start without it |
| `JWT_ACCESS_EXPIRATION_MS` | Default 900000 (15 min) |
| `JWT_REFRESH_EXPIRATION_MS` | Default 604800000 (7 days) |
| `GOOGLE_CLIENT_IDS` | Comma-separated accepted OAuth client IDs |
| `CORS_ALLOWED_ORIGINS` | Comma-separated origins, or `*` |

```bash
# generate a signing key
openssl rand -base64 48
```

### Mobile (`frontend/.env`)

Only `EXPO_PUBLIC_`-prefixed variables reach the app, and they are **visible in the bundle** -
never put a secret there.

| Variable | Purpose |
| --- | --- |
| `EXPO_PUBLIC_API_URL` | API base URL |
| `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` | Android OAuth client ID |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | iOS OAuth client ID |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Web OAuth client ID |

Both folders ship a `.env.example` - copy it to `.env` and fill it in.

---

## Running locally

### 1. PostgreSQL

```bash
createdb expense_manager
# or: docker run --name em-postgres -e POSTGRES_PASSWORD=postgres \
#       -e POSTGRES_DB=expense_manager -p 5432:5432 -d postgres:16
```

Schema is created by Hibernate (`ddl-auto=update`) on first start.

### 2. Backend

Requires JDK 25+. Maven is not needed - the wrapper downloads it.

```powershell
cd backend
copy .env.example .env      # then edit it
.\mvnw.cmd spring-boot:run
```

`backend/.env` is loaded automatically (spring-dotenv), so no shell exports are needed.
Real environment variables still take precedence, which is what production uses.

macOS / Linux: `./mvnw spring-boot:run`. The API listens on `http://localhost:8080`; change it
with `PORT`. Check it is up: `curl http://localhost:8080/api/health`.

### 3. Mobile

```powershell
cd frontend
npm install
copy .env.example .env
npx expo start -c
```

| Target | `EXPO_PUBLIC_API_URL` |
| --- | --- |
| Android emulator | `http://10.0.2.2:8080/api` (the default) |
| iOS simulator | `http://localhost:8080/api` |
| Physical device | `http://<your-lan-ip>:8080/api` |

A physical device must be on the same Wi-Fi, and Windows Firewall has to allow inbound 8080.

> **Expo Go is not enough.** The app uses native modules (`expo-secure-store`,
> `@react-native-community/datetimepicker`, `react-native-view-shot`), so you need a
> development build - see below. If Metro reports a module it cannot resolve after installing
> packages, restart it with `npx expo start -c` to clear the cache.

---

## Expo SDK 57 notes

Every dependency was installed through `npx expo install`, which pins the version that matches
SDK 57 rather than the newest release. Verify at any time:

```bash
npx expo install --check
```

Two SDK 57 details worth knowing:

- **expo-file-system** uses the new `File` / `Paths` API. `FileSystem.cacheDirectory` and
  `copyAsync` are gone; see `src/utils/plannerExport.ts` for the current shape.
- Charts are hand-built on `react-native-svg` instead of a chart library, which avoids
  depending on a package tracking React Native 0.86 support.

---

## Android setup

`app.json` already sets:

- package `io.theforgelabs.expensemanager`
- `versionCode` 1, portrait, edge-to-edge
- `userInterfaceStyle: automatic` so the OS theme feeds the in-app theme switch
- scheme `expensemanager` for the Google OAuth redirect
- permissions `INTERNET`, `ACCESS_NETWORK_STATE`

Add your own icon and splash images to `frontend/assets/` and point `icon`,
`android.adaptiveIcon.foregroundImage` and `splash.image` at them.

### Development build, APK and AAB

```bash
npm install -g eas-cli
eas login
eas init                      # writes a real projectId into app.json

# development client (debuggable, hot reload)
eas build --profile development --platform android

# installable APK for testing
eas build --profile preview --platform android

# Play Store bundle
eas build --profile production --platform android
```

`eas.json` defines all three profiles; `preview` and `production` build an APK and an AAB
respectively. Set the production `EXPO_PUBLIC_API_URL` in `eas.json` before building.

Local build without EAS servers, if you have Android Studio installed:

```bash
npx expo prebuild --platform android
cd android && ./gradlew assembleRelease    # APK
cd android && ./gradlew bundleRelease      # AAB
```

## iOS setup

```bash
eas build --profile development --platform ios
```

Bundle identifier `io.theforgelabs.expensemanager` is set in `app.json`. A paid Apple
Developer account is needed for device builds; the simulator works without one.

---

## Google OAuth setup

1. Google Cloud Console → **APIs & Services → Credentials**.
2. Configure the OAuth consent screen (External, add yourself as a test user).
3. Create three OAuth client IDs:
   - **Android** - package `io.theforgelabs.expensemanager` plus the SHA-1 from
     `eas credentials` (or `keytool -list -v -keystore ~/.android/debug.keystore`)
   - **iOS** - bundle id `io.theforgelabs.expensemanager`
   - **Web** - used by Expo's auth proxy during development
4. Put the three IDs in `frontend/.env`.
5. Put the same IDs, comma-separated, in the backend's `GOOGLE_CLIENT_IDS`.

The app never sends a Google access token to the backend - it sends the **ID token**, and the
server verifies its signature, issuer and audience against Google's public keys before
creating or linking the account. Until `GOOGLE_CLIENT_IDS` is set the endpoint returns 503 and
the app hides the Google button.

---

## Testing

```bash
cd backend
./mvnw test
```

44 tests, all green. They boot the whole application against in-memory H2 in PostgreSQL mode
and drive it through MockMvc and the real security filter chain - no mocked principals.

| Suite | Covers |
| --- | --- |
| `MoneyTest` | Scaling, rounding, percentages, zero-divisor guards |
| `DateRangesTest` | Week/month boundaries, custom-range validation |
| `AuthControllerTest` | Signup, duplicate email, weak password, login, `/me`, refresh rotation, refresh-token replay, logout, Google unconfigured |
| `ExpenseFlowTest` | Seeded categories, salary and category balances after an expense, Other requiring a name, edit/delete recalculation, search + filter + paging, category delete keeping expenses, per-user isolation |
| `LoanFlowTest` | Instalments reducing the balance, auto-close, overpayment rejection, editing and deleting a payment, dashboard rollup, per-user isolation |
| `SalaryPlannerTest` | Percentage derivation, under- and over-allocation, item lifecycle, update replacing sections, per-user isolation |
| `AnalyticsTest` | Monthly totals and category split, custom range validation, empty dashboard, budget rollups |

The worked examples from the brief are encoded as tests: 45,000 salary minus a 500 petrol
expense leaves 44,500 overall and 3,000 in that category; a 60,000 bike loan paid in
15,000 instalments reports 45,000 remaining after the first.

### Frontend checks

```bash
cd frontend
npx tsc --noEmit                 # type check, clean
npx expo export --platform android   # verifies the bundle builds
```

Manual pass worth doing on a device: navigation and the auth guard, signup/login/logout,
token refresh (drop `JWT_ACCESS_EXPIRATION_MS` to ~30s and idle), dashboard, categories,
expense create/edit/delete, history filters, EMI payments, analytics ranges, planner
image and PDF export, dark mode switch, and airplane mode for the offline states.

---

## Deployment

### Database - free tier

[Neon](https://neon.tech) or [Supabase](https://supabase.com). Take the JDBC URL and set:

```
DB_URL=jdbc:postgresql://<host>/<db>?sslmode=require
DB_USERNAME=<user>
DB_PASSWORD=<password>
```

### Backend - Render / Railway / Fly.io

```bash
cd backend
./mvnw clean package            # target/expense-manager-api-0.0.1-SNAPSHOT.jar
```

Render web service settings:

- Build: `./mvnw clean package -DskipTests`
- Start: `java -Dserver.port=$PORT -jar target/expense-manager-api-0.0.1-SNAPSHOT.jar`
- Environment: `SPRING_PROFILES_ACTIVE=prod`, `DB_URL`, `DB_USERNAME`, `DB_PASSWORD`,
  `JWT_SECRET`, `GOOGLE_CLIENT_IDS`, `CORS_ALLOWED_ORIGINS`

The prod profile caps the Hikari pool at 5 connections, which free Postgres tiers require.
Free instances sleep when idle, so the first request after a pause is slow - the app shows a
retry state rather than failing.

### Mobile

Point `EXPO_PUBLIC_API_URL` in the `preview` and `production` profiles of `eas.json` at the
deployed HTTPS URL, then build. Android blocks cleartext HTTP in release builds, so the
production API must be HTTPS.

### Secrets

`.env` files are gitignored and only `.env.example` is committed. No secret is ever placed in
an `EXPO_PUBLIC_` variable, because those are readable in the shipped bundle.

---

## Security notes

- Passwords hashed with BCrypt; login failures return a deliberately vague 401 so the endpoint
  cannot be used to enumerate accounts
- Access tokens are short-lived JWTs; refresh tokens are opaque random strings kept in the
  database and **rotated on every use**. Replaying a consumed refresh token revokes the whole
  family for that user, on the assumption it was stolen
- Tokens live in the platform keystore via expo-secure-store, never AsyncStorage
- Stateless sessions, CSRF disabled deliberately (bearer tokens, no cookies)
- Every service scopes its queries by the authenticated user id; cross-user access is tested
- Money is `BigDecimal` with `HALF_UP` at 2dp from the database through to the JSON response

---

## Development phases

Built and verified in order: backend foundation and auth → salary and target → categories →
expenses → dashboard → EMI and loans → analytics → salary planner → image and PDF export →
security, tests and deployment configuration. Each phase compiled, tested and left the earlier
ones passing.

---

## Troubleshooting

**"Cannot reach the server. Check your internet connection."**

That message comes from the app whenever a request gets no HTTP response at all. Work down
this list:

1. **Is the backend actually up?**
   `curl http://localhost:8080/api/health` should return `{"status":"UP",...}`.
   A 404 saying *No static resource api/health* means an **old build is still running** - stop
   it and restart, otherwise you are talking to stale code on port 8080.
2. **Is PostgreSQL running?** The backend will not start without it.
   `Get-Service postgresql*` should say Running.
3. **Is the app pointing at the right host?** `EXPO_PUBLIC_API_URL` in `frontend/.env`:
   `10.0.2.2` for the Android emulator, `localhost` for the iOS simulator, and this machine's
   LAN IP for a physical device. Restart Metro after editing it - env vars are inlined at
   bundle time, so a hot reload will not pick up the change.
4. **Physical device:** it must be on the same Wi-Fi, and Windows Firewall has to allow
   inbound 8080 for `java.exe`. Test from the phone's browser first:
   `http://<lan-ip>:8080/api/health`.
5. **Release builds must use HTTPS** - Android blocks cleartext HTTP outside development.

**"Client Id property `androidClientId` must be defined"** - no Google OAuth client IDs are
configured. The Google button hides itself when they are absent; if you see this error, the
env vars are partially set. Either fill in all of `EXPO_PUBLIC_GOOGLE_*` or leave them all
blank.

**Metro cannot resolve a module that clearly exists** - stale bundler cache after installing
packages. `npx expo start -c`.
