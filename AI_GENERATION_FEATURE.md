# Natural Language to Strudel Code Generation

## Overview

This feature allows users to convert natural language descriptions (e.g., "create a drum pattern with syncopated hi-hats") into Strudel code using AI. Users can choose between:
- **Google Gemini** - Direct access to Gemini Pro
- **OpenRouter** - Access to Claude, GPT-4, Llama, and many other models

The feature is implemented as a new panel tab in the REPL and is completely client-side.

## Implementation

### Files Created

1. **`website/src/repl/gemini.mjs`**
   - Core API integration utility supporting both Gemini and OpenRouter
   - `generateStrudelCode(prompt, options)` function
   - `generateWithGemini()` - Gemini API integration
   - `generateWithOpenRouter()` - OpenRouter API integration
   - Comprehensive Strudel system prompt with examples
   - Error handling and response parsing

2. **`website/src/repl/components/panel/AIGenerateTab.jsx`**
   - UI component for the AI generation panel
   - Features:
     - Provider selector (Gemini or OpenRouter)
     - API key input for selected provider (password field)
     - Model selector for OpenRouter (Claude 3.5, GPT-4, etc.)
     - Natural language prompt textarea
     - Generate button with loading state
     - Generated code preview
     - Insert into editor functionality
     - Error display
     - Example prompts for user guidance
     - Keyboard shortcut (Ctrl/Cmd+Enter to generate)

### Files Modified

1. **`website/src/settings.mjs`**
   - Added `geminiApiKey: ''` to `defaultSettings`
   - Added `openRouterApiKey: ''` to `defaultSettings`
   - Added `aiProvider: 'gemini'` to `defaultSettings`
   - Added `openRouterModel: 'anthropic/claude-3.5-sonnet'` to `defaultSettings`
   - All settings are automatically persisted to localStorage

2. **`website/src/repl/components/panel/Panel.jsx`**
   - Imported `AIGenerateTab` component
   - Added `ai: 'ai'` to `tabNames` object
   - Added case for `'ai'` in `PanelContent` switch statement

## How to Use

1. **Get an API Key**
   - **For Gemini**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey) - Free
   - **For OpenRouter**: Visit [OpenRouter](https://openrouter.ai/keys) - Pay-per-use

2. **Access the AI Panel**
   - Open Strudel REPL
   - Click on the "ai" tab in the panel

3. **Select Provider**
   - Choose between "Google Gemini" or "OpenRouter"
   - If using OpenRouter, select your preferred model (Claude 3.5 Sonnet, GPT-4, etc.)

4. **Generate Code**
   - Enter your API key (saved automatically)
   - Type a natural language prompt
   - Click "Generate Code" or press Ctrl+Enter (Cmd+Enter on Mac)
   - Review the generated code
   - Click "Insert into Editor" to add it to your code

## Example Prompts

- Create a drum pattern with syncopated hi-hats
- Make a jazzy chord progression in C minor
- Generate a fast arpeggio with reverb
- Create an ambient texture with stacked synths
- Make a breakbeat pattern with samples

## Technical Details

### API Integration

**Gemini:**
- **Endpoint**: `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent`
- **Model**: gemini-pro
- **Temperature**: 0.7
- **Max Output Tokens**: 1024

**OpenRouter:**
- **Endpoint**: `https://openrouter.ai/api/v1/chat/completions`
- **Models**: Claude 3.5 Sonnet, GPT-4, Llama 3.1, and more
- **Temperature**: 0.7
- **Max Tokens**: 1024
- Supports multiple AI models through a unified API

### System Prompt

The implementation includes a comprehensive system prompt that teaches Gemini about:
- Mini-notation basics
- Pattern modulation functions
- Rhythm and timing
- Effects (reverb, delay, filters, etc.)
- Pattern transformations
- Melodic patterns
- Common sample names

### Code Insertion

The generated code is inserted into the editor using:
```javascript
context.editorRef.current.setCode(code)
```

If there's existing code, the new code is appended with a comment separator.

### Error Handling

- Invalid API key detection
- Empty prompt validation
- Network error handling
- API response parsing with fallbacks
- User-friendly error messages

## Security

- API keys are stored locally in browser localStorage
- Input fields use password type for key entry
- No server-side storage of API keys
- Completely client-side implementation
- Both Gemini and OpenRouter keys are kept separate and secure

## Development Notes

- Uses existing Strudel UI patterns and components
- Follows the codebase styling conventions
- Integrates seamlessly with existing panel system
- No new dependencies required
- Fully typed with JSDoc comments

## Testing

To test the feature:

1. Start the dev server:
   ```bash
   cd /Users/mehmetbattal/Desktop/projects/strudel-collab
   pnpm dev
   ```

2. Open the REPL in your browser
3. Navigate to the "ai" panel tab
4. Enter your Gemini API key
5. Try various prompts and verify code generation
6. Test the "Insert into Editor" functionality
7. Verify error handling with invalid API keys

## Available Models (OpenRouter)

The OpenRouter integration provides access to:
- **Claude 3.5 Sonnet** - Anthropic's most capable model
- **Claude 3 Opus** - Previous flagship model
- **Claude 3 Haiku** - Fast and efficient
- **GPT-4 Turbo** - OpenAI's latest GPT-4
- **GPT-4** - Standard GPT-4
- **GPT-3.5 Turbo** - Fast and affordable
- **Gemini Pro 1.5** - Google's model via OpenRouter
- **Llama 3.1 70B** - Meta's open-source model

## Future Enhancements

Potential improvements:
- Add API key configuration in Settings tab
- History of generated code
- Ability to refine/iterate on generated code
- Context-aware generation based on existing code
- Code explanation feature (reverse direction)
- Templates for common patterns
- Support for streaming responses
- Cost tracking for OpenRouter usage

