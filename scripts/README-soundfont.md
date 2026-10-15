# Instrument sample bank

The 24 instrument choices use selected presets from **MuseScore_General.sf2 v0.2**.
The original SoundFont is not bundled. Its SHA-256 is
`ee51d2c4b1525e70f19a45909c4fd7a2e26d91d115fa89dbf9a6bc413d8b9bf3`.

Source: https://ftp-osl.osuosl.org/pub/musescore/soundfont/MuseScore_General/

The SoundFont's license and sample-source list are preserved in
`public/audio/instruments/LICENSE.md` and `SAMPLE_SOURCES.csv`. The generated
sample files are modified excerpts of that SoundFont. Keep these documents
with any redistribution of the files.

To rebuild, download `MuseScore_General.sf2` from the source above and verify
its checksum. With JDK 21+ and FFmpeg installed:

```sh
mkdir -p /tmp/narackrock-instruments/classes /tmp/narackrock-instruments/wav
javac --add-exports java.desktop/com.sun.media.sound=ALL-UNNAMED \
  -d /tmp/narackrock-instruments/classes scripts/GenerateInstrumentSamples.java
java --add-exports java.desktop/com.sun.media.sound=ALL-UNNAMED \
  -cp /tmp/narackrock-instruments/classes GenerateInstrumentSamples \
  /path/to/MuseScore_General.sf2 /tmp/narackrock-instruments/wav
```

Convert each generated WAV to MP3 with FFmpeg quality setting `-q:a 4` for
`public/audio/instruments/`. Copy the WAVs to the backend's
`src/main/resources/audio/instruments/`. The preset and anchor-note mapping
is in `src/features/composition/instrument-catalog.json` and the backend's
`audio/instruments/manifest.json`.

These are compact previews: the browser loads only the selected instrument.
The original SoundFont has more velocity layers and synthesis settings than
the extracted bank. Sustained notes longer than the source recording can end
early; that is a current limitation of Tone.Sampler for these assets.
