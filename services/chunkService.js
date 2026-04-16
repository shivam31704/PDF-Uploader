 function splitText(text) {

  const chunkSize = 800;
  const overlap = 200;

  const chunks = [];

  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  return chunks;
}

module.exports = splitText;