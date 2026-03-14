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
2. DATES: Look for the 'Termination Date' and the 'Notice Date'. Format as YYYY-MM-DD.
3. MUNICIPALITY: Extract the city name into the municipality field. 
4. REASON: Identify exactly which reason for eviction the landlord selected.
5. REASON 1: If the landlord checked 'Reason 1', set reason_1_checked to true.
6. LANDLORD NAME & ENTITY: Extract the landlord's name from the signature block. If it implies a business entity, set is_corporate_landlord to true.
7. SPATIAL BOUNDING BOXES: You must locate specific elements on the document and return their bounding boxes as exactly 4 floats between 0.0 and 1.0 in the format [ymin, xmin, ymax, xmax].
   - signature_bounding_box: The landlord's signature block on Page 2.
   - termination_date_bounding_box: The termination date ("move out" date) on Page 1.
   - address_bounding_box: The Rental Unit Address block on Page 1.
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
    landlord_name: str = Field(
        description="The name of the landlord or company listed in the signature block on Page 2."
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
    reason_1_checked: bool = Field(
        description="True if Reason 1 (personal use) is checked."
    )
    is_corporate_landlord: bool = Field(
        description="True if the landlord_name contains Inc, Corp, Ltd, LLC, or implies a business entity."
    )
    is_signed: bool = Field(
        description="Is there a physical or electronic signature at the bottom?"
    )
    signature_bounding_box: Optional[List[float]] = Field(
        default=None,
        description="The bounding box of the landlord signature block. Must be exactly 4 floats between 0.0 and 1.0: [ymin, xmin, ymax, xmax]."
    )
    termination_date_bounding_box: Optional[List[float]] = Field(
        default=None,
        description="The bounding box of the termination date on the notice. Must be exactly 4 floats between 0.0 and 1.0: [ymin, xmin, ymax, xmax]."
    )
    address_bounding_box: Optional[List[float]] = Field(
        default=None,
        description="The bounding box of the rental unit address block. Must be exactly 4 floats between 0.0 and 1.0: [ymin, xmin, ymax, xmax]."
    )