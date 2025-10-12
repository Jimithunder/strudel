/**
 * AI API Integration for Natural Language to Strudel Code Conversion
 * Supports Gemini and OpenRouter
 */

const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
const OPENROUTER_API_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * System prompt that teaches Gemini about Strudel syntax
 */
const STRUDEL_SYSTEM_PROMPT = `You are an expert at Strudel, a live coding language for music. 
Convert natural language descriptions into valid Strudel code.

IMPORTANT RULES:
1. Return ONLY the Strudel code, no explanations or markdown
2. Do NOT wrap the code in backticks or code blocks
3. Use proper Strudel syntax

Strudel Syntax Examples:

BASIC PATTERNS:
- Drums: sound("bd sd cp sd")
- Notes: note("c3 eb3 g3")
- Stack patterns: stack(sound("bd sd"), note("c a f e").s("piano"))

RHYTHM & TIMING:
- Fast: sound("bd sd").fast(2)
- Slow: sound("bd sd").slow(2)
- Every N cycles: sound("bd sd").every(4, x => x.fast(2))
- Euclidean rhythms: sound("bd(3,8)")

EFFECTS:
- Reverb: sound("bd sd").room(0.5).size(0.8)
- Delay: sound("bd sd").delay(0.5).delaytime(0.25).delayfeedback(0.6)
- Filter: sound("bd sd").lpf(1000).lpq(10)
- Pan: sound("bd sd").pan("0 0.5 1")
- Gain: sound("bd sd").gain(0.8)

PATTERN TRANSFORMATIONS:
- Reverse: sound("bd sd cp sd").rev()
- Rotation: sound("bd sd cp sd").rotate(1)
- Degradation: sound("bd sd cp sd").degrade(0.5)
- Speed: sound("bd sd").speed(1.5)

MELODIC PATTERNS:
- Scales: note("0 2 4 7").scale("C:minor").s("piano")
- Chords: note("c'maj7 f'maj7 g'maj7").s("piano")
- Arpeggios: note("c e g c5").s("sawtooth")

MINI-NOTATION:
- Rests: sound("bd ~ cp ~")
- Repeats: sound("bd!3 sd")
- Groups: sound("[bd sd] cp")
- Alternate: sound("bd <sd cp>")
- Random choice: sound("bd [sd|cp|hh]")

COMMON SAMPLES:
Drums: bd, sd, cp, hh, oh, ch, mt, lt, ht, rim, clap, kick
Percussion: tabla, metal, hand, casio
Other: jazz, amencutup, bass, arpy, numbers

Example Drum Pattern:
sound("bd sd [~ bd] sd, hh*8").fast(1.5)

Example Melody:
note("c a f e").scale("C:minor").s("piano").lpf(2000)

Example Synth Bass:
note("c2 eb2 g2 bb2").s("sawtooth").lpf(800).room(0.3)`;

/**
 * Generate Strudel code using OpenRouter API
 * @param {string} prompt - Natural language description
 * @param {string} apiKey - OpenRouter API key
 * @param {string} model - Model to use (e.g., 'anthropic/claude-3.5-sonnet')
 * @returns {Promise<string>} - Generated Strudel code
 * @throws {Error} - If API call fails
 */
async function generateWithOpenRouter(prompt, apiKey, model) {
  const requestBody = {
    model: model,
    messages: [
      {
        role: 'system',
        content: STRUDEL_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `${prompt}\n\nGenerate Strudel code (code only, no explanation):`,
      },
    ],
    temperature: 0.7,
    max_tokens: 1024,
  };

  const response = await fetch(OPENROUTER_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'Strudel AI Generator',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || response.statusText;

    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your OpenRouter API key.');
    }

    throw new Error(`OpenRouter API error: ${errorMessage}`);
  }

  const data = await response.json();

  // Extract the generated text from OpenRouter response
  const generatedText = data.choices?.[0]?.message?.content;

  if (!generatedText) {
    throw new Error('No code generated. Please try a different prompt.');
  }

  return generatedText;
}

/**
 * Generate Strudel code using Gemini API
 * @param {string} prompt - Natural language description
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<string>} - Generated Strudel code
 * @throws {Error} - If API call fails
 */
async function generateWithGemini(prompt, apiKey) {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('API key is required. Get one from https://aistudio.google.com/app/apikey');
  }

  if (!prompt || prompt.trim() === '') {
    throw new Error('Prompt cannot be empty');
  }

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `${STRUDEL_SYSTEM_PROMPT}\n\nUser request: ${prompt}\n\nGenerate Strudel code (code only, no explanation):`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
  };

  try {
    const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;
      
      if (response.status === 400 && errorMessage.includes('API_KEY_INVALID')) {
        throw new Error('Invalid API key. Please check your Gemini API key.');
      }
      
      throw new Error(`Gemini API error: ${errorMessage}`);
    }

    const data = await response.json();

    // Extract the generated text from Gemini response
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!generatedText) {
      throw new Error('No code generated. Please try a different prompt.');
    }

    return generatedText;
  } catch (error) {
    if (error.message) {
      throw error;
    }
    throw new Error(`Failed to generate code: ${error.toString()}`);
  }
}

/**
 * Generate Strudel code from a natural language prompt
 * @param {string} prompt - Natural language description
 * @param {Object} options - Generation options
 * @param {string} options.provider - 'gemini' or 'openrouter'
 * @param {string} options.apiKey - API key for the selected provider
 * @param {string} [options.model] - Model to use (for OpenRouter)
 * @returns {Promise<string>} - Generated Strudel code
 * @throws {Error} - If API call fails
 */
export async function generateStrudelCode(prompt, options) {
  const { provider, apiKey, model } = options;

  if (!apiKey || apiKey.trim() === '') {
    const linkText =
      provider === 'openrouter'
        ? 'https://openrouter.ai/keys'
        : 'https://aistudio.google.com/app/apikey';
    throw new Error(`API key is required. Get one from ${linkText}`);
  }

  if (!prompt || prompt.trim() === '') {
    throw new Error('Prompt cannot be empty');
  }

  let generatedText;

  try {
    if (provider === 'openrouter') {
      generatedText = await generateWithOpenRouter(prompt, apiKey, model);
    } else {
      generatedText = await generateWithGemini(prompt, apiKey);
    }

    // Clean up the response - remove markdown code blocks if present
    let code = generatedText.trim();
    code = code.replace(/^```(?:javascript|js|strudel)?\n?/gm, '');
    code = code.replace(/\n?```$/gm, '');
    code = code.trim();

    return code;
  } catch (error) {
    if (error.message) {
      throw error;
    }
    throw new Error(`Failed to generate code: ${error.toString()}`);
  }
}

