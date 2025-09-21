import { Autocomplete } from './autocomplete.mjs';
import { loadSnippets } from './snippetsLoader.mjs';

let snippetsCache = null;

async function getSnippets() {
  if (!snippetsCache) {
    snippetsCache = await loadSnippets();
  }
  return snippetsCache;
}

export const snippetsAutocomplete = async (context) => {
  let word = context.matchBefore(/\w*/);
  if (word.from == word.to && !context.explicit) return null;

  const snippets = await getSnippets();
  if (!snippets.length) return null;

  const completions = snippets.map((snippet) => ({
    label: snippet.name,
    type: 'snippet',
    info: () =>
      Autocomplete({
        name: snippet.name,
        description: snippet.doc || `Snippet for ${snippet.name}`,
        examples: [snippet.content],
      }),
    apply: snippet.content,
  }));

  return {
    from: word.from,
    options: completions,
  };
};
