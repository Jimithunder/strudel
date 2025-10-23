import { useState, useCallback } from 'react';
import { parseMidiFile, isValidMidiFile, convertTrackToPattern } from '@strudel/midi-import';
import { MidiTrackSelector } from './MidiTrackSelector.jsx';

export function MidiImportModal({ isOpen, onClose, onInsert, onReplace }) {
  const [uploadState, setUploadState] = useState('idle');
  const [parsedData, setParsedData] = useState(null);
  const [selectedTracks, setSelectedTracks] = useState([]);
  const [generatedCode, setGeneratedCode] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [conversionOptions, setConversionOptions] = useState({
    quantize: true,
    quantizeSubdivision: 16,
    preserveVelocity: true,
  });

  const handleFileSelect = useCallback(async (file) => {
    if (!file) return;

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('File too large. Maximum size is 5MB.');
      setUploadState('error');
      return;
    }

    setUploadState('uploading');
    setErrorMessage(null);

    try {
      const arrayBuffer = await file.arrayBuffer();

      if (!isValidMidiFile(arrayBuffer)) {
        throw new Error('Invalid MIDI file format');
      }

      setUploadState('parsing');

      const data = await parseMidiFile(arrayBuffer);
      setParsedData(data);
      setSelectedTracks(data.tracks.map((_, i) => i)); // Select all by default
      setUploadState('parsed');
    } catch (error) {
      setErrorMessage(error.message);
      setUploadState('error');
    }
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file && (file.name.endsWith('.mid') || file.name.endsWith('.midi'))) {
        handleFileSelect(file);
      }
    },
    [handleFileSelect],
  );

  const handleConvert = useCallback(() => {
    if (!parsedData) return;

    setUploadState('converting');

    try {
      const codes = selectedTracks.map((trackIndex) => {
        const track = parsedData.tracks[trackIndex];
        const code = convertTrackToPattern(track, conversionOptions);
        return `// ${track.trackName}\n${code}`;
      });

      const finalCode = codes.join('\n\n');
      setGeneratedCode(finalCode);
      setUploadState('done');
    } catch (error) {
      setErrorMessage(error.message);
      setUploadState('error');
    }
  }, [parsedData, selectedTracks, conversionOptions]);

  const handleCopyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(generatedCode);
  }, [generatedCode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">Import MIDI File</h2>

        {uploadState === 'idle' && (
          <div
            className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <p className="mb-4">Drag and drop a MIDI file here, or click to browse</p>
            <input
              type="file"
              accept=".mid,.midi"
              onChange={(e) => handleFileSelect(e.target.files[0])}
              className="hidden"
              id="midi-file-input"
            />
            <label
              htmlFor="midi-file-input"
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded cursor-pointer inline-block"
            >
              Choose File
            </label>
          </div>
        )}

        {uploadState === 'parsing' && (
          <div className="text-center py-8">
            <p>Parsing MIDI file...</p>
          </div>
        )}

        {uploadState === 'parsed' && parsedData && (
          <>
            <MidiTrackSelector
              tracks={parsedData.tracks}
              selectedTracks={selectedTracks}
              onSelectionChange={setSelectedTracks}
            />

            <div className="mt-4 space-y-2">
              <h3 className="font-bold">Conversion Options</h3>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={conversionOptions.quantize}
                  onChange={(e) => setConversionOptions({ ...conversionOptions, quantize: e.target.checked })}
                  className="mr-2"
                />
                Quantize timing
              </label>
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={conversionOptions.preserveVelocity}
                  onChange={(e) => setConversionOptions({ ...conversionOptions, preserveVelocity: e.target.checked })}
                  className="mr-2"
                />
                Preserve velocity
              </label>
            </div>

            <div className="mt-4 flex gap-2">
              <button onClick={handleConvert} className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded">
                Convert
              </button>
              <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">
                Cancel
              </button>
            </div>
          </>
        )}

        {uploadState === 'done' && (
          <>
            <textarea
              value={generatedCode}
              readOnly
              className="w-full h-64 bg-gray-900 text-white p-2 rounded font-mono text-sm"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => {
                  onInsert(generatedCode);
                  onClose();
                }}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded"
              >
                Insert into Editor
              </button>
              <button
                onClick={() => {
                  onReplace(generatedCode);
                  onClose();
                }}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded"
              >
                Replace Editor
              </button>
              <button onClick={handleCopyToClipboard} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">
                Copy to Clipboard
              </button>
              <button onClick={onClose} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded">
                Close
              </button>
            </div>
          </>
        )}

        {uploadState === 'error' && errorMessage && (
          <div className="bg-red-900 border border-red-700 rounded p-4 mt-4">
            <p className="text-red-200">{errorMessage}</p>
            <button onClick={() => setUploadState('idle')} className="mt-2 bg-red-700 hover:bg-red-800 px-4 py-2 rounded">
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
