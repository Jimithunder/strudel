import PlayCircleIcon from '@heroicons/react/20/solid/PlayCircleIcon';
import cx from '@src/cx.mjs';
import NumberInput from './NumberInput';
import { useEffect, useState } from 'react';
import { Textbox } from './textbox/Textbox';
import {
  getAudioContext,
} from '@strudel/webaudio';
import XMarkIcon from '@heroicons/react/24/outline/XMarkIcon';

function Checkbox({ label, value, onChange, disabled = false }) {
  return (
    <label className={cx(disabled && 'opacity-50')}>
      <input disabled={disabled} type="checkbox" checked={value} onChange={onChange} />
      {' ' + label}
    </label>
  );
}

function FormItem({ label, children, disabled }) {
  return (
    <div className="grid gap-2">
      <label className={cx(disabled && 'opacity-50')}>{label}</label>
      {children}
    </div>
  );
}

export default function ExportModal(Props) {
  const { started, isEmbedded, handleExport } = Props;

  const [downloadName, setDownloadName] = useState(''); // TODO: make a form?
  const [startCycle, setStartCycle] = useState(0);
  const [endCycle, setEndCycle] = useState(1);
  const [sampleRate, setSampleRate] = useState(48000);
  const [multiChannelOrbits, setMultiChannelOrbits] = useState(true);
  const [maxPolyphony, setMaxPolyphony] = useState(1024);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [length, setLength] = useState(1);

  const refreshProgress = () => {
    const audioContext = getAudioContext();
    if (audioContext instanceof OfflineAudioContext) {
      setProgress(audioContext.currentTime);
      setLength(audioContext.length / sampleRate);
      setTimeout(refreshProgress, 100);
    }
  };

  return (
    <>
      <button
        onClick={() => {
          if (started) return;
          const modal = document.getElementById('exportModal');
          modal.showModal();
        }}
        title="export"
        className={cx(
          'flex items-center space-x-1',
          !isEmbedded ? 'p-2' : 'px-2',
          started ? 'opacity-50' : 'hover:opacity-50',
        )}
      >
        {!isEmbedded && <span>export</span>}
      </button>
      <dialog
        closedby={exporting ? 'none' : 'closerequest'}
        id="exportModal"
        className="text-md bg-background text-foreground rounded-lg backdrop:bg-background backdrop:opacity-50"
      >
        <button
          onClick={() => {
            if (exporting) return;
            const modal = document.getElementById('exportModal');
            modal.close();
          }}
          className={cx(
            'absolute text-foreground max-h-8 min-h-8 max-w-8 min-w-8 items-center p-1.5 right-2 top-2 z-50',
            exporting && 'opacity-50',
          )}
          aria-label="Close Modal"
        >
          <XMarkIcon />
        </button>
        <div className="bg-lineHighlight p-4 space-y-4 relative">
          <FormItem label="File name" disabled={exporting}>
            <Textbox
              onBlur={(e) => {
                setDownloadName(e.target.value);
              }}
              onChange={(v) => {
                setDownloadName(v);
              }}
              disabled={exporting}
              placeholder="Leave empty to use current date"
              className={cx('placeholder:opacity-50', exporting && 'opacity-50 border-opacity-50')}
              value={downloadName ?? ''}
            />
          </FormItem>
          <div className="flex flex-row gap-4">
            <FormItem label="Start cycle" disabled={exporting}>
              <Textbox
                min={1}
                max={Infinity}
                onBlur={(e) => {
                  let v = parseInt(e.target.value);
                  v = isNaN(v) ? 0 : Math.max(0, v);
                  setStartCycle(v);
                }}
                onChange={(v) => {
                  v = parseInt(v);
                  setStartCycle(v);
                }}
                type="number"
                placeholder=""
                disabled={exporting}
                className={cx(exporting && 'opacity-50 border-opacity-50')}
                value={startCycle ?? ''}
              />
            </FormItem>
            <FormItem label="End cycle" disabled={exporting}>
              <Textbox
                min={1}
                max={Infinity}
                onBlur={(e) => {
                  let v = parseInt(e.target.value);
                  v = isNaN(v) ? Math.max(startCycle + 1, parseInt(v)) : v;
                  setEndCycle(v);
                }}
                onChange={(v) => {
                  v = parseInt(v);
                  setEndCycle(v);
                }}
                type="number"
                placeholder=""
                disabled={exporting}
                className={cx(exporting && 'opacity-50 border-opacity-50')}
                value={endCycle ?? ''}
              />
            </FormItem>
          </div>
          <div className="flex flex-row gap-4">
            <FormItem label="Sample rate" disabled={exporting}>
              <Textbox
                min={1}
                max={Infinity}
                onBlur={(e) => {
                  let v = parseInt(e.target.value);
                  v = isNaN(v) ? 1 : Math.max(1, v);
                  setSampleRate(v);
                }}
                onChange={(v) => {
                  v = parseInt(v);
                  setSampleRate(v);
                }}
                type="number"
                placeholder=""
                disabled={exporting}
                className={cx(exporting && 'opacity-50 border-opacity-50')}
                value={sampleRate ?? ''}
              />
            </FormItem>
            <FormItem label="Maximum polyphony" disabled={exporting}>
              <Textbox
                min={1}
                max={Infinity}
                onBlur={(e) => {
                  let v = parseInt(e.target.value);
                  v = isNaN(v) ? Math.max(1, parseInt(v)) : v;
                  setMaxPolyphony(v);
                }}
                onChange={(v) => {
                  v = Math.max(1, parseInt(v));
                  setMaxPolyphony(v);
                }}
                type="number"
                placeholder=""
                disabled={exporting}
                className={cx(exporting && 'opacity-50 border-opacity-50')}
                value={maxPolyphony ?? ''}
              />
            </FormItem>
          </div>
          <div>
            <Checkbox
              label="Multi Channel Orbits"
              onChange={(cbEvent) => {
                const val = cbEvent.target.checked;
                setMultiChannelOrbits(val);
              }}
              disabled={exporting}
              value={multiChannelOrbits}
            />
          </div>
          <button
            className={cx('bg-background p-2 w-full rounded-md hover:opacity-50 relative', exporting && 'opacity-50')}
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              setTimeout(refreshProgress, 2000);
              await handleExport(startCycle, endCycle, sampleRate, maxPolyphony, multiChannelOrbits, downloadName)
                .then(() => {
                  const modal = document.getElementById('exportModal');
                  modal.close();
                })
                .finally(() => {
                  setExporting(false);
                  setProgress(0);
                  setLength(1);
                });
            }}
          >
            <div
              className="absolute top-0 left-0 right-0 bottom-0 backdrop-invert"
              style={{
                width: `${(exporting ? 1 : 0) + (progress / length) * 99}%`
              }}
            />
            <span className="text-foreground">{exporting ? 'Exporting...' : 'Export to WAV'}</span>
          </button>
        </div>
      </dialog>
    </>
  );
}
