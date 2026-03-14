from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn
import os
import json
import io
import PIL.Image
from google import genai
from google.genai import types

# Import your custom modules
from agentic_ocr import N12ExtractionSchema, VISION_EXTRACTION_PROMPT
from evaluator import GeminiEvaluator

load_dotenv()

app = FastAPI(title="Tenant Defender API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =================================================================
# GLOBAL INITIALIZATION
# Load the legal context ONCE at startup to drop latency
# =================================================================
print("Initializing Tenant Defender CAG Engine...")
evaluator = GeminiEvaluator()
vision_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
print("Systems Online.")

@app.get("/health")
async def health_check():
    return {"status": "Strict-CAG Systems Online"}

@app.post("/analyze")
async def analyze_notice(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Must upload an image of the notice.")
    
    # 1. Read the uploaded image into memory
    try:
        image_bytes = await file.read()
        image = PIL.Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")
    
    # 2. Agentic OCR: Pass image to Gemini Vision to extract structured JSON
    try:
        vision_response = vision_client.models.generate_content(
            model='models/gemini-2.5-flash', 
            contents=[image, VISION_EXTRACTION_PROMPT],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=N12ExtractionSchema,
                temperature=0.0 # Force strict, deterministic extraction
            ),
        )
        extracted_data = json.loads(vision_response.text)
        print("--- EXTRACTED OCR DATA ---")
        print(json.dumps(extracted_data, indent=2))
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vision Extraction Failed: {str(e)}")
    
    # 3. Pass the strictly typed JSON into your CAG Evaluator
    try:
        evaluation_result = evaluator.evaluate_notice(extracted_data)
        return evaluation_result.model_dump()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Legal Evaluation Failed: {str(e)}")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)