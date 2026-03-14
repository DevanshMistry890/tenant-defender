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

class Flaw(BaseModel):
    """Represents a procedural or legal flaw found in an eviction notice."""
    description: str
    citation: str
    severity: str

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
        
        # The 60-Day Rule
        if (extracted_data.termination_date - extracted_data.notice_date).days < 60:
            flaws.append(Flaw(
                description="Termination date is less than 60 days from notice date.",
                citation="RTA s.43(1) - Minimum 60 days notice required",
                severity="high"
            ))
            
        # The Compensation Rule
        if not extracted_data.compensation_indicated:
            flaws.append(Flaw(
                description="Landlord failed to indicate they will compensate the tenant.",
                citation="RTA s.48.1 - Landlord must compensate tenant an amount equal to one month's rent",
                severity="high"
            ))
            
        # The Kitchener Trap
        if "kitchener" in extracted_data.municipality.lower():
            flaws.append(Flaw(
                description="Landlord may not possess a valid municipal lodging license.",
                citation="Kitchener By-law COR-2024-233 - Verify landlord possesses a valid Shared Accommodation license.",
                severity="medium"
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
            is_likely_invalid=len(total_flaws) > 0,
            fatal_flaws=total_flaws,
            recommendation_script=llm_result_dict.get("recommendation_script", "")
        )