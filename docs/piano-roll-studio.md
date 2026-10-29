# Piano roll studio

The supplied `piano-roll-studio.zip` provides the editor's visual design and interaction model. The production screen remains connected to the existing composition APIs and personal draft sessions.

## Interaction

- Portrait is the default on desktop and mobile. The desktop editor is centered at up to 640px wide; smaller screens use the available width. Turning a phone/tablet to landscape uses a wider, compact layout. CSS handles orientation changes, so notes, draft history, selection, zoom and playback state are not remounted. No CSS rotation is applied.
- Draw: click to add a note at the selected 1/4, 1/8 or 1/16 snap; drag to choose its length.
- Select: tap individual notes to toggle selection, or drag an empty area to select a rectangle. Shift-drag adds to the selection.
- Drag a selected note to move the group. Drag its right edge to resize the group. Blank-area dragging does not pan the canvas.
- Copy, paste at the playhead, duplicate after the selected group, delete, undo and redo are available from buttons and the ZIP's shortcuts. Arrow keys move notes; Shift+arrows do not resize them.
- Group edits are atomic. A same-pitch time overlap rejects the whole edit. MIDI velocity/effect data and relative timing/pitch intervals are preserved.
- Each gesture creates one undo step and updates the existing draft session on completion. Cancelling a pointer gesture leaves the saved notes unchanged. History resets when the draft session changes.

## Existing behavior retained

- Personal browser recovery, server autosave, retry/conflict recovery, discard, explicit commit and contribution submission use the existing draft implementation.
- The piano editor spans MIDI pitches 0–127. Drum layers use pitches 35–81 and show percussion names. Owner/status permissions protect mutations.
- The 24-instrument catalog and sampled playback remain in use. Keyboard and note previews use those same samples, not the ZIP's synthesized oscillator voices.
- Playback covers the current clip, independent of the 1/2/4-bar editing window, preserves held-note durations and respects a clip's project offset.
- The existing chord picker writes through the same draft/history path. Its octave and chord-length settings remain available in the picker.
- Tempo, 4/4 meter and the current instrument display the existing project's settings. Saving commits the personal draft to the layer; publishing and submitting remain in the composition workflow.
- Upload, recording, HTI conversion, other participants' layers and project publishing are unchanged.

## Verification

- `npm test`: existing composition/draft/chord/playback coverage plus grouped editing, metadata preservation, collisions, drum bounds, paste boundaries and the note-count limit.
- `npx tsc --noEmit --incremental false`, `npm run lint`, `npm run build`.
- Browser checks against a temporary local API using the actual production components: draw/drag length, rectangle selection, group move/resize, sweep erase, copy/paste/duplicate, undo/redo, chord insertion, autosave/reload, failed server save with local recovery, retry/commit and contribution submission.
- Browser layout/permission checks: portrait layout, 390px mobile width without horizontal overflow, 128 piano keys, 47 drum keys, sampled piano/drum playback, disabled mutation controls for another user's track and native help dialog.

The temporary browser fixture and its API data are not shipped in product code. Live backend integration still requires the existing editor-drafts API to be deployed.
