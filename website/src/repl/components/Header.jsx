import { useState, useEffect, useCallback } from 'react';
import PlayCircleIcon from '@heroicons/react/20/solid/PlayCircleIcon';
import StopCircleIcon from '@heroicons/react/20/solid/StopCircleIcon';
import cx from '@src/cx.mjs';
import { useSettings, setIsZen } from '../../settings.mjs';
import '../Repl.css';

const { BASE_URL } = import.meta.env;
const baseNoTrailing = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;

export function Header({ context, embedded = false }) {
  const { started, pending, isDirty, activeCode, handleTogglePlay, handleEvaluate, handleShuffle, handleShare } =
    context;
  const isEmbedded = typeof window !== 'undefined' && (embedded || window.location !== window.parent.location);
  const { isZen, isButtonRowHidden, isCSSAnimationDisabled, fontFamily } = useSettings();

  // State
  const [currentTime, setCurrentTime] = useState(new Date());
  const [playTime, setPlayTime] = useState(0);
  const [currentCps, setCurrentCps] = useState(0.5);
  const [currentCpm, setCurrentCpm] = useState(30);
  const [musicPosition, setMusicPosition] = useState({ bars: 1, beats: 1, sixteenths: 1, bars_count: 1 });

  // Function for set position cycle from scheduler
  const setCyclePosition = useCallback((position) => {
    const scheduler = context.editorRef?.current?.repl?.scheduler;
    if (scheduler) {
      if (typeof scheduler.setCycle === 'function') {
        scheduler.setCycle(position);
      } else if (scheduler.lastBegin !== undefined) {
        scheduler.lastBegin = position;
        if (scheduler.lastEnd !== undefined) {
          scheduler.lastEnd = position + 1;
        }
      }
    }
  }, [context.editorRef]);

  // Update position
  const updateMusicPosition = useCallback((cyclePosition) => {
    const totalSixteenths = cyclePosition * 16;
    const bars = Math.floor(totalSixteenths / 16) + 1;
    const remainingSixteenths = totalSixteenths % 16;
    const beats = Math.floor(remainingSixteenths / 4) + 1;
    const sixteenths = Math.floor(remainingSixteenths % 4) + 1;
    const bars_count = ((bars - 1) % 8) + 1;
    setMusicPosition({ bars, beats, sixteenths, bars_count });
  }, []);

  // Effect for updating time, playtime, CPS, CPM and position
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      setPlayTime((prev) => prev + 0.1); // add 100ms to playTime

      const scheduler = context.editorRef?.current?.repl?.scheduler;
      if (scheduler) {
        setCurrentCps(scheduler.cps || 0.5);
        setCurrentCpm((scheduler.cps || 0.5) * 60);
        if (started) {
          const currentCycle = scheduler.now();
          updateMusicPosition(currentCycle);
        }
      }
    }, 100);

    return () => clearInterval(timer);
  }, [started, context.editorRef, updateMusicPosition]);

  // Time format
  const formatTime = (date) => date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };
  const formatMusicPosition = ({ bars, beats, sixteenths, bars_count }) => `${beats}.${bars_count} | ${bars}.${beats}.${sixteenths}`;

  return (
    <header
      id="header"
      className={cx(
        'flex-none text-black  z-[100] text-lg select-none h-20 md:h-14',
        !isZen && !isEmbedded && 'bg-lineHighlight',
        isZen ? 'h-12 w-8 fixed top-0 left-0' : 'sticky top-0 w-full py-1 justify-between',
        isEmbedded ? 'flex' : 'md:flex',
      )}
      style={{ fontFamily }}
    >
      <div className="px-4 flex space-x-2 md:pt-0 select-none">
        <h1
          onClick={() => {
            if (isEmbedded) window.open(window.location.href.replace('embed', ''));
          }}
          className={cx(
            isEmbedded ? 'text-l cursor-pointer' : 'text-xl',
            'text-foreground font-bold flex space-x-2 items-center',
          )}
        >
          <div
            className={cx(
              'mt-[1px]',
              started && !isCSSAnimationDisabled && 'animate-spin',
              'cursor-pointer text-blue-500',
              isZen && 'fixed top-2 right-4',
            )}
            onClick={() => {
              if (!isEmbedded) {
                setIsZen(!isZen);
              }
            }}
          >
            <span className="block text-foreground rotate-90">꩜</span>
          </div>
          {!isZen && (
            <div className="space-x-2">
              <span className="">strudel</span>
              <span className="text-sm font-medium">REPL</span>
              <span className="text-sm font-medium">
                | TIME: {formatTime(currentTime)} | PLAY: {formatDuration(playTime)}
              </span>
              <span className="text-sm font-medium">
                | CPS: {currentCps.toFixed(2)} | CPM: {currentCpm.toFixed(2)} | BPM: {currentCps*240} 
              </span>
              <span className="text-sm font-medium">| Position: {formatMusicPosition(musicPosition)}</span>
              {!isEmbedded && isButtonRowHidden && (
                <a href={`${baseNoTrailing}/learn`} className="text-sm opacity-25 font-medium">
                  DOCS
                </a>
              )}
            </div>
          )}
        </h1>
      </div>
      {!isZen && !isButtonRowHidden && (
        <div className="flex max-w-full overflow-auto text-foreground px-1 md:px-2">
          <button
            onClick={handleTogglePlay}
            title={started ? 'stop' : 'play'}
            className={cx(
              !isEmbedded ? 'p-2' : 'px-2',
              'hover:opacity-50',
              !started && !isCSSAnimationDisabled && 'animate-pulse',
            )}
          >
            {!pending ? (
              <span className={cx('flex items-center space-x-2')}>
                {started ? <StopCircleIcon className="w-6 h-6" /> : <PlayCircleIcon className="w-6 h-6" />}
                {!isEmbedded && <span>{started ? 'stop' : 'play'}</span>}
              </span>
            ) : (
              <>loading...</>
            )}
          </button>
          <button
            onClick={handleEvaluate}
            title="update"
            className={cx(
              'flex items-center space-x-1',
              !isEmbedded ? 'p-2' : 'px-2',
              !isDirty || !activeCode ? 'opacity-50' : 'hover:opacity-50',
            )}
          >
            {!isEmbedded && <span>update</span>}
          </button>
          {/* !isEmbedded && (
            <button
              title="shuffle"
              className="hover:opacity-50 p-2 flex items-center space-x-1"
              onClick={handleShuffle}
            >
              <span> shuffle</span>
            </button>
          ) */}
          {!isEmbedded && (
            <button
              title="share"
              className={cx(
                'cursor-pointer hover:opacity-50 flex items-center space-x-1',
                !isEmbedded ? 'p-2' : 'px-2',
              )}
              onClick={handleShare}
            >
              <span>share</span>
            </button>
          )}
          {!isEmbedded && (
            <a
              title="learn"
              href={`${baseNoTrailing}/workshop/getting-started/`}
              className={cx('hover:opacity-50 flex items-center space-x-1', !isEmbedded ? 'p-2' : 'px-2')}
            >
              <span>learn</span>
            </a>
          )}
          {/* {isEmbedded && (
            <button className={cx('hover:opacity-50 px-2')}>
              <a href={window.location.href} target="_blank" rel="noopener noreferrer" title="Open in REPL">
                🚀
              </a>
            </button>
          )}
          {isEmbedded && (
            <button className={cx('hover:opacity-50 px-2')}>
              <a
                onClick={() => {
                  window.location.href = initialUrl;
                  window.location.reload();
                }}
                title="Reset"
              >
                💔
              </a>
            </button>
          )} */}
        </div>
      )}
    </header>
  );
}
