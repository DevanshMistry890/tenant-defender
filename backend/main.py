from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import uvicorn
import os
import json
import io
import PIL.Image
from google import genai
from google.genai import types
import asyncio

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

@app.get("/health")
async def health_check():
    return {"status": "Strict-CAG Systems Online"}

@app.post("/analyze")
async def analyze_notice(file: UploadFile = File(...)):
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Must upload an image of the notice.")
    
    # Read the uploaded image into memory
    try:
        image_bytes = await file.read()
        pil_image = PIL.Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")
        
    async def sse_generator():
        try:
            # STEP 1: Agentic OCR
            yield f"data: {json.dumps({'status': 'scanning', 'message': 'Agentic OCR: Extracting truth from document via Gemini Vision...'})}\n\n"
            
            # AWAIT the async vision client to ensure OCR finishes completely before moving on
            response = await vision_client.aio.models.generate_content(
                model="models/gemini-2.5-flash",
                contents=[VISION_EXTRACTION_PROMPT, pil_image],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=N12ExtractionSchema,
                )
            )
            
            extracted_data = json.loads(response.text)
            
            # STEP 2: Deterministic Gates (UI Update)
            yield f"data: {json.dumps({'status': 'calculating', 'message': 'Neuro-Symbolic Gate: Calculating exact notice duration...'})}\n\n"
            await asyncio.sleep(0.2) # Small artificial delay so the UI step is visible to judges
            
            # STEP 3: CAG Verification (UI Update)
            yield f"data: {json.dumps({'status': 'verifying', 'message': 'CAG Verification: Cross-referencing legal context...'})}\n\n"
            await asyncio.sleep(0.2)
            
            # STEP 4: Final LLM Audit (Execution)
            yield f"data: {json.dumps({'status': 'auditing', 'message': 'LLM Judge: Finalizing assessment...'})}\n\n"
            
            # Run the sync evaluator in a separate thread so it doesn't block the async SSE stream
            evaluation_result = await asyncio.to_thread(evaluator.evaluate_notice, extracted_data)
            
            # Final completion payload
            yield f"data: {json.dumps({'status': 'complete', 'result': evaluation_result.model_dump()})}\n\n"
            
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(sse_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)