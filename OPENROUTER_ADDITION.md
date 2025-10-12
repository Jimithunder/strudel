# OpenRouter Support Addition

## Summary

Extended the AI code generation feature to support OpenRouter in addition to Google Gemini, giving users access to multiple AI models including Claude 3.5 Sonnet, GPT-4, and more.

## What Was Added

### New Settings (website/src/settings.mjs)

```javascript
{
  openRouterApiKey: '',
  aiProvider: 'gemini', // 'gemini' or 'openrouter'
  openRouterModel: 'anthropic/claude-3.5-sonnet',
}
```

### Updated API Integration (website/src/repl/gemini.mjs)

1. **New `generateWithOpenRouter()` function**
   - OpenRouter API endpoint integration
   - Supports chat completions format
   - Handles model selection
   - Proper headers for OpenRouter (Authorization, HTTP-Referer, X-Title)

2. **Refactored `generateStrudelCode()` function**
   - Now accepts an options object: `{ provider, apiKey, model }`
   - Dispatches to appropriate provider function
   - Unified error handling and code cleaning

### Enhanced UI (website/src/repl/components/panel/AIGenerateTab.jsx)

1. **Provider Selector**
   - Dropdown to choose between Gemini and OpenRouter
   - Dynamically shows appropriate API key field

2. **Model Selector (OpenRouter only)**
   - Dropdown with 8 popular models:
     - Claude 3.5 Sonnet (default)
     - Claude 3 Opus
     - Claude 3 Haiku
     - GPT-4 Turbo
     - GPT-4
     - GPT-3.5 Turbo
     - Gemini Pro 1.5 (via OpenRouter)
     - Llama 3.1 70B

3. **Separate API Key Storage**
   - Gemini API key stored separately from OpenRouter key
   - Both persisted to localStorage
   - Provider selection also persisted

## User Benefits

### With Gemini (Free)
- No cost for API usage
- Good quality code generation
- Simple setup with Google account

### With OpenRouter (Pay-per-use)
- Access to Claude 3.5 Sonnet (often considered best for code)
- Access to GPT-4 and other premium models
- Unified API for multiple providers
- Flexible model selection based on needs/budget
- Pay only for what you use

## How Users Can Switch Between Providers

1. **Try Gemini First (Free)**
   ```
   1. Get free API key from Google AI Studio
   2. Select "Google Gemini" as provider
   3. Enter API key and generate code
   ```

2. **Upgrade to OpenRouter for Better Results**
   ```
   1. Get API key from OpenRouter (requires credit)
   2. Select "OpenRouter" as provider
   3. Choose desired model (Claude 3.5 Sonnet recommended)
   4. Enter API key and generate code
   ```

3. **Settings Are Saved**
   - Last used provider is remembered
   - API keys are saved separately
   - Model selection is saved

## Implementation Details

### API Request Format

**Gemini:**
```javascript
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key={apiKey}
{
  contents: [{
    parts: [{ text: systemPrompt + userPrompt }]
  }],
  generationConfig: { temperature: 0.7, ... }
}
```

**OpenRouter:**
```javascript
POST https://openrouter.ai/api/v1/chat/completions
Headers: {
  Authorization: Bearer {apiKey},
  HTTP-Referer: {origin},
  X-Title: "Strudel AI Generator"
}
{
  model: "anthropic/claude-3.5-sonnet",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt }
  ],
  temperature: 0.7,
  max_tokens: 1024
}
```

### Error Handling

- Invalid API key detection for both providers
- Provider-specific error messages
- Fallback error handling
- User-friendly error display

### Code Cleaning

Both providers' responses go through the same cleaning process:
- Remove markdown code blocks (```javascript, ```js, etc.)
- Trim whitespace
- Ensure only code is returned

## Testing Checklist

- [ ] Gemini provider works with valid API key
- [ ] OpenRouter provider works with valid API key
- [ ] Provider selection switches UI correctly
- [ ] Model selection works for OpenRouter
- [ ] API keys are saved to localStorage
- [ ] Settings persist across page reloads
- [ ] Error messages are clear and helpful
- [ ] Generated code inserts correctly
- [ ] Multiple models can be tested (Claude, GPT-4, etc.)

## Cost Considerations

### Gemini
- **Free tier**: 15 requests per minute
- **Cost**: Free for most use cases
- **Best for**: Testing, casual use

### OpenRouter
- **Pricing varies by model**:
  - Claude 3.5 Sonnet: ~$3 per 1M input tokens, ~$15 per 1M output tokens
  - GPT-4: ~$30 per 1M input tokens, ~$60 per 1M output tokens
  - GPT-3.5 Turbo: ~$0.50 per 1M input tokens, ~$1.50 per 1M output tokens
- **Best for**: Production use, when quality is important

## Recommended Usage

1. **Start with Gemini** - It's free and works well
2. **Upgrade to OpenRouter + Claude 3.5** - For best code quality
3. **Use GPT-3.5 Turbo via OpenRouter** - For cost-effective frequent use
4. **Try different models** - Each has strengths

## Files Modified

1. `website/src/settings.mjs` - Added 3 new settings
2. `website/src/repl/gemini.mjs` - Added OpenRouter support, refactored
3. `website/src/repl/components/panel/AIGenerateTab.jsx` - Complete UI overhaul
4. `AI_GENERATION_FEATURE.md` - Updated documentation

## No Breaking Changes

- Existing Gemini functionality preserved
- Settings default to Gemini for existing users
- Backward compatible with previous implementation

