import com.sun.media.sound.SoftSynthesizer;
import java.io.ByteArrayInputStream;
import java.io.DataInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import javax.sound.midi.MidiChannel;
import javax.sound.midi.MidiSystem;
import javax.sound.midi.Soundbank;
import javax.sound.sampled.AudioFileFormat;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioInputStream;
import javax.sound.sampled.AudioSystem;

/** Rebuilds the small, lazily loaded instrument bank from MuseScore_General v0.2. */
public final class GenerateInstrumentSamples {
    private static final int SAMPLE_RATE = 22_050;
    private static final AudioFormat FORMAT = new AudioFormat(SAMPLE_RATE, 16, 1, true, false);
    private static final int[] GENERAL = {36, 48, 60, 72, 84};
    private static final int[] GUITAR = {40, 47, 54, 61, 68, 75, 82};
    private static final int[] BASS = {28, 35, 42, 49, 56, 63};
    private static final int[] PIANO = {21, 36, 48, 60, 72, 84, 96};

    private record Preset(String id, int program, int[] notes, double seconds) { }

    private static final Preset[] PRESETS = {
        new Preset("piano", 0, PIANO, 2.5),
        new Preset("electric-piano", 4, GENERAL, 2.5),
        new Preset("organ", 18, GENERAL, 4),
        new Preset("nylon-guitar", 24, GUITAR, 2.5),
        new Preset("acoustic-guitar", 25, GUITAR, 2.5),
        new Preset("electric-guitar", 27, GUITAR, 2.5),
        new Preset("overdrive-guitar", 29, GUITAR, 2.5),
        new Preset("distortion-guitar", 30, GUITAR, 2.5),
        new Preset("acoustic-bass", 32, BASS, 2.5),
        new Preset("electric-bass", 33, BASS, 2.5),
        new Preset("picked-bass", 34, BASS, 2.5),
        new Preset("slap-bass", 36, BASS, 2.5),
        new Preset("synth-bass", 38, BASS, 3),
        new Preset("violin", 40, GENERAL, 3),
        new Preset("strings", 48, GENERAL, 3),
        new Preset("harp", 46, GENERAL, 2.5),
        new Preset("trumpet", 56, GENERAL, 3),
        new Preset("brass", 61, GENERAL, 3),
        new Preset("saxophone", 65, GENERAL, 3),
        new Preset("flute", 73, GENERAL, 3),
        new Preset("synth-lead", 81, GENERAL, 4),
        new Preset("synth-pad", 89, GENERAL, 5),
        new Preset("marimba", 12, GENERAL, 2.5),
    };

    private GenerateInstrumentSamples() { }

    public static void main(String[] arguments) throws Exception {
        if (arguments.length != 2) {
            throw new IllegalArgumentException("Usage: GenerateInstrumentSamples <MuseScore_General.sf2> <output-dir>");
        }
        Soundbank bank = MidiSystem.getSoundbank(Path.of(arguments[0]).toFile());
        Path root = Path.of(arguments[1]);
        SoftSynthesizer synthesizer = new SoftSynthesizer();
        Map<String, Object> settings = new HashMap<>();
        settings.put("load default soundbank", false);
        settings.put("reverb", false);
        settings.put("chorus", false);
        settings.put("auto gain control", false);
        try (AudioInputStream stream = synthesizer.openStream(FORMAT, settings)) {
            if (!synthesizer.loadAllInstruments(bank)) {
                throw new IllegalStateException("Could not load MuseScore General SoundFont");
            }
            MidiChannel melodic = synthesizer.getChannels()[0];
            MidiChannel drums = synthesizer.getChannels()[9];
            melodic.controlChange(7, 100);
            drums.controlChange(7, 100);
            for (Preset preset : PRESETS) {
                melodic.programChange(preset.program());
                for (int note : preset.notes()) {
                    capture(stream, melodic, note, preset.seconds(), root.resolve(preset.id()).resolve(note + ".wav"));
                }
            }
            drums.programChange(0);
            for (int note = 35; note <= 81; note++) {
                capture(stream, drums, note, 1.5, root.resolve("drum-kit").resolve(note + ".wav"));
            }
        } finally {
            synthesizer.close();
        }
    }

    private static void capture(AudioInputStream stream, MidiChannel channel, int note, double seconds, Path file)
            throws IOException {
        channel.allSoundOff();
        read(stream, SAMPLE_RATE / 8);
        channel.noteOn(note, 100);
        byte[] pcm = read(stream, (int) (SAMPLE_RATE * seconds));
        channel.noteOff(note);
        fadeOut(pcm);
        Files.createDirectories(file.getParent());
        try (AudioInputStream wave = new AudioInputStream(new ByteArrayInputStream(pcm), FORMAT,
                pcm.length / FORMAT.getFrameSize())) {
            AudioSystem.write(wave, AudioFileFormat.Type.WAVE, file.toFile());
        }
    }

    private static byte[] read(AudioInputStream stream, int frames) throws IOException {
        byte[] pcm = new byte[frames * FORMAT.getFrameSize()];
        new DataInputStream(stream).readFully(pcm);
        return pcm;
    }

    private static void fadeOut(byte[] pcm) {
        int frames = pcm.length / 2;
        int fadeFrames = Math.min(frames, SAMPLE_RATE / 10);
        for (int frame = frames - fadeFrames; frame < frames; frame++) {
            int offset = frame * 2;
            short value = (short) ((pcm[offset] & 0xff) | (pcm[offset + 1] << 8));
            short faded = (short) Math.round(value * (frames - frame - 1) / (double) fadeFrames);
            pcm[offset] = (byte) faded;
            pcm[offset + 1] = (byte) (faded >>> 8);
        }
    }
}
