"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, ImageIcon, X, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 10 * 1024 * 1024;

interface ImageUploadProps {
  onAnalyze: (file: File) => void;
  isLoading: boolean;
  className?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "Unsupported file type. Please upload a JPEG, PNG, WebP, or GIF.";
  }
  if (file.size > MAX_BYTES) {
    return "File is too large. Maximum size is 10 MB.";
  }
  return null;
}

export function ImageUpload({ onAnalyze, isLoading, className }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const acceptFile = useCallback((f: File) => {
    const err = validateFile(f);
    if (err) {
      setValidationError(err);
      return;
    }
    setValidationError(null);
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) acceptFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) acceptFile(f);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleRemove = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setValidationError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (file) onAnalyze(file);
  };

  return (
    <form onSubmit={handleSubmit} className={cn("space-y-4", className)}>
      {/* Drop zone */}
      {!file && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed transition-colors",
            isDragging
              ? "border-violet-500 bg-violet-500/5"
              : "border-border/70 bg-card/50 hover:border-violet-500/50 hover:bg-violet-500/5"
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary">
            <Upload className={cn("h-5 w-5", isDragging ? "text-violet-400" : "text-muted-foreground")} />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">
              {isDragging ? "Drop your screenshot here" : "Drag & drop or click to upload"}
            </p>
            <p className="text-xs text-muted-foreground">GGPoker screenshot · JPEG, PNG, WebP · Max 10 MB</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={handleInputChange}
            className="sr-only"
          />
        </div>
      )}

      {/* Validation error */}
      {validationError && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-400">{validationError}</p>
        </div>
      )}

      {/* Preview */}
      {file && preview && (
        <div className="relative rounded-lg border border-border/70 bg-card/50 overflow-hidden">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Poker hand screenshot preview"
              className="w-full max-h-[340px] object-contain"
            />
            <button
              type="button"
              onClick={handleRemove}
              disabled={isLoading}
              className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-background/80 text-muted-foreground hover:text-foreground transition-colors backdrop-blur-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 border-t border-border/50">
            <ImageIcon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{file.name}</span>
            <span className="text-xs text-muted-foreground ml-auto flex-shrink-0">{formatBytes(file.size)}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {file && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRemove}
            disabled={isLoading}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Remove
          </Button>
        )}

        <Button
          type="submit"
          variant="poker"
          size="sm"
          disabled={!file || isLoading}
          className="sm:ml-auto gap-2 min-w-[160px]"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing screenshot…
            </>
          ) : (
            "Analyze Screenshot"
          )}
        </Button>
      </div>
    </form>
  );
}
