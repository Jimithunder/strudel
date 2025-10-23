#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import { parseMidiFile, convertTrackToPattern, convertTrackWithSplit, noteNumberToName } from './index.mjs';

const commands = {
  analyze: analyzeMidi,
  convert: convertMidi,
  help: showHelp,
};

async function analyzeMidi(filepath) {
  if (!filepath) {
    console.error('Error: Please provide a MIDI file path');
    console.error('Usage: pnpm midi:analyze <file.mid>');
    process.exit(1);
  }

  try {
    console.log(`\n=== Analyzing MIDI File ===`);
    console.log(`File: ${filepath}\n`);

    // Read the MIDI file
    const buffer = await readFile(filepath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    // Parse the file
    const parsed = await parseMidiFile(arrayBuffer);

    console.log('📄 File Information:');
    console.log(`  Format: ${parsed.format}`);
    console.log(`  Division: ${parsed.division} ticks per quarter note`);
    console.log(`  Tracks: ${parsed.tracks.length}`);

    // Tracks are already extracted by parseMidiFile
    const tracks = parsed.tracks;

    console.log('\n🎵 Track Details:\n');
    tracks.forEach((track, i) => {
      console.log(`Track ${i}: "${track.trackName}"`);
      console.log(`  ├─ Notes: ${track.noteCount}`);
      console.log(`  ├─ Duration: ${track.duration} ticks`);

      if (track.noteCount > 0) {
        console.log(`  ├─ Pitch range: MIDI ${track.pitchRange.min}-${track.pitchRange.max}`);

        // Show first few note events
        const noteEvents = track.events.filter(e => e.type === 'noteOn').slice(0, 5);
        if (noteEvents.length > 0) {
          console.log(`  └─ First notes:`);
          noteEvents.forEach(event => {
            console.log(`     • Note ${event.noteNumber} (vel ${event.velocity}) at tick ${event.absoluteTime}`);
          });
        }
      } else {
        console.log(`  └─ (empty track)`);
      }
      console.log('');
    });

    console.log('✅ Analysis complete\n');

  } catch (error) {
    console.error('❌ Error analyzing MIDI file:', error.message);
    process.exit(1);
  }
}

async function convertMidi(filepath, ...args) {
  if (!filepath) {
    console.error('Error: Please provide a MIDI file path');
    console.error('Usage: pnpm midi:convert <file.mid> [output.js] [--split]');
    process.exit(1);
  }

  // Check for --split flag and filter it out from args
  const splitByPitch = process.argv.includes('--split');
  const outputPath = args.find(arg => arg && !arg.startsWith('--'));

  try {
    console.log(`\n=== Converting MIDI to Strudel Pattern ===`);
    console.log(`Input: ${filepath}`);
    if (splitByPitch) {
      console.log(`Mode: Split by pitch ranges\n`);
    } else {
      console.log('');
    }

    // Read the MIDI file
    const buffer = await readFile(filepath);
    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

    // Parse the file
    const parsed = await parseMidiFile(arrayBuffer);
    // Tracks are already extracted by parseMidiFile
    const tracks = parsed.tracks;

    console.log(`Found ${tracks.length} track(s)\n`);

    // Convert each track
    const patterns = [];
    tracks.forEach((track, i) => {
      if (track.noteCount > 0) {
        console.log(`Converting Track ${i}: "${track.trackName}" (${track.noteCount} notes)`);
        
        if (splitByPitch) {
          // Split by pitch and convert each sub-track
          const splitPatterns = convertTrackWithSplit(track, {
            ticksPerBeat: parsed.division,
            quantizeSubdivision: 16,
            tempo: parsed.tempo,
            timeSignature: parsed.timeSignature,
          });
          
          splitPatterns.forEach((sp) => {
            console.log(`  ├─ ${sp.name}: ${sp.noteCount} notes (${noteNumberToName(sp.pitchRange.min)}-${noteNumberToName(sp.pitchRange.max)})`);
            patterns.push({
              trackName: sp.name,
              trackIndex: i,
              code: sp.code,
            });
          });
        } else {
          // Convert entire track
          const pattern = convertTrackToPattern(track, {
            ticksPerBeat: parsed.division,
            quantizeSubdivision: 16,
            tempo: parsed.tempo,
            timeSignature: parsed.timeSignature,
          });
          patterns.push({
            trackName: track.trackName,
            trackIndex: i,
            code: pattern,
          });
        }
      } else {
        console.log(`Skipping Track ${i}: "${track.trackName}" (empty)`);
      }
    });

    if (patterns.length === 0) {
      console.log('\n⚠️  No tracks with notes found');
      process.exit(0);
    }

    // Generate complete code
    let fullCode = `// Converted from: ${filepath}\n`;
    fullCode += `// Generated: ${new Date().toISOString()}\n`;
    fullCode += `// Tracks: ${patterns.length}\n`;
    if (splitByPitch) {
      fullCode += `// Split by pitch ranges\n`;
    }
    fullCode += '\n';

    if (patterns.length === 1) {
      // Single track - output directly
      fullCode += patterns[0].code;
    } else {
      // Multiple tracks - create stack
      patterns.forEach(({ trackName, trackIndex, code }, i) => {
        fullCode += `// ${trackName}\n`;
        fullCode += `const track${i} = ${code};\n\n`;
      });

      fullCode += `// Play all tracks together\n`;
      fullCode += `stack(\n`;
      patterns.forEach((_, i) => {
        fullCode += `  track${i}${i < patterns.length - 1 ? ',' : ''}\n`;
      });
      fullCode += `)`;
    }

    // Output
    if (outputPath) {
      await writeFile(outputPath, fullCode, 'utf-8');
      console.log(`\n✅ Conversion complete!`);
      console.log(`📝 Output written to: ${outputPath}`);
    } else {
      console.log('\n=== Generated Strudel Code ===\n');
      console.log(fullCode);
      console.log('\n✅ Conversion complete!');
    }

  } catch (error) {
    console.error('❌ Error converting MIDI file:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           Strudel MIDI Import CLI                             ║
╚═══════════════════════════════════════════════════════════════╝

Commands:

  pnpm midi:analyze <file.mid>
    Analyze a MIDI file and display track information

  pnpm midi:convert <file.mid> [output.js] [--split]
    Convert a MIDI file to Strudel pattern code
    If output.js is provided, writes to file
    Otherwise, prints to console
    
    --split: Split tracks by pitch ranges (bass/mid/high)
             and generate separate patterns for each range

Examples:

  # Analyze a MIDI file
  pnpm midi:analyze song.mid

  # Convert and print to console
  pnpm midi:convert song.mid

  # Convert with pitch splitting
  pnpm midi:convert song.mid --split

  # Convert and save to file
  pnpm midi:convert song.mid output.js

  # Convert with splitting and save
  pnpm midi:convert song.mid output.js --split

`);
}

// Main CLI handler
async function main() {
  const [,, command, ...args] = process.argv;

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    process.exit(0);
  }

  const handler = commands[command];

  if (!handler) {
    console.error(`❌ Unknown command: ${command}`);
    console.error('Run "pnpm midi:help" for usage information');
    process.exit(1);
  }

  await handler(...args);
}

main().catch(error => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
