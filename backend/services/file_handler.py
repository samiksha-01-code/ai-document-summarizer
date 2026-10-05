from pathlib import Path
from pypdf import PdfReader
from docx import Document
import csv

def extract_text(file_path):
  with open(file_path, "r", encoding="utf-8") as file:
    content = file.read()

  return content


def extract_pdf(file_path):
  reader = PdfReader(file_path)

  content = []

  for page in reader.pages:
    text = page.extract_text() or ""
    content.append(text)

  return "\n".join(content)


def extract_docx(file_path):
  document = Document(file_path)

  content = []

  for paragraph in document.paragraphs:
    content.append(paragraph.text)

  return "\n".join(content)


def extract_csv(file_path):
  content = []

  with open(file_path, "r", encoding="utf-8-sig", newline="") as file:
    reader = csv.reader(file)

    for row in reader:
      content.append(", ".join(row))

  return "\n".join(content)



from pathlib import Path

def extract_content(file_path):

  path = Path(file_path)

  extension = path.suffix.lower()

  if extension == ".pdf":
    return extract_pdf(path)

  elif extension == ".docx":
    return extract_docx(path)

  elif extension == ".csv":
    return extract_csv(path)

  elif extension == ".txt":
    return extract_text(path)

  else:
    raise ValueError(
        f"Unsupported file format : {extension}"
    )
