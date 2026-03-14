"use client";

import { useState, useRef, useEffect } from "react";

type StreamStatus = "idle" | "scanning" | "calculating" | "verifying" | "auditing" | "complete" | "error";

interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
}

interface Flaw {
  description: string;
  citation: string;
  severity: string;
  flaw_type: string; // "deterministic", "advisory", or "fact"
  bounding_box: BoundingBox | null;
}

interface LogEntry {
  id: number;
  message: string;
  status: "pending" | "running" | "done";
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeBox, setActiveBox] = useState<BoundingBox | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs within container only
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [logs]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name));
      setResult(null);
      setError(null);
      setStreamStatus("idle");
      setLogs([]);
      setActiveBox(null);

      if (files.length === 1) {
        // Standard single image handling
        const selectedFile = files[0];
        setFile(selectedFile);
        setPreviewUrl(URL.createObjectURL(selectedFile));
      } else {
        // MULTI-PAGE STITCHING LOGIC
        // If user selects multiple images (Page 1 & 2), stitch them vertically
        try {
          const loadImages = files.map(file => {
            return new Promise<HTMLImageElement>((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = URL.createObjectURL(file);
            });
          });

          const images = await Promise.all(loadImages);

          // Calculate total canvas size
          const maxWidth = Math.max(...images.map(img => img.width));
          const totalHeight = images.reduce((sum, img) => sum + img.height, 0);

          const canvas = document.createElement("canvas");
          canvas.width = maxWidth;
          canvas.height = totalHeight;
          const ctx = canvas.getContext("2d");

          if (ctx) {
            let currentY = 0;
            images.forEach(img => {
              // Draw each image sequentially down the canvas
              ctx.drawImage(img, 0, currentY, img.width, img.height);
              currentY += img.height;
            });

            // Convert canvas back to a File for the backend
            canvas.toBlob((blob) => {
              if (blob) {
                const stitchedFile = new File([blob], "stitched_notice.jpg", { type: "image/jpeg" });
                setFile(stitchedFile);
                setPreviewUrl(URL.createObjectURL(stitchedFile));
              }
            }, "image/jpeg", 0.9);
          }
        } catch (err) {
          setError("Failed to process multiple images. Please try uploading a single image.");
        }
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setStreamStatus("scanning");
    setError(null);
    setResult(null);
    setLogs([]);
    setActiveBox(null);

    let logIdCounter = 0;

    const addLog = (msg: string, status: "scanning" | "calculating" | "verifying" | "auditing" | "complete" | "error") => {
      setStreamStatus(status);
      setLogs(prev => {
        const updated = prev.map(l => ({ ...l, status: "done" as const }));
        if (status !== "complete" && status !== "error") {
          return [...updated, { id: logIdCounter++, message: msg, status: "running" as const }];
        }
        return updated;
      });
    };

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("http://localhost:8000/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Analysis failed. Please check the backend.");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("Could not read response stream.");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = JSON.parse(line.slice(6));

            if (data.status === "complete") {
              setResult(data.result);
              addLog("", "complete");
            } else if (data.status === "error") {
              setError(data.message);
              setStreamStatus("error");
            } else {
              addLog(data.message, data.status);
            }
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during evaluation.");
      setStreamStatus("error");
    }
  };

  // Convert normalized bounding box (0-1) to CSS percentages
  const getBoxStyle = (box: BoundingBox) => {
    return {
      top: `${box.ymin * 100}%`,
      left: `${box.xmin * 100}%`,
      height: `${(box.ymax - box.ymin) * 100}%`,
      width: `${(box.xmax - box.xmin) * 100}%`,
    };
  };

  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-accent/20 pb-20">
      {/* Editorial Decorative Rule */}
      <div className="h-1 bg-accent w-full" />

      <div className="max-w-6xl mx-auto px-6 mt-12 mb-12 md:mt-20">
        <header className="text-center mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center justify-center gap-4 mb-6">
            <div className="text-accent">
              <Logo className="w-12 h-12 md:w-16 md:h-16" />
            </div>
            <h1 className="text-5xl md:text-6xl font-serif tracking-tight leading-[1.1]">
              Tenant Defender
            </h1>
          </div>
          <p className="text-lg md:text-xl text-muted-foreground/80 max-w-2xl mx-auto leading-relaxed italic pr-4">
            "Justice is not accidental. It is the result of rigorous context and unwavering defense."
          </p>
        </header>

        {!previewUrl ? (
          <div className="max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-500">
            <section className="bg-card border border-border-warm rounded-lg p-8 md:p-12 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-accent-muted rounded-bl-full -mr-12 -mt-12 pointer-events-none" />
              <div className="relative z-10">
                <h2 className="text-4xl font-serif mb-6 text-center">Analyze Eviction Notice</h2>
                <p className="text-muted-foreground mb-10 leading-relaxed text-center max-w-xl mx-auto">
                  Upload a clear image of your LTB notice. Our system will cross-reference the extracted fields against the cached Ontario RTA and local Kitchener by-laws.
                </p>

                <div className="flex items-center justify-center w-full">
                  <label htmlFor="notice-upload" className="flex flex-col items-center justify-center w-full h-56 border-2 border-border-warm border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-all group">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-10 h-10 mb-5 text-accent/70 group-hover:text-accent group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2" />
                      </svg>
                      <p className="small-caps text-muted-foreground text-lg mb-2">Click to upload notice</p>
                      <p className="text-sm text-muted-foreground/60 italic px-4 text-center">Supported formats: PNG, JPG, JPEG (Select multiple for page 1 & 2)</p>
                    </div>
                    {/* ADDED MULTIPLE FLAG HERE */}
                    <input id="notice-upload" type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} />
                  </label>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 lg:items-start animate-in fade-in duration-700">
            {/* LEFT: Document View (Sticky) */}
            <section className="flex-1 bg-card border border-border-warm rounded-lg shadow-sm overflow-hidden flex flex-col relative lg:sticky lg:top-8 z-10">
              <div className="absolute top-0 right-0 w-16 h-16 bg-accent-muted rounded-bl-full -mr-8 -mt-8 pointer-events-none" />

              <div className="p-6 flex-1 flex flex-col">
                <div className="mb-4 flex items-center gap-4">
                  <span className="small-caps text-accent tracking-widest">Document Ground Truth</span>
                  <div className="rule-line flex-1" />
                </div>

                <div className="flex-1 relative w-full border border-border-warm/50 rounded group p-4 bg-white/50 max-h-[70vh] overflow-y-auto custom-scrollbar">
                  <div className="relative inline-block w-full h-auto mx-auto align-top">
                    {/* The Document Image */}
                    <img
                      src={previewUrl}
                      alt="Notice Ground Truth"
                      className={`w-full h-auto block rounded transition-all duration-700
                        ${streamStatus !== "idle" && streamStatus !== "complete" && streamStatus !== "error" ? "opacity-40 grayscale blur-[1px]" : "opacity-100 grayscale-0"}
                      `}
                    />

                    {/* Target Reticle / Scanner Overlay during processing */}
                    {streamStatus !== "idle" && streamStatus !== "complete" && streamStatus !== "error" && (
                      <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center z-10">
                        <div className="w-full h-1 bg-accent/20 absolute top-0 animate-[scan_3s_ease-in-out_infinite]" />
                        <div className="bg-background/80 backdrop-blur-sm border border-accent/30 text-accent small-caps px-4 py-2 rounded-full shadow-lg flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                          Extracting Truth
                        </div>
                      </div>
                    )}

                    {/* Interactive Bounding Box Overlay for Audit Trail */}
                    {streamStatus === "complete" && activeBox && (
                      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
                        <div
                          className="absolute border-2 border-accent bg-accent/20 shadow-[0_0_15px_rgba(184,134,11,0.5)] transition-all duration-300"
                          style={getBoxStyle(activeBox)}
                        />
                        {/* Connection line helper */}
                        <div
                          className="absolute right-[0] border-t-[2px] border-dashed border-accent/60 hidden lg:block"
                          style={{
                            top: `${(activeBox.ymin + (activeBox.ymax - activeBox.ymin) / 2) * 100}%`,
                            width: `max(50px, ${100 - (activeBox.xmax * 100)}%)`,
                            transform: 'translateX(100%)'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Control Bar */}
              <div className="p-4 px-6 border-t border-border-warm bg-muted/10 flex justify-between items-center">
                <button
                  onClick={() => document.getElementById('notice-upload-hidden')?.click()}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors custom-underline"
                >
                  Choose Different File
                </button>
                {/* ADDED MULTIPLE FLAG HERE */}
                <input id="notice-upload-hidden" type="file" className="hidden" accept="image/*" multiple onChange={handleFileChange} />
                <button
                  onClick={handleUpload}
                  disabled={!file || (streamStatus !== "idle" && streamStatus !== "complete" && streamStatus !== "error")}
                  className={`min-h-[40px] px-8 py-2 rounded-md small-caps text-white transition-all shadow-md active:scale-[0.98] tracking-widest
                    ${!file || (streamStatus !== "idle" && streamStatus !== "complete" && streamStatus !== "error")
                      ? "bg-muted-foreground/40 cursor-not-allowed shadow-none"
                      : "bg-foreground hover:bg-black hover:-translate-y-0.5 shadow-md"
                    }
                  `}
                >
                  {streamStatus === "idle" || streamStatus === "error" ? "Run Evaluation" : "Re-evaluate"}
                </button>
              </div>
            </section>

            {/* RIGHT: Analysis Stepper / Results */}
            <section className="flex-1 flex flex-col gap-6 lg:max-w-xl w-full">

              {/* Live Execution Stepper */}
              {(streamStatus !== "idle" || logs.length > 0) && (
                <div className="bg-card border border-border-warm rounded-lg p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between border-b border-border-warm pb-3">
                    <span className="small-caps text-muted-foreground tracking-widest text-[0.7rem]">Execution Log</span>
                    {streamStatus === "complete" && <span className="small-caps text-accent text-[0.65rem] tracking-widest">Verified</span>}
                    {streamStatus === "error" && <span className="small-caps text-red-600 text-[0.65rem] tracking-widest">System Halt</span>}
                  </div>

                  <div ref={scrollContainerRef} className="space-y-4 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {logs.map((log) => (
                      <div key={log.id} className="flex gap-4 items-start animate-in fade-in slide-in-from-left-2 duration-300">
                        <div className="mt-1 flex-shrink-0">
                          {log.status === "done" ? (
                            <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                          ) : log.status === "running" ? (
                            <div className="w-4 h-4 rounded-full border-[1.5px] border-accent/20 border-t-accent animate-spin" />
                          ) : (
                            <div className="w-4 h-4 rounded-full border-[1.5px] border-border-warm" />
                          )}
                        </div>
                        <p className={`text-sm font-mono leading-relaxed transition-colors duration-300
                          ${log.status === "done" ? "text-muted-foreground" : "text-foreground font-medium"}
                        `}>
                          {log.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Error State */}
              {error && (
                <div className="bg-red-50/50 border border-red-200 p-6 rounded-md animate-in shake duration-500">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-600 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"></path></svg>
                    <p className="font-sans text-sm text-red-800 leading-relaxed font-medium">{error}</p>
                  </div>
                </div>
              )}

              {/* Audit Trail Results */}
              {streamStatus === "complete" && result && (
                <div className="bg-card border border-border-warm rounded-lg shadow-sm animate-in slide-in-from-top-4 duration-700 flex flex-col">

                  <div className="p-6 md:p-8 bg-background border-b border-border-warm">
                    <div className="flex flex-col md:flex-row md:items-baseline justify-between gap-4">
                      <h2 className="text-3xl font-serif">Assessment</h2>
                      <div className={`px-3 py-1.5 rounded small-caps text-[0.6rem] tracking-widest border self-start
                        ${result.is_likely_invalid ? "bg-red-50/50 text-red-800 border-red-200" : "bg-green-50/50 text-green-800 border-green-200"}
                      `}>
                        {result.is_likely_invalid ? 'Irregularity Detected' : 'No Critical Flaws'}
                      </div>
                    </div>
                  </div>

                  <div className="p-6 md:p-8 flex-1">
                    {result.fatal_flaws && result.fatal_flaws.length > 0 ? (
                      <div className="space-y-6">
                        <p className="small-caps text-muted-foreground mb-6 tracking-widest text-[0.7rem]">Identified Statutory Violations</p>
                        {result.fatal_flaws.map((flaw: Flaw, idx: number) => (
                          <div
                            key={idx}
                            className={`relative pl-6 py-3 border-l-[3px] hover:bg-muted/10 group cursor-crosshair transition-all duration-300 rounded-r
                              ${flaw.flaw_type === "deterministic"
                                ? "border-red-600 bg-red-50/10"
                                : flaw.flaw_type === "fact"
                                  ? "border-muted-foreground/30 bg-muted/5"
                                  : "border-orange-400/50 bg-orange-50/5"}
                            `}
                            onMouseEnter={() => flaw.bounding_box && setActiveBox(flaw.bounding_box)}
                            onMouseLeave={() => setActiveBox(null)}
                          >
                            {/* Trust Badge */}
                            <div className="mb-2">
                              <span className={`small-caps text-[0.6rem] tracking-widest px-1.5 py-0.5 rounded border
                                ${flaw.flaw_type === "deterministic"
                                  ? "bg-red-100 text-red-900 border-red-200"
                                  : flaw.flaw_type === "fact"
                                    ? "bg-muted text-muted-foreground border-border-warm"
                                    : "bg-orange-100 text-orange-900 border-orange-200"}
                              `}>
                                {flaw.flaw_type === "deterministic" ? "Deterministic Proof" : flaw.flaw_type === "fact" ? "Extracted Fact" : "AI Advisory Flag"}
                              </span>
                            </div>

                            <p className="text-foreground/90 font-medium mb-3 leading-snug group-hover:text-foreground transition-colors pr-2">{flaw.description}</p>

                            <div className={`py-3 px-4 border rounded text-sm relative transition-all group-hover:shadow-sm
                              ${flaw.flaw_type === "deterministic"
                                ? "bg-red-50/50 border-red-100"
                                : flaw.flaw_type === "fact"
                                  ? "bg-muted/20 border-border-warm/50"
                                  : "bg-muted/40 border-border-warm"}
                            `}>
                              <span className="text-foreground/80 font-mono text-[0.7rem] font-medium tracking-tight">Citation: {flaw.citation}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground font-medium italic">No immediate statutory irregularities were detected on the face of this notice based on standard parsing thresholds.</p>
                    )}
                  </div>

                  {result.recommendation_script && (
                    <div className="p-6 md:p-8 bg-muted/30 border-t border-border-warm relative">
                      <h3 className="small-caps mb-4 text-accent tracking-widest text-[0.7rem]">Recommended Defense Script</h3>
                      <p className="text-lg font-serif leading-relaxed text-foreground/90 italic mb-8">
                        "{result.recommendation_script}"
                      </p>
                      <p className="text-[0.6rem] font-mono tracking-widest text-muted-foreground text-center opacity-60">
                        NOT LEGAL ADVICE. AUTOMATED ASSESSMENT ONLY.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="w-full py-12 text-center mt-auto">
        <p className="small-caps text-[0.6rem] text-muted-foreground">
          Built with Precision & Restraint | Devansh Mistry | GenAI Genesis 2026
        </p>
      </footer>
    </main>
  );
}

export function Logo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Outer Shield */}
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      {/* Inner Legal Pillar */}
      <path d="M12 8v8" />
      <path d="M9 16h6" />
      <path d="M9 8h6" />
      <path d="M10.5 8v8" />
      <path d="M13.5 8v8" />
    </svg>
  );
}