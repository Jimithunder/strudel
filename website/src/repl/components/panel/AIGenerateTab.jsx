import { useState } from 'react';
import { generateStrudelCode } from '../../gemini.mjs';
import { useSettings, settingsMap } from '../../../settings.mjs';
import cx from '@src/cx.mjs';

const OPENROUTER_MODELS = [
  { value: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'anthropic/claude-3-opus', label: 'Claude 3 Opus' },
  { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku' },
  { value: 'openai/gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'openai/gpt-4', label: 'GPT-4' },
  { value: 'openai/gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
  { value: 'google/gemini-pro-1.5', label: 'Gemini Pro 1.5' },
  { value: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B' },
];

export function AIGenerateTab({ context }) {
  const settings = useSettings();
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState(settings.aiProvider || 'gemini');
  const [geminiApiKey, setGeminiApiKey] = useState(settings.geminiApiKey || '');
  const [openRouterApiKey, setOpenRouterApiKey] = useState(settings.openRouterApiKey || '');
  const [selectedModel, setSelectedModel] = useState(settings.openRouterModel || OPENROUTER_MODELS[0].value);
  const [generatedCode, setGeneratedCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    const apiKey = provider === 'gemini' ? geminiApiKey : openRouterApiKey;

    if (!apiKey.trim()) {
      setError('Please enter your API key');
      return;
    }

    setIsLoading(true);
    setError('');
    setGeneratedCode('');

    try {
      const code = await generateStrudelCode(prompt, {
        provider,
        apiKey,
        model: selectedModel,
      });
      setGeneratedCode(code);

      // Save settings
      if (provider !== settings.aiProvider) {
        settingsMap.setKey('aiProvider', provider);
      }
      if (provider === 'gemini' && geminiApiKey !== settings.geminiApiKey) {
        settingsMap.setKey('geminiApiKey', geminiApiKey);
      }
      if (provider === 'openrouter') {
        if (openRouterApiKey !== settings.openRouterApiKey) {
          settingsMap.setKey('openRouterApiKey', openRouterApiKey);
        }
        if (selectedModel !== settings.openRouterModel) {
          settingsMap.setKey('openRouterModel', selectedModel);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to generate code');
      console.error('Generation error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInsertCode = () => {
    if (generatedCode && context.editorRef?.current) {
      // Get current code
      const currentCode = context.editorRef.current.getCode?.() || '';

      // Add the generated code with a newline separator if there's existing code
      const newCode = currentCode.trim()
        ? `${currentCode}\n\n// AI Generated:\n${generatedCode}`
        : generatedCode;

      context.editorRef.current.setCode(newCode);
      setGeneratedCode(''); // Clear after inserting
      setPrompt(''); // Clear prompt
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleGenerate();
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-bold text-foreground">AI Code Generator</h3>
        <p className="text-sm text-foreground opacity-70">
          Generate Strudel code from natural language descriptions
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">AI Provider</label>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="p-2 bg-background text-foreground rounded-md border border-foreground/20 focus:border-foreground/50 outline-none"
        >
          <option value="gemini">Google Gemini</option>
          <option value="openrouter">OpenRouter</option>
        </select>
      </div>

      {provider === 'gemini' ? (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-foreground">Gemini API Key</label>
          <input
            type="password"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            placeholder="Enter your Gemini API key"
            className="p-2 bg-background text-foreground rounded-md border border-foreground/20 focus:border-foreground/50 outline-none"
          />
          <p className="text-xs text-foreground opacity-50">
            Get your free API key from{' '}
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:opacity-70"
            >
              Google AI Studio
            </a>
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">OpenRouter API Key</label>
            <input
              type="password"
              value={openRouterApiKey}
              onChange={(e) => setOpenRouterApiKey(e.target.value)}
              placeholder="Enter your OpenRouter API key"
              className="p-2 bg-background text-foreground rounded-md border border-foreground/20 focus:border-foreground/50 outline-none"
            />
            <p className="text-xs text-foreground opacity-50">
              Get your API key from{' '}
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:opacity-70"
              >
                OpenRouter
              </a>
              {' · Access Claude, GPT-4, and more'}
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-foreground">Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="p-2 bg-background text-foreground rounded-md border border-foreground/20 focus:border-foreground/50 outline-none"
            >
              {OPENROUTER_MODELS.map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-foreground">Prompt</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="E.g., create a drum pattern with syncopated hi-hats"
          rows={4}
          className="p-2 bg-background text-foreground rounded-md border border-foreground/20 focus:border-foreground/50 outline-none resize-vertical"
        />
        <p className="text-xs text-foreground opacity-50">Press Ctrl+Enter (Cmd+Enter on Mac) to generate</p>
      </div>

      <button
        onClick={handleGenerate}
        disabled={
          isLoading ||
          !prompt.trim() ||
          (provider === 'gemini' ? !geminiApiKey.trim() : !openRouterApiKey.trim())
        }
        className={cx(
          'px-4 py-2 rounded-md font-medium transition-colors',
          isLoading ||
            !prompt.trim() ||
            (provider === 'gemini' ? !geminiApiKey.trim() : !openRouterApiKey.trim())
            ? 'bg-foreground/20 text-foreground/40 cursor-not-allowed'
            : 'bg-foreground text-background hover:opacity-80 cursor-pointer',
        )}
      >
        {isLoading ? 'Generating...' : 'Generate Code'}
      </button>

      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-md">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {generatedCode && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-foreground">Generated Code</label>
            <button
              onClick={handleInsertCode}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm font-medium transition-colors"
            >
              Insert into Editor
            </button>
          </div>
          <pre className="p-3 bg-background text-foreground rounded-md border border-foreground/20 overflow-auto text-sm">
            <code>{generatedCode}</code>
          </pre>
        </div>
      )}

      <div className="flex flex-col gap-2 mt-4 pt-4 border-t border-foreground/20">
        <h4 className="text-sm font-semibold text-foreground">Example Prompts:</h4>
        <ul className="text-xs text-foreground opacity-70 space-y-1 list-disc list-inside">
          <li>Create a drum pattern with syncopated hi-hats</li>
          <li>Make a jazzy chord progression in C minor</li>
          <li>Generate a fast arpeggio with reverb</li>
          <li>Create an ambient texture with stacked synths</li>
          <li>Make a breakbeat pattern with samples</li>
        </ul>
      </div>
    </div>
  );
}
