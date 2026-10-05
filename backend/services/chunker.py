def chunk_text(text, chunk_size=7000, overlap=300):
  chunks = []
  start = 0

  while start < len(text):
    chunks.append(text[start:start+chunk_size])
    start += chunk_size - overlap

  return chunks