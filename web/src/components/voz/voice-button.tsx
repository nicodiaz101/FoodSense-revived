"use client";

import { useRef, useState } from "react";
import { Icon } from "@/components/icons/icon";
import type { VoiceAction } from "./voice-action-modal";

type Props = {
  onAction: (actions: VoiceAction[], transcripcion?: string) => void;
};

type State = "idle" | "recording" | "processing" | "error";

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function VoiceButton({ onAction }: Props) {
  const [recState, setRecState] = useState<State>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setRecState("processing");
        try {
          const audio_base64 = await blobToBase64(blob);
          const mime_type = recorder.mimeType || "audio/webm";
          const res = await fetch("/api/voice/actions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio_base64, mime_type }),
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => null);
            throw new Error(errData?.error || `Error del servidor (HTTP ${res.status})`);
          }
          const body = await res.json();
          const ops: VoiceAction[] = Array.isArray(body?.resultado?.operaciones)
            ? body.resultado.operaciones
            : [body];
          const transcripcion: string | undefined = body?.transcripcion;
          setRecState("idle");
          onAction(ops, transcripcion);
        } catch (err) {
          console.error("Error al procesar audio:", err);
          setErrorMsg(err instanceof Error ? err.message : "No se pudo procesar el audio.");
          setRecState("error");
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecState("recording");
    } catch {
      setErrorMsg("No se pudo acceder al micrófono.");
      setRecState("error");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  const isRecording = recState === "recording";
  const isProcessing = recState === "processing";
  const isError = recState === "error";

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        aria-label={isRecording ? "Detener grabación" : "Grabar comando de voz con Gemini"}
        className={`relative flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[16px] text-[15px] font-semibold transition-all disabled:opacity-50 ${
          isRecording
            ? "bg-[#D85B4A] text-white"
            : isError
              ? "border border-[#D85B4A] bg-[#FADDD6] text-[#D85B4A]"
              : "border border-border bg-surface text-ink shadow-sm hover:border-emerald-500/50 hover:bg-surface-alt"
        }`}
      >
        {isProcessing ? (
          <>
            <Spinner />
            <span>Procesando con Gemini…</span>
          </>
        ) : isRecording ? (
          <>
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-60" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-white" />
            </span>
            <span>Grabando… tocá para detener</span>
          </>
        ) : (
          <>
            <Icon name="mic" size={20} color={isError ? "#D85B4A" : "#2F8F5C"} strokeWidth={2} />
            <span>{isError ? "Reintentar comando de voz" : "Comando de voz (IA Gemini)"}</span>
          </>
        )}
      </button>

      {isError && errorMsg && (
        <p className="text-center text-[12px] text-[#D85B4A]">{errorMsg}</p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin text-ink-mute"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
