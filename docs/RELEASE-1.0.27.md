# 1.0.27 — memory and transient network reliability

- Bound opened-photo state to eight entries / 2 MiB. Release offscreen thumbnails and reload on return.
- Retry transient network failures once for GET/HEAD only, respecting cancellation, offline and background state. Never replay writes or AI requests.
- Preserve safe Health/feedback endpoint names and online/visibility context in incident reports. Android exit reports now include process importance and sampled memory; low-memory OS termination is not labelled as a proven foreground crash.
- No changes to calorie calculations or page layout.

Verification: 29 web unit tests, 13 backend tests, production web/native builds, Android unit tests and a 100-thumbnail scroll/reload browser test. Android version code: 50.

The supplied historical reports lacked endpoint and memory context, so their exact causes cannot be established retrospectively. Android 1.0.13 requires updating; OS-wide memory pressure and loss of connectivity cannot be eliminated by an app update.
