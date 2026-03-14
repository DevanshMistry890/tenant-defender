"""Module for evaluating eviction notices against strict legal contexts.

This module implements a Strict Context-Augmented Generation (CAG) pipeline.
It defines an abstract evaluator and concrete implementations for both
mock testing and the production Gemini API.
"""

import os
import json
import pdfplumber
from abc import ABC, abstractmethod
from typing import Dict, Any, List
from pydantic import BaseModel
from google import genai
from google.genai import types
from agentic_ocr import N12ExtractionSchema

class BoundingBox(BaseModel):
    """Represents a normalized bounding box [ymin, xmin, ymax, xmax]."""
    ymin: float
    xmin: float
    ymax: float
    xmax: float

class Flaw(BaseModel):
    """Represents a procedural or legal flaw found in an eviction notice."""
    description: str
    citation: str
    severity: str
    flaw_type: str = "advisory"  # "deterministic", "advisory", or "fact"
    bounding_box: BoundingBox | None = None

class EvaluationResult(BaseModel):
    """The structured result of a Strict-CAG evaluation."""
    is_likely_invalid: bool
    fatal_flaws: List[Flaw]
    recommendation_script: str

class LegalEvaluator(ABC):
    """Abstract base class for legal evaluation engines."""
    
    def run_deterministic_checks(self, extracted_data: N12ExtractionSchema) -> List[Flaw]:
        """Runs deterministic math and routing checks on extracted fields."""
        flaws = []
        
        # Helper to safely parse bounding boxes from the vision model
        def get_box(box_list):
            if box_list and len(box_list) == 4:
                return BoundingBox(ymin=box_list[0], xmin=box_list[1], ymax=box_list[2], xmax=box_list[3])
            return None

        sig_box = get_box(extracted_data.signature_bounding_box)
        date_box = get_box(extracted_data.termination_date_bounding_box)
        address_box = get_box(extracted_data.address_bounding_box)
        
        # The 60-Day Rule
        if (extracted_data.termination_date - extracted_data.notice_date).days < 60:
            flaws.append(Flaw(
                description="Termination date is less than 60 days from notice date.",
                citation="RTA s.43(1) - Minimum 60 days notice required",
                severity="high",
                flaw_type="deterministic",
                bounding_box=date_box
            ))
            
        # The Corporate Bad-Faith Trap
        if extracted_data.reason_1_checked and extracted_data.is_corporate_landlord:
            flaws.append(Flaw(
                description=f"A corporation ({extracted_data.landlord_name}) is not permitted to give a notice of termination for personal use.",
                citation="RTA s.48(5) - Corporate landlord prohibition",
                severity="high",
                flaw_type="deterministic",
                bounding_box=sig_box 
            ))
            
        # The Kitchener Trap
        if "kitchener" in extracted_data.municipality.lower():
            flaws.append(Flaw(
                description="Landlord may not possess a valid municipal lodging license.",
                citation="Kitchener By-law COR-2024-233 - Verify landlord possesses a valid Shared Accommodation license.",
                severity="medium",
                flaw_type="advisory",
                bounding_box=address_box
            ))
            
        return flaws

    @abstractmethod
    def evaluate_notice(self, extracted_fields: Dict[str, Any]) -> EvaluationResult:
        """Evaluates extracted notice fields against legal context."""
        pass

class MockEvaluator(LegalEvaluator):
    """A mock evaluator for frontend UI testing."""
    
    def evaluate_notice(self, extracted_fields: Dict[str, Any]) -> EvaluationResult:
        schema_data = N12ExtractionSchema(**extracted_fields)
        deterministic_flaws = self.run_deterministic_checks(schema_data)
        
        mock_ai_flaws = [
            Flaw(
                description="Verification required regarding the 'personal use' declaration.",
                citation="RTA s.48(1)",
                severity="medium"
            )
        ]
        
        all_flaws = deterministic_flaws + mock_ai_flaws
        
        return EvaluationResult(
            is_likely_invalid=len(all_flaws) > 0,
            fatal_flaws=all_flaws,
            recommendation_script=f"Notice dated {schema_data.notice_date} appears invalid."
        )

