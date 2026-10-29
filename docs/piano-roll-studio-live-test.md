# Piano roll: actual TEST backend integration

Verified locally on 2026-10-29. Frontend: `refector/piano-roll-studio`. Backend: `TEST`, commit `580c152c755bf8d07b40eb4362f24aa31879097c` (matched origin/TEST). Backend sources were not modified. This run used real HTTP APIs, database writes, media storage and sampled playback, rather than the earlier browser fixture.

## Isolated runtime

- Frontend: `http://localhost:5173`, with `NARACKROCK_API_PROXY_TARGET=http://127.0.0.1:8081` and an empty `NEXT_PUBLIC_API_BASE_URL`.
- Backend: `127.0.0.1:8081`, Java 21, Gradle `bootRun`, `local-test` profile, empty `spring.config.import`.
- H2 database: `/private/tmp/narackrock-studio-live.v3wxk7qq/database`, MySQL compatibility mode, lower-case identifiers.
- Redis: Docker container `narackrock-studio-test-redis`, loopback port 16390. Local storage: `/private/tmp/narackrock-studio-live.v3wxk7qq/uploads`.
- Public media/API base: `http://localhost:8081`; short/post links use `http://localhost:5173`.
- Backend's existing local-test users 1 and 2 were used as participant and owner. The temporary browser authentication page was removed from the product tree after testing. No test credentials or runtime data are committed.
- Local JSON assertions and scripts remain under the temporary runtime directory. They contain local test session data and should not be published wholesale.

## Verified results

| Area | Evidence/result |
| --- | --- |
| Editing | Real UI chord insertion, drawing and length adjustment, group move/resize, deletion, copy/paste/duplicate and undo/redo; server pitch/tick/duration values matched the edited notes. |
| Paste collision | Paste advanced the whole copied group to the next non-overlapping interval. Existing notes were preserved. |
| Autosave and reload | Private server draft restored after full page reload; no committed clip existed before explicit Save. A different user could not list/read the private draft (direct UUID returned 404). |
| Outage recovery | Stopped this isolated backend, edited while offline, refreshed, restarted the same database and recovered all 13 notes. Explicit commit retained all 13. |
| Discard | Added temporary notes and discarded the draft; the previously committed 13-note clip remained intact. |
| Ownership | Original participant's MIDI remained readable with mutation controls disabled; four original notes remained unchanged. |
| Submission | Submitted a four-note Am7 layer through the UI; real contribution became PENDING with track and clip items. |
| Approval | Original owner received the real notification and approved via API; track and clip became APPROVED and pending notification cleared. Resulting exported mix loaded as an actual audio element (readyState 4, no media error). |
| Media | Actual upload-session creation, WAV PUT, completion, AUDIO clip creation and media fetch succeeded. Media allowed localhost:5173 through CORS. |
| Playback | Sampled piano, sampled drum kit, and mixed MIDI + WAV played without displayed playback errors. Master volume remained connected. |
| Basic drums | Exactly 11 keys and 11 SVG icons, no text inside the left keys. Existing kick remained pitch 36. Arrow-up moved it to snare 38 and the real server autosaved 38; undo restored 36. |
| Legacy percussion | Expanded kit showed all 47 pitches. Added clap 39, collapsed to basic: hidden-note count appeared and real server draft still contained pitches 36 and 39. Undo and Save restored the original kick-only clip. |
| Portrait/landscape | Actual app checked at 390×844 and 844×390: document scroll width equaled viewport width, all 11 icons and existing kick were retained. Portrait kit height/content both 352px, so the last row was not clipped. Temporary viewport overrides were reset. |
| Playback cursor | Removed a later global CSS rule that re-enabled an independent 8-second animation. Real composed playback with a 3-second WAV stopped within that content interval and returned to 00:00/left 120px; computed animation and transform were both none. MIDI timeline ends now use entered note duration, without extending the bar for drum sample tails. |

## Checks

- `npm test`: 111 tests passed (including six new basic-drum cases and the mixed-content playback end regression).
- `npx tsc --noEmit --incremental false`: passed.
- `npm run lint`: passed.
- `npm run build`: passed.
- Backend source unchanged; this report does not claim a new backend unit-test run.

## Limits

Native WAV file selection, trim preview and role-confirmed upload were verified in the instrument-selection follow-up; see [instrument selection](instrument-selection.md). HTI's local service (port 8000) was unavailable, so live HTI conversion was not tested. Physical microphone recording, real multi-touch gestures and hardware rotation were not tested. These are not claims of end-to-end coverage for those paths.

The actual local servers remain available for inspection while their processes are running. Test data is isolated from the normal development database. This feature branch has not been merged into `dev`.


## Shared BPM and time-signature follow-up

Backend `refector/piano-roll-timing` is based on `TEST`; frontend remains `refector/piano-roll-studio`. The local backend was restarted from that isolated worktree against the same local database. This adds a backend dependency: `PATCH /api/v1/projects/{projectId}/timing` must be deployed with the UI.

- Original owner only; other users received HTTP 403. Missing/out-of-range timing inputs received HTTP 400.
- Real owner test song: project 5 / short 905, created separately from the user's existing draft.
- Duplicated four notes to eight, changed 120 → 90 BPM and 4/4 → 3/4: all eight private-draft MIDI pitches and ticks persisted unchanged. Ruler showed 1,2,3 for each bar. Undo still restored four notes.
- Changed to 6/8: ruler showed 1 through 6 per bar. Full reload restored 90 BPM, 6/8 and the existing draft.
- Created an isolated second participant's long private draft, then attempted 60 BPM from the UI: server rejected the change before mutation and UI displayed the one-minute-limit reason. The project remained 90 BPM; the temporary boundary draft was then discarded.
- The published mix regenerated through the real export queue: `/files/exports/5/7/mix.wav` measured approximately 2.666 seconds, matching four quarter notes at 90 BPM. Sampled editor playback also stopped and reset at its new end.
- 390px portrait and 844px landscape were checked for overflow. Viewport overrides were reset.
- Frontend: 115 tests, TypeScript, lint and build passed. Backend: 1,059 tests, zero failures/errors/skips. Six new backend tests cover original-owner access, invalid/completed changes, timing/metadata preservation, clip/draft bounds, no-op version handling and published mix refresh.


## Instrument-selection follow-up

See [instrument selection and team roles](instrument-selection.md) for the current preview/confirm flow, real upload verification, simultaneous family reservation check, and final frontend/backend test counts.
