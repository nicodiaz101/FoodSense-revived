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
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = await res.json();
          const ops: VoiceAction[] = Array.isArray(body?.resultado?.operaciones)
            ? body.resultado.operaciones
            : [body];
          const transcripcion: string | undefined = body?.transcripcion;
          setRecState("idle");
          onAction(ops, transcripcion);
        } catch {
          setErrorMsg("No se pudo procesar el audio. Intentá de nuevo.");
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
        disabled
        aria-label="Comando de voz disponible muy pronto"
        title="Próximamente disponible"
        className="relative flex h-[52px] w-full items-center justify-center gap-2.5 rounded-[16px] border border-border/60 bg-surface/50 text-ink-mute text-[15px] font-semibold opacity-70 cursor-not-allowed shadow-none"
      >
        <Icon name="mic" size={20} color="#9CA3AF" strokeWidth={2} />
        <span>Muy pronto: comando de voz</span>
        <span className="ml-1 rounded-full bg-surface-alt px-2 py-0.5 text-[10px] font-medium tracking-wide text-ink-mute uppercase">
          Próximamente
        </span>
      </button>
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
