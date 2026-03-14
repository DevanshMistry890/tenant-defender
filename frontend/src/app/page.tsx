"use client";

import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.statusText}`);
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || "An error occurred during upload.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-accent/20">
      {/* Editorial Decorative Rule */}
      <div className="h-1 bg-accent w-full" />
      
      <div className="max-w-4xl mx-auto px-6 py-24 md:py-32">
        {/* Section Label */}
        <div className="mb-12 flex items-center gap-4">
          <div className="rule-line" />
          <span className="small-caps text-accent whitespace-nowrap">
            Legal Intelligence System
          </span>
          <div className="rule-line" />
        </div>

        <header className="mb-20 text-center">
          <h1 className="text-6xl md:text-7xl font-serif tracking-tight mb-8 leading-[1.1]">
            Tenant Defender
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed italic">
            "Justice is not accidental. It is the result of rigorous context and unwavering defense."
          </p>
        </header>

        <div className="grid grid-cols-1 gap-16">
          <section className="bg-card border border-border-warm rounded-lg p-8 md:p-12 shadow-sm relative overflow-hidden">
            {/* Corner Accent */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-accent-muted rounded-bl-full -mr-12 -mt-12" />
            
            <div className="relative z-10">
              <h2 className="text-3xl font-serif mb-6">Analyze Eviction Notice</h2>
              <p className="text-muted-foreground mb-10 leading-relaxed">
                Upload a clear image of your LTB notice. Our system will cross-reference the extracted fields against the cached Ontario RTA and local Kitchener by-laws.
              </p>

              <div className="mb-10">
                <div className="flex items-center justify-center w-full">
                  <label htmlFor="notice-upload" className="flex flex-col items-center justify-center w-full h-48 border-2 border-border-warm border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-8 h-8 mb-4 text-accent group-hover:scale-110 transition-transform" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                      </svg>
                      <p className="small-caps text-muted-foreground mb-1">Click to upload notice</p>
                      <p className="text-xs text-muted-foreground/60 italic px-4 text-center">Supported: PNG, JPG, JPEG (LTB Forms N12, N4, etc.)</p>
                    </div>
                    <input id="notice-upload" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>
              </div>

              {previewUrl && (
                <div className="mb-10 rounded shadow-md overflow-hidden border border-border-warm animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <img src={previewUrl} alt="Notice Preview" className="w-full h-auto grayscale-[0.2] hover:grayscale-0 transition-all duration-700" />
                </div>
              )}

              <div className="flex justify-center">
                <button
                  onClick={handleUpload}
                  disabled={!file || loading}
                  className={`min-h-[50px] px-10 py-4 rounded-md small-caps text-white transition-all shadow-md active:scale-[0.98]
                    ${!file || loading 
                      ? "bg-muted-foreground/50 cursor-not-allowed" 
                      : "bg-accent hover:bg-accent-secondary hover:-translate-y-0.5 shadow-accent/20"
                    }
                  `}
                >
                  {loading ? "Decrypting Artifacts..." : "Begin Evaluation"}
                </button>
              </div>
            </div>
          </section>

          {error && (
            <div className="bg-red-50 border border-red-200 p-6 rounded-md animate-in shake duration-500">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                <p className="small-caps text-red-800 tracking-normal">{error}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="bg-card border border-border-warm rounded-lg p-8 md:p-12 shadow-md animate-in fade-in zoom-in-95 duration-700">
              <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4 mb-10 border-b border-border-warm pb-8">
                <h2 className="text-4xl font-serif">Assessment Report</h2>
                <div className={`px-4 py-1.5 rounded-full small-caps text-[0.65rem] border
                  ${result.is_likely_invalid ? "bg-red-50 text-red-800 border-red-200" : "bg-green-50 text-green-800 border-green-200"}
                `}>
                  {result.is_likely_invalid ? 'Procedural Irregularity Detected' : 'No Critical Flaws Found'}
                </div>
              </div>

              {result.fatal_flaws && result.fatal_flaws.length > 0 && (
                <div className="mb-12">
                  <div className="flex items-center gap-4 mb-8">
                    <h3 className="small-caps text-muted-foreground">Detailed Findings</h3>
                    <div className="rule-line flex-1" />
                  </div>
                  
                  <div className="space-y-10">
                    {result.fatal_flaws.map((flaw: any, idx: number) => (
                      <div key={idx} className="relative pl-8 border-l-2 border-accent/30 group">
                        {/* Bullet point */}
                        <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-background border-2 border-accent group-hover:bg-accent transition-colors" />
                        
                        <p className="text-xl font-serif mb-4 leading-snug">{flaw.description}</p>
                        
                        <div className="p-4 bg-muted border border-border-warm rounded italic text-sm relative">
                          <span className="small-caps text-accent text-[0.6rem] absolute -top-3 left-4 bg-background px-2 border-x border-border-warm">Statutory Grounding</span>
                          <span className="text-foreground font-medium tracking-tight">"{flaw.citation}"</span>
                        </div>
                        
                        <div className="mt-4 flex justify-end">
                          <span className="small-caps text-[0.6rem] text-muted-foreground opacity-50">Severity: {flaw.severity}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.recommendation_script && (
                <div className="bg-muted p-8 md:p-10 rounded border-2 border-accent/20 relative shadow-inner overflow-hidden">
                  {/* Decorative Background Icon */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-accent/5 pointer-events-none italic font-serif text-[120px]">
                    Draft
                  </div>
                  
                  <div className="relative z-10">
                    <h3 className="small-caps mb-6 text-accent">Recommended Defense Script</h3>
                    <p className="text-xl font-serif leading-relaxed text-foreground/90 italic mb-8">
                      "{result.recommendation_script}"
                    </p>
                    <div className="rule-line mb-6 opacity-30" />
                    <p className="small-caps text-[0.6rem] text-muted-foreground text-center tracking-widest leading-loose">
                      NOTICE: This is an automated assessment based on cached RTA context. Consult a licensed legal professional before proceeding.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <footer className="max-w-4xl mx-auto px-6 py-20 border-t border-border-warm text-center">
        <p className="small-caps text-[0.6rem] text-muted-foreground">
          Built with Precision & Restraint — GenAI Genesis 2026
        </p>
      </footer>
    </main>
  );
}