# =================================================================
# FUTURE PRODUCTION SCALING: ADAPTIVE PARALLEL ENCODING (APE)
# =================================================================
# For the hackathon demo, we inject text directly into the prompt.
# For production, we will use Gemini Context Caching to pre-compute 
# the KV states of massive legal documents, achieving near-zero latency.
# It is only available with gemini 3.1 Pro models with advanced billing.
#
# def _setup_context_cache(self):
#     """Uploads and caches the legal framework on Google's servers."""
#     print("Uploading RTA and Kitchener Bylaws to Context Cache...")
#     document = self.client.files.upload(file="data/ontario_rta_2006.pdf")
#     
#     # Create a cache with a 1-hour TTL (Time To Live)
#     self.cached_context = self.client.caches.create(
#         model="models/gemini-3.1-pro", # Caching requires latest
#         contents=[
#             document, 
#             "You are Tenant Defender—a strict, citation-only legal evaluation engine."
#         ],
#         config=types.CreateCachedContentConfig(
#             ttl="3600s",
#             display_name="tenant_law_cache"
#         )
#     )
#     print(f"Cache created! Name: {self.cached_context.name}")
#
# # In evaluate_notice(), the call would change to:
# # response = self.client.models.generate_content(
# #     model="models/gemini-3.1-pro",
# #     contents=prompt,
# #     config=types.GenerateContentConfig(
# #         cached_content=self.cached_context.name,
# #         response_mime_type="application/json",
# #         response_schema=EvaluationResult,
# #     )
# # )
# =================================================================

class GeminiEvaluator(LegalEvaluator):
    """Production engine utilizing Gemini's massive context window (No API Caching)."""
    
    def __init__(self):
        # Initialize client; expects GEMINI_API_KEY in environment
        self.client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
        
        # Load the legal PDFs directly into active memory
        self.rta_text = self._load_legal_text("data/ontario_rta_2006.pdf")
        self.bylaw_text = self._load_legal_text("data/kitchener_shared_accommodation_bylaw.pdf")
        
        self.system_instruction = f"""
        You are Tenant Defender—a strict, citation-only legal evaluation engine.
        
        LEGAL CONTEXT (ONTARIO RTA & KITCHENER BY-LAWS):
        {self.rta_text}
        {self.bylaw_text}
        
        CRITICAL RULES:
        1. ONLY use the provided legal context above.
        2. Every claim MUST end with an exact statutory citation.
        3. Output ONLY valid JSON matching the EvaluationResult schema.
        4. For every flaw identified, set `flaw_type` to "advisory".
        """

    def _load_legal_text(self, path: str) -> str:
        """Extracts text from PDF files for prompt injection."""
        text = ""
        try:
            with pdfplumber.open(path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
        except Exception as e:
            print(f"Error loading {path}: {e}")
        return text

    def evaluate_notice(self, extracted_fields: dict) -> EvaluationResult:
        """Executes the evaluation using standard Context-Augmented Generation."""
        # 1. Run deterministic math/routing checks first
        schema_data = N12ExtractionSchema(**extracted_fields)
        deterministic_flaws = self.run_deterministic_checks(schema_data)
        
        # 2. Prepare the payload
        prompt = f"Evaluate this extracted eviction notice data:\n{json.dumps(extracted_fields, indent=2)}"
        
        # 3. Hit the standard generation endpoint
        response = self.client.models.generate_content(
            model="models/gemini-3.1-flash-lite-preview", 
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=self.system_instruction,
                response_mime_type="application/json",
                response_schema=EvaluationResult,
            )
        )
        
        # 4. Parse response and merge
        llm_result_dict = json.loads(response.text)
        llm_flaws = [Flaw(**f) for f in llm_result_dict.get("fatal_flaws", [])]
        
        total_flaws = deterministic_flaws + llm_flaws
        
        return EvaluationResult(
            is_likely_invalid=any(f.flaw_type == "deterministic" or f.severity == "high" for f in total_flaws),
            fatal_flaws=total_flaws,
            recommendation_script=llm_result_dict.get("recommendation_script", "")
        )