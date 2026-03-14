# 🏛️ Tenant Defender
### Strict-CAG Legal Evaluation Engine for Ontario Renters

![Hackathon: GenAI Genesis 2026](https://img.shields.io/badge/Hackathon-GenAI_Genesis_2026-blueviolet)
![Stack](https://img.shields.io/badge/Stack-Next.js_14_%7C_FastAPI_%7C_Python-000000)
![AI Engine](https://img.shields.io/badge/AI_Engine-Gemini_2.5_Flash-blue)
![Architecture](https://img.shields.io/badge/Architecture-Strict_CAG-success)

> **Built for the GenAI Genesis 2026 Hackathon**
> *Empowering vulnerable renters with zero-hallucination, citation-backed legal defense against bad-faith evictions.*

---

## 📖 Overview

When a tenant receives an N12 eviction notice, they are often panicked, unaware of their rights, and unable to afford immediate legal counsel. While standard LLMs can offer generic advice, they notoriously **hallucinate dates, math, and specific statutory citations**—making them dangerous for real legal defense.

**Tenant Defender** solves this by implementing a **Strict Context-Augmented Generation (Strict-CAG)** architecture. It combines the multimodal extraction power of Vision-Language Models with the mathematical certainty of deterministic Python logic, wrapped in a 1-Million token context window containing the exact text of the Ontario Residential Tenancies Act (RTA) and local municipal bylaws.

### 🚀 Key Capabilities

* **👁️ Agentic OCR:** Uses Gemini 2.5 Flash's multimodal capabilities to visually scan messy, photographed eviction notices and force the extraction into a strict, validated Pydantic JSON schema.
* **🧮 Deterministic Pre-Processing:** Bypasses LLM math hallucinations entirely. The Python backend calculates termination notice periods (the "60-day rule") and routes municipal bylaws (e.g., Kitchener's Shared Accommodation License) before the AI even reads the law.
* **📚 1M-Token Legal Context:** Injects 350,000+ characters of the Ontario RTA and local municipal codes directly into the active memory of the LLM, forcing the model to evaluate the notice exclusively against provided statutes.
* **⚖️ Citation-Only Constraints:** Generates a strict "Evaluation Report" where every identified procedural flaw must be backed by an exact, quoted legal citation.

---

## 🛠️ Architecture & Tech Stack

```mermaid
sequenceDiagram
    participant User as Next.js UI
    participant API as FastAPI Backend
    participant OCR as Gemini Vision (Agentic OCR)
    participant Logic as Deterministic Engine
    participant CAG as Gemini LLM (1M Context)
    
    User->>API: Uploads photo of N12 Notice
    API->>OCR: Pass image + Strict Pydantic Schema
    OCR-->>API: Returns strictly typed JSON data
    
    API->>Logic: Route JSON through Python Math/Rules
    Note over Logic: Validates 60-day math & Municipal routing
    Logic-->>API: Appends mathematical flaws
    
    API->>CAG: Inject JSON + 350k chars of RTA/Bylaws
    Note over CAG: Evaluates reasoning (e.g., Corporate Bad Faith)
    CAG-->>API: Returns Citation-Backed Flaws + Defense Script
    
    API-->>User: Renders Editorial Legal Report

```

### The Tech Stack

| Component | Technology | Role |
| --- | --- | --- |
| **Frontend** | **Next.js + Tailwind** | "Professional Editorial" UI using Server-Side Rendering. |
| **Backend** | **FastAPI** | High-performance asynchronous Python API. |
| **Data Validation** | **Pydantic** | Enforcing strict JSON structures from the Vision model. |
| **AI Engine** | **Gemini 2.5 Flash** | Multimodal OCR and 1M-Token deep legal reasoning. |
| **Document Parser** | **pdfplumber** | Extracting clean text from massive legal PDFs. |

---

## ⚡ Engineering Challenges Solved

### 1. The Math & Date Hallucination Trap

**Challenge:** LLMs are linguistic engines, not calculators. If you ask an LLM if "March 13 to May 31" is 60 days, it will often hallucinate the answer, providing catastrophic legal advice.
**Solution:** Built a hybrid architecture. The Vision model extracts the dates as raw strings, Pydantic converts them to `datetime` objects, and Python does the math. The AI is reserved exclusively for complex textual reasoning.

### 2. Context Window Overflow

**Challenge:** The Ontario RTA and Kitchener Bylaws combined exceed 130,000 tokens.
**Solution:** Utilized Gemini 2.5 Flash's massive 1M token context window, reading the PDFs into memory *once* at server initialization (`main.py` global scope) to drastically reduce latency on subsequent API calls.

### 3. Institutional Trust via UX Design

**Challenge:** Panicked users do not trust "playful" or "techy" UIs with serious legal matters.
**Solution:** Implemented a strict "Editorial/Professional" design system. Using warm ivory backgrounds, thin structural rule-lines, and classical Serif typography (Playfair Display) to mimic the aesthetic of physical court documents and establish immediate authority.

---

## 📂 Project Structure

```text
tenant-defender/
├── backend/
│   ├── main.py                 # FastAPI application and route orchestration
│   ├── agentic_ocr.py          # Pydantic schemas and Vision extraction prompts
│   ├── evaluator.py            # Strict-CAG logic and deterministic math engine
│   ├── requirements.txt        
│   └── data/
│       ├── ontario_rta_2006.pdf
│       └── kitchener_bylaw.pdf
└── frontend/
    ├── app/
    │   ├── page.tsx            # Main upload UI and Editorial report generation
    │   └── layout.tsx          # Font loading and global metadata
    ├── package.json
    └── tailwind.config.ts      # Custom editorial design tokens

```

---

## 🚀 Local Installation

### 1. Start the Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/Scripts/activate  # Or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Create a .env file and add your GEMINI_API_KEY
uvicorn main:app --port 8000 --reload

```

### 2. Start the Frontend (Next.js)

```bash
cd frontend
npm install
npm run dev

```

Navigate to `http://localhost:3000` to access the Tenant Defender dashboard.

---

*Developed by Devansh Mistry for GenAI Genesis 2026.*