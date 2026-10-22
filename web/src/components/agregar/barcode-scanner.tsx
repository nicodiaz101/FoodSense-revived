"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons/icon";
import type { CategoryKey } from "@/lib/types";

export interface BarcodeScanResult {
  name: string;
  category: CategoryKey;
}

interface Props {
  onDetected: (barcode: string, info: BarcodeScanResult | null) => void;
  onClose: () => void;
}

type ScanStatus = "scanning" | "loading" | "not_found" | "error";

async function lookupBarcode(barcode: string): Promise<BarcodeScanResult | null> {
  const trimmed = barcode.trim();
  if (!/^[A-Za-z0-9_-]{3,48}$/.test(trimmed)) {
    return null;
  }

  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(trimmed)}.json?fields=product_name,product_name_es,categories_tags`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const name = (p.product_name_es ?? p.product_name ?? "").trim();
    if (!name) return null;

    const tags: string[] = p.categories_tags ?? [];
    return { name, category: inferCategory(tags) };
  } catch {
    return null;
  }
}

function inferCategory(tags: string[]): CategoryKey {
  const s = tags.join(" ").toLowerCase();
  if (/en:dairies|en:milks|en:cheeses|en:yogurts|en:butters|lacteo/.test(s)) return "lacteos";
  if (/en:meats|en:fishes|en:poultry|en:seafoods|carne|pescado/.test(s)) return "carnes";
  if (/en:vegetables|en:fresh-vegetables|verdura/.test(s)) return "verduras";
  if (/en:fruits|en:fresh-fruits|fruta/.test(s)) return "frutas";
  if (/en:breads|en:cereals|en:bakery-products|en:biscuits|panificado/.test(s)) return "panificados";
  if (/en:beverages|en:waters|en:juices|en:sodas|bebida|gaseosa/.test(s)) return "bebidas";
  if (/en:eggs|huevo/.test(s)) return "huevos";
  return "conservas";
}

export function BarcodeScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);

  const [status, setStatus] = useState<ScanStatus>("scanning");
  const [errorMsg, setErrorMsg] = useState("");
  const [lastBarcode, setLastBarcode] = useState("");
  const detectedRef = useRef(false);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    let cancelled = false;
    let stopControls: (() => void) | null = null;

    async function start() {
      try {
        const { BrowserMultiFormatReader, BarcodeFormat } = await import("@zxing/browser");
        if (!videoRef.current) return;

        const reader = new BrowserMultiFormatReader();
        reader.possibleFormats = [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.ITF,
        ];

        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        };

        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current,
          async (result) => {
            if (cancelled || detectedRef.current || !result) return;
            detectedRef.current = true;
            setStatus("loading");

            const barcode = result.getText();
            setLastBarcode(barcode);
            const info = await lookupBarcode(barcode);

            if (cancelled) return;

            if (!info) {
              setStatus("not_found");
              setTimeout(() => {
                if (!cancelled) onDetectedRef.current(barcode, null);
              }, 1800);
            } else {
              onDetectedRef.current(barcode, info);
            }
          },
        );

        stopControls = () => controls.stop();
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg("No se pudo acceder a la cámara. Verificá los permisos en el navegador.");
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      stopControls?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20 active:bg-white/30"
          aria-label="Cerrar escáner"
        >
          <Icon name="x" size={20} color="white" />
        </button>
        <span className="text-[15px] font-bold text-white">Escanear código</span>
        <div className="h-10 w-10" />
      </div>

      {/* Camera feed */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          className="h-full w-full object-cover"
          playsInline
          muted
        />

        {/* Scanning frame overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-36 w-[270px]">
            <span className="absolute left-0 top-0 h-7 w-7 rounded-tl-sm border-l-[3px] border-t-[3px] border-[#4ADE80]" />
            <span className="absolute right-0 top-0 h-7 w-7 rounded-tr-sm border-r-[3px] border-t-[3px] border-[#4ADE80]" />
            <span className="absolute bottom-0 left-0 h-7 w-7 rounded-bl-sm border-b-[3px] border-l-[3px] border-[#4ADE80]" />
            <span className="absolute bottom-0 right-0 h-7 w-7 rounded-br-sm border-b-[3px] border-r-[3px] border-[#4ADE80]" />
            {status === "scanning" && (
              <div className="absolute left-2 right-2 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-[#4ADE80]/70" />
            )}
          </div>
        </div>

        {/* Loading overlay */}
        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="rounded-2xl bg-white px-8 py-5 text-center shadow-xl">
              <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[#2F8F5C] border-t-transparent" />
              <p className="text-[14px] font-semibold text-[#1B221F]">Buscando producto...</p>
            </div>
          </div>
        )}

        {/* Not found overlay */}
        {status === "not_found" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/70 px-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
              <Icon name="search" size={28} color="white" />
            </div>
            <p className="text-[16px] font-bold text-white">Producto no encontrado</p>
            <p className="text-[13px] text-white/60">
              No está en la base de datos. Podés ingresarlo manualmente.
            </p>
            {lastBarcode && (
              <p className="text-[12px] font-mono text-white/70">Código detectado: {lastBarcode}</p>
            )}
          </div>
        )}

        {/* Error overlay */}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 px-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10">
              <Icon name="x" size={28} color="white" />
            </div>
            <p className="text-[15px] text-white">{errorMsg}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full bg-white px-8 py-2.5 text-[14px] font-bold text-[#1B221F]"
            >
              Volver
            </button>
          </div>
        )}
      </div>

      {/* Bottom hint */}
      <div className="pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 text-center">
        <p className="text-[13px] text-white/60">
          Apuntá la cámara al código de barras del producto
        </p>
      </div>
    </div>
  );
}
