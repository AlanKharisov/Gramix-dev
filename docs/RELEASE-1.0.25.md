# 1.0.25 — Eaten, expenditure average and current difference

- Main and statistics circle: Eaten N kcal out of the existing calculated amount. Remove the second Remaining number for every account, including the ordinary-account branch.
- Show average daily expenditure directly below the circle, before macros. This is expenditure, not average food intake. Retain existing 7/30-day calculation, coverage and estimate labels. Missing health history displays a dash; never substitute a target or food average.
- Main status bar alone shows remaining-to / above the current calculated amount. Statistics retain no bar. Automatic midnight amounts continue changing as rest accrues and activity imports arrive. This is not a new weight-loss target or an instruction to exercise to earn food.
- Manual accounts retain their saved calorie goal; calculation algorithms and Health Connect permissions are unchanged.
- Existing average data comes from the Health Auto Export history available to the personal accounts. Local-only Android step snapshots are not promoted to complete historical daily expenditure; without imported eligible history the average stays unavailable.
- Verified: existing 26 unit tests, mocked web UI including zero intake, excess intake, hourly updates, visible average and collapsible connection; ordinary main/statistics regressions; Android release build and signing.
