# Gramix 1.0.24

The two existing personal accounts now see eaten calories in the circle and the current expenditure as the denominator. The main-page bar shows the absolute difference, with separate labels for food exceeding expenditure and expenditure exceeding food. It is not an instruction to exercise to earn food. Expenditure averages remain in details, not the bar. Ordinary accounts retain their daily-goal interface. Statistics retain no status bar.

## Connected activity

- Web: existing Health Auto Export daily `active_energy` includes cycling and other exercise **only when the recording app writes active energy to Apple Health**. Continue exporting Health Metrics / Active Energy in JSON v2 / Days. A separate workout export is neither required nor consumed. Do not add workout calories to the daily active total. If there is no active energy, steps estimate walking only; the UI explains that limitation.
- Android: in the existing personal automatic midnight mode, request `READ_ACTIVE_CALORIES_BURNED` alongside `READ_STEPS` via the expandable connection panel. Existing users must grant the additional permission using Allow workout calories. Health Connect's daily active aggregate is used even with zero or unavailable steps. No exercise routes, GPS, pulse, workout names or raw sessions are collected. This does not record a bicycle ride itself; a connected source must write its active energy.
- Native daily active energy takes precedence over imported daily active energy; either replaces walking estimates. Missing/revoked/stale readings do not become measured zero. Zero is accepted when explicitly supplied by the service.
- Both connection panels are collapsible without disconnecting or deleting data. Explicit disconnect controls remain separate.
- Automatic mode and midnight accrual scope remain the two verified personal emails. No new weight-loss deficit is introduced by this release.

## Verification

26 web unit tests; mocked mobile-viewport UI tests for web import, native cycling energy with zero steps, and ordinary-user regressions; Android release compilation and existing native unit tests. Real bike-workout synchronization requires a device/source recording and has not been verified with a real ride. The native bridge reads daily active calories; a health session containing only distance or duration cannot supply calorie expenditure.

References: https://developer.android.com/health-and-fitness/health-connect/aggregate-data and https://help.healthyapps.dev/en/health-auto-export/export-format/health-metrics/
