import { describe, it, expect } from 'vitest';
import { noteNumberToName, analyzeTrack, convertTrackToPattern, formatPatternCode } from '../midi-to-pattern.mjs';

describe('noteNumberToName', () => {
  it('should convert middle C (60) to c4', () => {
    expect(noteNumberToName(60)).toBe('c4');
  });

  it('should convert A4 (69) to a4', () => {
    expect(noteNumberToName(69)).toBe('a4');
  });

  it('should convert C3 (48) to c3', () => {
    expect(noteNumberToName(48)).toBe('c3');
  });

  it('should convert C5 (72) to c5', () => {
    expect(noteNumberToName(72)).toBe('c5');
  });

  it('should convert C#4 (61) to cs4', () => {
    expect(noteNumberToName(61)).toBe('cs4');
  });

  it('should handle low notes (C-1)', () => {
    expect(noteNumberToName(0)).toBe('c-1');
  });

  it('should handle high notes (G9)', () => {
    expect(noteNumberToName(127)).toBe('g9');
  });
});

describe('analyzeTrack', () => {
  it('should detect empty track', () => {
    const track = { noteCount: 0, events: [] };
    const analysis = analyzeTrack(track);

    expect(analysis.isMonophonic).toBe(true);
    expect(analysis.recommendedStrategy).toBe('mini');
  });

  it('should detect monophonic track', () => {
    const track = {
      noteCount: 3,
      events: [
        { type: 'noteOn', noteNumber: 60, velocity: 100 },
        { type: 'noteOff', noteNumber: 60, velocity: 0 },
        { type: 'noteOn', noteNumber: 62, velocity: 100 },
        { type: 'noteOff', noteNumber: 62, velocity: 0 },
        { type: 'noteOn', noteNumber: 64, velocity: 100 },
        { type: 'noteOff', noteNumber: 64, velocity: 0 },
      ],
    };
    const analysis = analyzeTrack(track);

    expect(analysis.isMonophonic).toBe(true);
    expect(analysis.maxSimultaneous).toBe(1);
  });

  it('should detect polyphonic track', () => {
    const track = {
      noteCount: 3,
      events: [
        { type: 'noteOn', noteNumber: 60, velocity: 100 },
        { type: 'noteOn', noteNumber: 64, velocity: 100 },
        { type: 'noteOn', noteNumber: 67, velocity: 100 },
        { type: 'noteOff', noteNumber: 60, velocity: 0 },
        { type: 'noteOff', noteNumber: 64, velocity: 0 },
        { type: 'noteOff', noteNumber: 67, velocity: 0 },
      ],
    };
    const analysis = analyzeTrack(track);

    expect(analysis.isMonophonic).toBe(false);
    expect(analysis.maxSimultaneous).toBe(3);
    expect(analysis.recommendedStrategy).toBe('stack');
  });
});

describe('convertTrackToPattern', () => {
  it('should return comment for empty track', () => {
    const track = { noteCount: 0, events: [] };
    const code = convertTrackToPattern(track);

    expect(code).toBe('// Empty track');
  });

  it('should convert simple monophonic sequence to mini notation', () => {
    const track = {
      noteCount: 4,
      events: [
        { type: 'noteOn', noteNumber: 60, velocity: 100 },
        { type: 'noteOn', noteNumber: 62, velocity: 100 },
        { type: 'noteOn', noteNumber: 64, velocity: 100 },
        { type: 'noteOn', noteNumber: 65, velocity: 100 },
      ],
    };
    const code = convertTrackToPattern(track);

    expect(code).toContain('note(');
    expect(code).toContain('c4');
    expect(code).toContain('d4');
    expect(code).toContain('e4');
    expect(code).toContain('f4');
  });

  it('should use stack() for polyphonic tracks', () => {
    const track = {
      noteCount: 3,
      events: [
        { type: 'noteOn', noteNumber: 60, velocity: 100 },
        { type: 'noteOn', noteNumber: 64, velocity: 100 },
        { type: 'noteOn', noteNumber: 67, velocity: 100 },
      ],
    };
    const code = convertTrackToPattern(track);

    expect(code).toContain('stack(');
    expect(code).toContain('c4');
    expect(code).toContain('e4');
    expect(code).toContain('g4');
  });

  it('should respect conversion options', () => {
    const track = {
      noteCount: 2,
      events: [
        { type: 'noteOn', noteNumber: 60, velocity: 100 },
        { type: 'noteOn', noteNumber: 62, velocity: 80 },
      ],
    };
    const code = convertTrackToPattern(track, { quantize: false });

    expect(code).toBeDefined();
    expect(typeof code).toBe('string');
  });
});

describe('formatPatternCode', () => {
  it('should add track name as comment', () => {
    const code = 'note("c4 d4")';
    const formatted = formatPatternCode(code, { trackName: 'Piano' });

    expect(formatted).toContain('// Piano');
    expect(formatted).toContain('note("c4 d4")');
  });

  it('should return code unchanged if no options', () => {
    const code = 'note("c4 d4")';
    const formatted = formatPatternCode(code);

    expect(formatted).toBe(code);
  });
});
