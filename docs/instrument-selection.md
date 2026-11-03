# Instrument selection and team roles

The three creation cards now choose only **notes / upload / recording**. A note editor can open without creating a server track. Its instrument tile opens the ZIP-style picker; tapping a sound previews a short sampled phrase, and **이 악기로 선택** explicitly commits the selection. Cancelling before confirmation leaves no empty track. Existing notes, effect data and draft history survive a tone change.

The picker groups the 24 sampled tones by musical instrument family and exposes category shortcuts. It loads current team assignments when opened and refreshes them after a rejected save. Families used by another non-rejected track are disabled, including DRAFT/PENDING assignments. The current track is excluded from this check.

| Family | Sounds/roles |
| --- | --- |
| Piano | Piano, electric piano |
| Acoustic guitar | Nylon, acoustic |
| Electric guitar | Clean, overdrive, distortion |
| Bass | Acoustic, finger, pick, slap, synth bass |
| Drums/percussion | Drum kit, recorded percussion |
| Strings | Violin, strings |
| Harp | Harp |
| Trumpet/brass | Trumpet, brass |
| Saxophone | Saxophone |
| Flute | Flute |
| Synthesizer | Lead, pad |
| Organ | Organ |
| Marimba | Marimba |
| Vocal | Lead vocal, backing vocal, rap |
| Other sound | Other recorded sound |

Acoustic and electric guitar are separate families. Changing only a tone within an occupied family cannot bypass the restriction. Legacy uppercase/Korean aliases resolve to the same families. Existing data is not automatically reassigned.

## Upload and recording

File: choose a file → preview/trim → **다음 · 악기/보컬 선택** → classify → **이 역할로 저장**. Recording: record/review → the same classification step → save. The selected original file or recording stays available when the picker is cancelled or saving fails. In this mode candidate taps replay the original selection; classification does not synthesize or transform the recorded sound.

Recorded vocals keep their actual role labels and are never presented as piano. Audio-only roles do not offer note creation. Existing audio layers have an **악기/보컬** action for reclassification. A mixed MIDI/audio layer keeps playable instrument choices. Recording saves with `sourceType: RECORDING`; uploaded files use `FILE_UPLOAD`.

The existing HTI action now asks which playable output sound to use after recording. The chosen sound is retained instead of always creating piano. Audio-only roles are excluded from HTI MIDI output. Microphone capture and the HTI transport otherwise retain the existing implementation.

An empty personal layer is reused on a retry after a failed upload/lost response, preserving the existing one-layer-per-user rule. Backend reservations remain authoritative even if another client chooses the same family during preview.

## Backend dependency

Deploy with backend `TEST` commit `c78abb73b4c60137d01b84ce23ba80cbde9da576` or a descendant containing these APIs (`refector/piano-roll-timing` has been merged into TEST):

- Track creation requires a known instrument/recorded role.
- `PATCH /api/v1/projects/{projectId}/tracks/{trackId}/instrument` changes the authenticated owner's editable track.
- Family conflict: HTTP 409 `INSTRUMENT_FAMILY_TAKEN`. Another owner's track, pending/rejected track or completed project: HTTP 403.
- Creation and changes share a project write lock, serializing competing family claims.
- Switching to drums cannot discard MIDI notes outside pitches 35–81. MIDI clips/working notes cannot be changed to audio-only roles. Saved clips and personal drafts are checked before mutation.
- Approved instrument changes invalidate rendered media and queue a refreshed published mix. No schema migration is needed.

## Actual local verification — 2026-10-29

The existing isolated TEST-derived backend/database was used, with separate verification projects 6/7 (shorts 906/907), rather than the user's original draft.

- Team piano disabled both piano and electric piano. Preview/cancel created no track; explicit confirmation created one acoustic guitar track.
- Added a three-note C chord and changed to clean electric guitar. All three pitches/ticks remained in the real private draft and undo remained available. Re-entering restored the selected instrument and draft.
- A conflicting family change returned 409; modifying another player's track returned 403. Simultaneous synth-lead/synth-pad claims by two authenticated users yielded exactly one 200 and one 409. Original test instruments were restored afterward.
- Actual native WAV selection, trim preview, picker cancellation/reopening, role selection and upload all passed. The selected file remained after cancel. Server stored a 3,000ms AUDIO clip tagged `vocal`; changing to `backing-vocal` retained the same clip. A teammate's `rap` claim was rejected as the same vocal family.
- 390×844 portrait and 844×390 landscape had no horizontal overflow; category navigation scrolls independently and the confirmation button remains visible. Temporary viewport overrides were reset.
- Frontend: 120 tests, TypeScript, lint and production build passed. Backend: 1,066 tests, zero failures/errors/skips.
- Physical microphone capture and live HTI conversion were not exercised. The shared role picker and actual uploaded-audio path were verified; HTI output-sound selection has unit coverage.

Runtime evidence remains under `/private/tmp/narackrock-studio-live.v3wxk7qq/parts-checks.json`. Runtime authentication data and test bootstrap pages are not included in product code. Frontend changes remain on `refector/piano-roll-studio`, pending a PR into dev. Backend changes have been merged and pushed to TEST at `c78abb73b4c60137d01b84ce23ba80cbde9da576`; the merged backend passed all 1,066 tests.

## PR verification — 2026-11-02

- Rechecked against current remote dev: no new base commits or whitespace errors.
- All 120 frontend tests passed; TypeScript, ESLint and production build passed again.
- Confirmed the remote backend TEST branch contains the required APIs at `c78abb73b4c60137d01b84ce23ba80cbde9da576`.
- The browser and API checks above were performed on 2026-10-29; physical microphone capture and live HTI conversion remain unverified.
