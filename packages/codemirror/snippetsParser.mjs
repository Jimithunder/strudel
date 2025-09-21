export function parseSnippetsFile(content) {
  const snippets = [];
  const snippetBlocks = content.split('// --').filter((block) => block.trim());

  for (let i = 0; i < snippetBlocks.length - 1; i += 2) {
    const headerBlock = snippetBlocks[i].trim();
    const contentBlock = snippetBlocks[i + 1].trim();
    const lines = headerBlock.split('\n');
    let name = '';
    let doc = '';
    for (let line of lines) {
      const keyMatch = line.match(/\/\/\s*key:\s*(.*)/);
      if (keyMatch) {
        name = keyMatch[1].trim();
      }
      const docMatch = line.match(/\/\/\s*doc:\s*(.*)/);
      if (docMatch) {
        const docText = docMatch[1].trim();
        doc = doc ? doc + '\n' + docText : docText;
      }
    }
    if (name) {
      snippets.push({
        name,
        doc,
        content: contentBlock,
      });
    }
  }
  return snippets;
}
