"""Module for multimodal extraction of structured data from eviction notices.

This schema forces the Vision-Language Model to output strictly typed JSON,
which is then passed to the deterministic logic gates.
"""

from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import date

VISION_EXTRACTION_PROMPT = """
You are a highly precise legal document extraction AI. Your sole job is to read the provided image of an Ontario Landlord and Tenant Board (LTB) eviction notice and extract the fields required by the schema.

CRITICAL INSTRUCTIONS:
1. DO NOT guess or infer missing information. If a field is illegible or missing, output null or an empty string.
2. DATES: Look for the 'Termination Date' (usually prominently displayed as the move-out date) and the 'Notice Date' (usually at the very bottom next to the signature). Format as YYYY-MM-DD.
3. MUNICIPALITY: Read the 'Rental Unit Address' block carefully. Extract the city name (e.g., Kitchener, Waterloo, Toronto) into the municipality field. 
4. REASON: Look at the checkboxes. Identify exactly which reason for eviction the landlord selected.
5. COMPENSATION: Look for a checked box indicating the landlord will pay the tenant an amount equal to one month's rent. If checked, set compensation_indicated to true.
"""

class ReasonForEviction(BaseModel):
    """Captures the specific checkbox the landlord selected."""
    category: str = Field(
        description="Must be 'Landlord/Family Use' or 'Purchaser Use'."
    )
    specific_individual: Optional[str] = Field(
        description="E.g., 'Landlord's child', 'Purchaser', 'Caregiver'."
    )

class N12ExtractionSchema(BaseModel):
    """Strict schema for extracting data from an Ontario N12 Form."""
    
    tenant_names: List[str] = Field(
        description="List of all tenants named on the notice."
    )
    landlord_names: List[str] = Field(
        description="List of all landlords named on the notice."
    )
    rental_address: str = Field(
        description="The full address of the rental unit. Pay close attention to unit numbers."
    )
    municipality: str = Field(
        description="Extract the city/municipality from the address (e.g., 'Kitchener')."
    )
    termination_date: date = Field(
        description="The date the landlord wants the tenant to move out (YYYY-MM-DD)."
    )
    notice_date: date = Field(
        description="The date the notice was signed/dated at the bottom (YYYY-MM-DD)."
    )
    eviction_reason: ReasonForEviction = Field(
        description="The specific reason checked on the form."
    )
    compensation_indicated: bool = Field(
        description="Did the landlord check the box indicating they will pay 1 month's rent?"
    )
    is_signed: bool = Field(
        description="Is there a physical or electronic signature at the bottom?"
    )