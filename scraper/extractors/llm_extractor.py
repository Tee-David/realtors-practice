import json
from typing import Any, Optional
from google import genai
from pydantic import BaseModel

from config import config
from utils.logger import get_logger

logger = get_logger(__name__)

# Fallback to LLM extraction if universal extractor fails
# Uses Gemini to parse raw HTML text or description

class PropertyExtracted(BaseModel):
    title: str | None
    price_text: str | None
    description: str | None
    location_text: str | None
    bedrooms: int | None
    bathrooms: int | None
    toilets: int | None
    parkingSpaces: int | None
    features_text: str | None


def extract_with_llm(raw_text: str, current_data: dict[str, Any]) -> dict[str, Any]:
    """Uses Gemini to extract missing fields from raw text."""
    # We only want to use this if Gemini API key is configured
    import os
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("GEMINI_API_KEY not set. Skipping LLM extraction.")
        return current_data

    try:
        client = genai.Client(api_key=api_key)
        
        prompt = f"""
        Extract property details from the following raw text scraped from a real estate website.
        We already have some data extracted, but we are missing reliable fields.
        Please return a strictly formatted JSON object with the requested fields. If a field is not found or cannot be determined, return null.

        Current Data (do not override unless obviously wrong):
        {json.dumps(current_data, indent=2)}

        Raw Text:
        ---
        {raw_text[:8000]} # Limit to first 8000 chars to save tokens
        ---

        Return a JSON matching this schema:
        {{
            "title": "Full property title",
            "price_text": "Price string exactly as found (e.g. 5 Million NGN)",
            "description": "Full property description",
            "location_text": "Full location string (e.g. Lekki Phase 1, Lagos)",
            "bedrooms": int or null,
            "bathrooms": int or null,
            "toilets": int or null,
            "parkingSpaces": int or null,
            "features_text": "Comma separated list of amenities/features"
        }}
        """

        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt,
        )
        
        # Parse the JSON response
        try:
            # Strip markdown formatting if any
            text = response.text.replace("```json", "").replace("```", "").strip()
            extracted = json.loads(text)
            
            # Merge with current data
            for key, val in extracted.items():
                if val is not None and not current_data.get(key):
                    current_data[key] = val
                    
        except json.JSONDecodeError:
            logger.error("Failed to parse LLM response as JSON")
            
    except Exception as e:
        logger.error(f"LLM extraction failed: {str(e)}")

    return current_data
