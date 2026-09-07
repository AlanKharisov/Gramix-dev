# Personal Health Auto Export connection — 1.0.22

Only the two verified personal accounts can configure/read the integration. Profile → Apple Health · Health Auto Export → Connect creates a 256-bit random import-only key, displayed once. Only its SHA-256 hash is stored server-side. Create new key revokes the old key; Disconnect revokes and deletes imported history, not food. Key is sent in `X-API-Key`, never in the URL, and cannot access normal account APIs. Web authentication remains Firebase.

## iPhone setup

1. Open Gramix profile online and confirm version 1.0.22. Select Automatic, enable midnight accrual and Save. A manual activity selection disables accrual when saved.
2. Create connection. Copy URL and key from the profile, not from chat.
3. Health Auto Export → Automations → New Automation → REST API. Paste URL; add HTTP Header `X-API-Key` with the key.
4. Data type Health Metrics; select only Step Count, Active Energy, Basal Energy Burned. Authorize only these metrics in Apple Health.
5. JSON, Export Version 2, Summarize Data ON, Time Grouping Days, Batch Requests OFF. Units count and kcal (kJ is also accepted and converted).
6. Date Range Default (previous day and today). Enable automation; run Manual Export while unlocked. Return to Gramix → Check import. A connection is configured before first upload; Last import confirms receipt, not complete data coverage.
7. For averages, import previous 7 days with identical settings. Can import up to 32 days of daily totals. Restore Default afterwards. Do not send raw/hourly samples, separate-source totals, GPS, medical data or workouts; workout energy is already represented by Active Energy. Duplicated date/metric entries are rejected to prevent double counting.

Health Auto Export docs: https://help.healthyapps.dev/en/health-auto-export/automations/rest-api/ and https://help.healthyapps.dev/en/health-auto-export/export-format/health-metrics/ . iOS background execution is best-effort, not guaranteed hourly. If timezone changes, recreate the connection to save the new timezone and reconfigure its key. Current-day imported energy is not applied when browser and connection timezone differ.

## Calculation and limits

Current balance = estimated rest accrued since local midnight + latest imported active energy − logged food. Imported active energy replaces native step estimates; not added on top. If imported active energy is absent but steps exist, net walking is estimated using the existing formula. Import timestamps are shown; activity is not extrapolated between uploads. Rest remains a profile-based estimate, including sleep, not Health basal data extrapolated into future hours.

As of web 1.0.23, average = daily resting + active expenditure, without subtracting food. Missing basal energy falls back to the current profile's resting estimate; missing active energy falls back to the existing net-walking estimate only when steps exist. Estimated results are labeled. Uses the past 7 completed days; switches to 30 only with all 30 days available. Missing days and samples last imported before their day ended are excluded. Import and browser time zones must match. This is a reference estimate, not a food limit. The central current-day expenditure-minus-food balance is unchanged. Ordinary accounts are unchanged.

The endpoint accepts bounded 64 KiB JSON daily aggregates, validates dates/units/ranges, limits authenticated imports to one every five seconds, replaces repeated daily totals and keeps at most 33 days with scheduled cleanup. Unknown metrics are not stored. Health payloads and keys are not logged or sent to Telegram. Account deletion cleans up connections/history. Storage is Cloudflare D1; no new external analytics destination.

## Verification and rollout

Worker tests cover parser validation, duplicate/hourly rejection, key hashing/rotation/revocation, owner isolation, rate limits and replacement semantics. Browser tests cover imported active energy, expenditure average, connection setup UI, midnight accrual, opt-out and ordinary-user regressions. Migration 0005 applied remotely; Worker deployed before website. Real step-only imports were confirmed for September 1–7; active and resting energy receipt remains unverified. Synthetic tests are not proof of device synchronization.
