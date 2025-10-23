import { describe, it, expect } from 'vitest';
import {
  parseMidiFile,
  isValidMidiFile,
  extractTracks,
  convertTrackToPattern,
  noteNumberToName,
} from '../index.mjs';

describe('Integration: Full MIDI import workflow', () => {
  it('should handle complete workflow for simple MIDI data', async () => {
    // Create minimal valid MIDI file structure
    const midiData = {
      format: 0,
      division: 480,
      tracks: [
        [
          { trackName: 'Piano', delta: 0 },
          { noteOn: { noteNumber: 60, velocity: 100 }, delta: 0 },
          { noteOff: { noteNumber: 60, velocity: 0 }, delta: 480 },
          { noteOn: { noteNumber: 62, velocity: 100 }, delta: 0 },
          { noteOff: { noteNumber: 62, velocity: 0 }, delta: 480 },
        ],
      ],
    };

    // Extract tracks
    const tracks = extractTracks(midiData);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].noteCount).toBe(2);

    // Convert to pattern
    const patternCode = convertTrackToPattern(tracks[0]);
    expect(patternCode).toBeDefined();
    expect(typeof patternCode).toBe('string');
    expect(patternCode).toContain('note');
  });

  it('should handle multi-track MIDI files', () => {
    const midiData = {
      format: 1,
      division: 480,
      tracks: [
        [
          { trackName: 'Track 1', delta: 0 },
          { noteOn: { noteNumber: 60, velocity: 100 }, delta: 0 },
        ],
        [
          { trackName: 'Track 2', delta: 0 },
          { noteOn: { noteNumber: 64, velocity: 100 }, delta: 0 },
        ],
        [
          { trackName: 'Track 3', delta: 0 },
          { noteOn: { noteNumber: 67, velocity: 100 }, delta: 0 },
        ],
      ],
    };

    const tracks = extractTracks(midiData);
    expect(tracks).toHaveLength(3);

    // Convert selected tracks (0 and 2)
    const code1 = convertTrackToPattern(tracks[0]);
    const code2 = convertTrackToPattern(tracks[2]);

    expect(code1).toContain('c4');
    expect(code2).toContain('g4');
  });

  it('should handle empty tracks gracefully', () => {
    const midiData = {
      format: 0,
      division: 480,
      tracks: [[{ trackName: 'Empty', delta: 0 }]],
    };

    const tracks = extractTracks(midiData);
    expect(tracks).toHaveLength(1);
    expect(tracks[0].noteCount).toBe(0);

    const code = convertTrackToPattern(tracks[0]);
    expect(code).toBe('// Empty track');
  });

  it('should handle conversion options', () => {
    const track = {
      noteCount: 2,
      events: [
        { type: 'noteOn', noteNumber: 60, velocity: 100 },
        { type: 'noteOn', noteNumber: 62, velocity: 80 },
      ],
    };

    const code1 = convertTrackToPattern(track, { quantize: true });
    expect(code1).toBeDefined();

    const code2 = convertTrackToPattern(track, { quantize: false });
    expect(code2).toBeDefined();

    const code3 = convertTrackToPattern(track, { preserveVelocity: true });
    expect(code3).toBeDefined();
  });

  it('should convert note numbers correctly across MIDI range', () => {
    expect(noteNumberToName(0)).toBe('c-1');
    expect(noteNumberToName(60)).toBe('c4'); // Middle C
    expect(noteNumberToName(69)).toBe('a4'); // A440
    expect(noteNumberToName(127)).toBe('g9');
  });
});

describe('Integration: Error handling', () => {
  it('should handle invalid ArrayBuffer gracefully', async () => {
    await expect(parseMidiFile(null)).rejects.toThrow('Input must be an ArrayBuffer');
  });

  it('should detect invalid MIDI files', () => {
    const invalidBuffer = new ArrayBuffer(10);
    expect(isValidMidiFile(invalidBuffer)).toBe(false);
  });
});
