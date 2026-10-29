# Piano roll studio

The supplied `piano-roll-studio.zip` provides the editor's visual design and interaction model. The production screen remains connected to the existing composition APIs and personal draft sessions.

## Interaction

- Portrait is the default on desktop and mobile. The desktop editor is centered at up to 640px wide; smaller screens use the available width. Turning a phone/tablet to landscape uses a wider, compact layout. CSS handles orientation changes, so notes, draft history, selection, zoom and playback state are not remounted. No CSS rotation is applied.
- Draw: click to add a note at the selected 1/4, 1/8 or 1/16 snap; drag to choose its length.
- Select: tap individual notes to toggle selection, or drag an empty area to select a rectangle. Shift-drag adds to the selection.
- Drag a selected note to move the group. Drag its right edge to resize the group. Blank-area dragging selects notes. Use the visible horizontal scrollbar or horizontal/Shift-wheel scrolling to move through the timeline. On touch devices, two fingers pan both the timeline and pitch rows. The keyboard area also retains native vertical scrolling.
- Copy, paste at the playhead, duplicate after the selected group, delete, undo and redo are available from buttons and the ZIP's shortcuts. Arrow keys move notes; Shift+arrows do not resize them.
- Group edits are atomic. A same-pitch time overlap rejects a move/resize. Pasting searches forward for the first non-overlapping placement for the whole copied group; if no later placement fits, existing notes are left untouched. MIDI velocity/effect data and relative timing/pitch intervals are preserved.
- Each gesture creates one undo step and updates the existing draft session on completion. Cancelling a pointer gesture leaves the saved notes unchanged. History resets when the draft session changes.

## Existing behavior retained

- Personal browser recovery, server autosave, retry/conflict recovery, discard, explicit commit and contribution submission use the existing draft implementation.
- The piano editor spans MIDI pitches 0–127. Drum layers default to 11 icon rows: two crashes, ride bell/bow, three toms, open/closed hi-hat, snare and kick. Their GM pitches remain 49/57/53/51/50/47/41/46/42/38/36. The optional full kit exposes all pitches 35–81; collapsing it preserves other notes and displays their count. Selection only includes visible kit rows, and vertical movement follows those rows rather than hidden semitones. Owner/status permissions protect mutations.
- The 24-instrument catalog and sampled playback remain in use. The current-instrument tile now opens a grouped preview/confirm picker with team-family reservations; audio creation classifies the recorded role after preview. See [instrument selection](instrument-selection.md). Keyboard and note previews use those same samples, not the ZIP's synthesized oscillator voices.
- Playback stops at the last entered note release or audio clip end and returns to zero. Timeline cursor positions follow the audio clock without a separate CSS animation. Playback covers the current clip, independent of the 1/2/4-bar editing window, preserves held-note durations and respects a clip's project offset.
- The existing chord picker writes through the same draft/history path. Its octave and chord-length settings remain available in the picker.
- The original owner can change the shared project tempo (30–300 BPM) and time signature; other participants see read-only values. Bar boundaries, ruler beats, bar navigation and playback use those settings. Note snap values remain musical note lengths (1/4, 1/8, 1/16). Timing changes flush the current draft first and preserve MIDI ticks and undo history. A change that would exceed the one-minute limit for existing clips or any participant's active draft is rejected. Audio recordings retain their duration in seconds. Published projects automatically queue a refreshed mix. Owners can reopen their published, unfinished songs with “곡 편집하기”. The current instrument displays the project layer's instrument. Saving commits the personal draft to the layer; publishing and submitting remain in the composition workflow.
- Upload, recording, HTI conversion, other participants' layers and project publishing are unchanged.

## Verification

- `npm test`: existing composition/draft/chord/playback coverage plus grouped editing, metadata preservation, collisions, drum bounds, paste boundaries, chained paste collisions and the note-count limit.
- `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`.
- Browser checks against a temporary local API using the actual production components: draw/drag length, rectangle selection, group move/resize, sweep erase, copy/paste/duplicate, undo/redo, chord insertion, autosave/reload, failed server save with local recovery, retry/commit and contribution submission.
- Browser layout/permission checks: portrait layout, 390px mobile width without horizontal overflow, 128 piano keys, 11 basic drum icon rows and 47 expanded rows, sampled piano/drum playback, disabled mutation controls for another user's track and native help dialog.

The temporary browser fixture and its API data are not shipped in product code. Actual backend `TEST` integration was also verified locally; see [live test report](piano-roll-studio-live-test.md).
