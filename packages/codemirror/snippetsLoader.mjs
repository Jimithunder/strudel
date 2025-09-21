import { parseSnippetsFile } from './snippetsParser.mjs';

export async function loadSnippets(path = '/snippets.sps') {
  try {
    const response = await fetch(path);
    if (!response.ok) {
      return [];
    }
    const content = await response.text();
    const snippets = parseSnippetsFile(content);
    return snippets;
  } catch (error) {
    return [];
  }
}
