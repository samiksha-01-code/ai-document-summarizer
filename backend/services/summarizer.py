import os
import time

from dotenv import load_dotenv
from groq import Groq

from .chunker import chunk_text

load_dotenv()

client = Groq(
    api_key=os.getenv("GROQ_API_KEY")
    )

MODEL = "openai/gpt-oss-120b"

system_prompt = """
You are an AI Document Summarizer.

Your job is to summarize the content of a document provided by the user.

Follow these rules:

1. Use ONLY the information present in the provided document.
2. Do not add facts, opinions, assumptions, or information from your own knowledge.
3. Do not invent or guess missing information.
4. Identify the main topic and purpose of the document.
5. Extract and summarize the most important information while preserving the original meaning.
6. Remove unnecessary repetition, filler, and irrelevant details.
7. Keep important names, dates, numbers, facts, technical terms, and conclusions accurate.
8. If the document contains multiple topics or sections, organize the summary accordingly.
9. If the document is very short, provide a concise summary rather than artificially expanding it.
10. If the document does not contain enough meaningful text to summarize, clearly state that.
11. If the document contains tables, lists, or structured information, preserve the important information in an understandable format.
12. Do not mention information that is not supported by the document.

Output format:

## Summary
Provide a clear summary of the document in a few paragraphs.

## Key Points
- Point 1
- Point 2
- Point 3
...

## Important Details
Include important dates, numbers, names, definitions, decisions, or conclusions when relevant.

## Conclusion
Briefly state the main takeaway of the document.

Adjust the length of the summary according to the document's length and complexity. Prioritize accuracy, clarity, and completeness over unnecessary detail.
"""


def summarize_chunk(chunk):
    response = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {
                        "role": "user",
                        "content": f"Summarize the following document:\n\n{chunk}"
                    }
                ]
            )

    return response.choices[0].message.content


def create_final_summary(section_summaries):
    combined_summary = "\n\n".join(section_summaries)

    # 3. Create final summary
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": f"""
Create one final summary from these section summaries.

Remove repetition and keep the most important information.

Section summaries:

{combined_summary}
"""
            }
        ]
    )

    final_summary = response.choices[0].message.content

    return final_summary



def summarize_document(content):

    if not content or not content.strip():
        raise ValueError("The document does not contain readable text.")

    chunks = chunk_text(content)

    print(f"Total chunks: {len(chunks)}")

    summaries = []

    # 1. Summarize every chunk
    for i, chunk in enumerate(chunks, 1):
        print(f"Summarizing chunk {i}/{len(chunks)}")

        try:
            summary = summarize_chunk(chunk)
            summaries.append(summary)

            print(f"Chunk {i} completed successfully.")

        except Exception as e:
            print(f"Chunk {i} failed: {e}")

        if i < len(chunks):
            time.sleep(5)

    if not summaries:
        raise ValueError("No document sections were successfully summarized.")

    return create_final_summary(summaries), len(chunks)