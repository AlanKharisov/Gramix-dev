# 1.0.21 — personal accrued-energy balance

Enabled by default only for the two verified accounts in `isPersonalBudget`. Other users retain the existing daily budget. The profile's `personalAccrualEnabled` opt-out is saved to the authenticated user's document; no migration or server deployment is necessary. A missing field means enabled for these two accounts only.

## Formula

Resting energy estimate (kcal per 24 hours): `10 × weight_kg + 6.25 × height_cm − 5 × age_years + sex_constant`, where the existing profile's male/female constants are +5/−161. Source: Mifflin et al., 1990, https://pubmed.ncbi.nlm.nih.gov/2305711/ . This is a population-based resting estimate, not measured metabolism or a precise sleeping expenditure model.

Accrued rest = estimate × actual elapsed hours since local midnight / 24. Balance = accrued rest + estimated net walking energy − food recorded today. Walking uses the existing net level-walking estimate; do not add the activity multiplier, preset ordinary-step allowance, exercise calories, or weight-goal adjustments again. Without current valid step data, movement is zero and the details disclose that only rest is included. No Apple Health integration is claimed.

The screen recomputes every minute while visible and on foreground/focus. Reopening computes elapsed time directly, without requiring a background timer. Repeated refresh never adds the same expenditure twice. The balance resets at local midnight; actual elapsed time handles 23/25-hour DST days. A timezone/profile change recalculates the estimate under the current local day/profile. There is no sleep detection or fabricated sleep adjustment.

Auto applies to Main and today's daily Statistics view. Historical periods retain the existing daily-goal statistics; no past metabolic or step history is fabricated. Food averages remain informational (7 days, or 30 when all thirty days have records).

## UX and safety

- Profile: `Auto · since midnight` toggle is available on web and Android for the two personal accounts.
- Negative signed values are labelled “Current balance”, without “earn/burn off/wait to eat” messaging or warning animation.
- Ring progress represents accrued resting expenditure relative to the 24-hour estimate in auto mode, not an eating target.
- Details explain the estimate and show accrued rest, movement, food and resting energy per day.
- Missing/invalid adult profile data falls back to the daily goal. Validity bounds: age 18–100, weight 30–300 kg, height 120–230 cm and a supported sex field. These checks do not establish medical suitability.
- No clinical energy minimum or diet recommendation is inferred from the balance. It is not a full TDEE estimate: e.g. unmeasured activity and food thermogenesis are not modeled.

## Verification

Pure tests cover sex-specific resting estimates, invalid inputs, midnight reset, repeated refresh, sleep hours, net step credit, stale readings, account isolation, opt-out and Europe/Madrid DST transitions. Mocked browser tests cover one elapsed hour, both Android-data and web-without-health cases, persisted opt-out and fallback to the daily budget. Ordinary-user UI regression tests remain passing. iPhone health access and real walking measurement remain untested/unconnected.
