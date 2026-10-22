"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Product, CategoryKey } from "@/lib/types";
import { CATEGORIES } from "@/lib/categories";
import { toDaysUntilExpiry } from "@/lib/date-utils";
import { Icon } from "@/components/icons/icon";

// ─── Public types ──────────────────────────────────────────────────────────────

export type VoiceAction = {
  accion: "agregar" | "eliminar" | "actualizar";
  producto: string;
  cantidad: number | null;
  categoria: string | null;
  fecha_vencimiento: string | null;
  campo_actualizar: string | null;
  nuevo_valor: string | null;
};

// ─── Internal types ────────────────────────────────────────────────────────────

type EditableOp = {
  accion: "agregar" | "eliminar" | "actualizar";
  producto: string;
  cantidad: number;
  categoria: CategoryKey;
  fecha_vencimiento: string; // YYYY-MM-DD
  campo_actualizar: string | null;
  nuevo_valor: string; // YYYY-MM-DD when campo_actualizar === "fecha_vencimiento"
  selectedProductId: string | null;
  selectedProductIds: string[]; // auto-selected when multiple items share same name (eliminar)
};

type Props = {
  actions: VoiceAction[] | null;
  products: Product[];
  transcripcion?: string;
  onAdd: (product: Product) => Promise<void> | void;
  onConsume: (id: string) => Promise<void> | void;
  onUpdate: (id: string, changes: Partial<Product>) => Promise<void> | void;
  onClose: () => void;
};

// ─── Pure helpers ──────────────────────────────────────────────────────────────

function normalize(s: string | null | undefined): string {
  if (!s) return "";
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function mapCategoria(cat: string | null): CategoryKey {
  if (!cat) return "conservas";
  const n = normalize(cat);
  const map: Record<string, CategoryKey> = {
    lacteos: "lacteos", carnes: "carnes", carne: "carnes",
    verduras: "verduras", frutas: "frutas", fruta: "frutas",
    panificados: "panificados", panificado: "panificados", pan: "panificados",
    bebidas: "bebidas", bebida: "bebidas",
    huevos: "huevos", huevo: "huevos",
    conservas: "conservas",
  };
  return map[n] ?? "conservas";
}

function defaultDateStr(offsetDays = 7): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

function daysToDateStr(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

function findMatches(products: Product[], nombre: string): Product[] {
  const n = normalize(nombre);
  const direct = products.filter(
    (p) => normalize(p.name) === n || normalize(p.name).includes(n),
  );
  if (direct.length > 0) return direct;
  if (n.endsWith("s")) {
    const singular = n.slice(0, -1);
    return products.filter(
      (p) => normalize(p.name) === singular || normalize(p.name).includes(singular),
    );
  }
  return [];
}

function initOp(action: VoiceAction, products: Product[]): EditableOp {
  const matches = action.accion !== "agregar" ? findMatches(products, action.producto) : [];
  const allSameName =
    action.accion === "eliminar" &&
    matches.length > 1 &&
    matches.every((m) => normalize(m.name) === normalize(matches[0].name));
  const autoSelected = matches.length === 1 ? matches[0] : null;
  return {
    accion: action.accion,
    producto: action.producto ?? "",
    cantidad: action.cantidad ?? 1,
    categoria: mapCategoria(action.categoria),
    fecha_vencimiento:
      action.accion === "agregar"
        ? (action.fecha_vencimiento ?? defaultDateStr())
        : (autoSelected ? daysToDateStr(autoSelected.daysUntilExpiry) : defaultDateStr()),
    campo_actualizar: action.campo_actualizar,
    nuevo_valor: action.nuevo_valor ?? defaultDateStr(),
    selectedProductId: autoSelected?.id ?? null,
    selectedProductIds: allSameName ? matches.map((m) => m.id) : [],
  };
}

const ACCION_META = {
  agregar:    { label: "Agregar",    icon: "plus",   color: "#2F8F5C", bg: "#E5F1E8" },
  eliminar:   { label: "Eliminar",   icon: "trash",  color: "#D85B4A", bg: "#FADDD6" },
  actualizar: { label: "Actualizar", icon: "pencil", color: "#E89F4D", bg: "#FBE9D2" },
} as const;

// ─── Hook: native <dialog> lifecycle (SRP: only open/close) ───────────────────

function useModalDialog(isOpen: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);

  // Sync ref without touching it during render
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Stable "close" listener — attached once, never torn down mid-flight
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const handle = () => onCloseRef.current();
    dialog.addEventListener("close", handle);
    return () => dialog.removeEventListener("close", handle);
  }, []);

  // Drive open/close from declarative boolean
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (isOpen && !dialog.open) dialog.showModal();
    else if (!isOpen && dialog.open) dialog.close();
  }, [isOpen]);

  const closeDialog = useCallback(() => {
    const dialog = ref.current;
    if (dialog?.open) dialog.close(); // fires "close" event → onClose() via stable listener
  }, []);

  return { ref, closeDialog };
}

// ─── Hook: editable operations state (SRP: data only, no dialog knowledge) ────

function useVoiceOps(actions: VoiceAction[] | null, products: Product[]) {
  const [ops, setOps] = useState<EditableOp[]>([]);

  // Re-init only when a new voice result arrives (products intentionally omitted)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOps(actions?.length ? actions.map((a) => initOp(a, products)) : []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions]);

  const updateOp = useCallback((index: number, changes: Partial<EditableOp>) => {
    setOps((prev) => prev.map((op, i) => (i === index ? { ...op, ...changes } : op)));
  }, []);

  const removeOp = useCallback((index: number) => {
    setOps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const canConfirm =
    ops.length > 0 &&
    ops.every((op) => {
      if (op.accion === "agregar") return op.producto.trim().length > 0;
      if (op.accion === "eliminar") return op.selectedProductId !== null || op.selectedProductIds.length > 0;
      return op.selectedProductId !== null;
    });

  return { ops, updateOp, removeOp, canConfirm };
}

// ─── Component: coordinator (GRASP Controller) ────────────────────────────────

export function VoiceActionModal({
  actions, products, transcripcion, onAdd, onConsume, onUpdate, onClose,
}: Props) {
  const isOpen = Boolean(actions?.length);
  const { ref: dialogRef, closeDialog } = useModalDialog(isOpen, onClose);
  const { ops, updateOp, removeOp, canConfirm } = useVoiceOps(actions, products);
  const submitting = useRef(false);

  const handleConfirm = useCallback(async () => {
    if (submitting.current) return;
    submitting.current = true;
    try {
      for (const op of ops) {
        if (op.accion === "agregar") {
          await onAdd({
            id: crypto.randomUUID(),
            name: op.producto,
            category: op.categoria,
            state: "cerrado",
            daysUntilExpiry: toDaysUntilExpiry(op.fecha_vencimiento),
            quantity: op.cantidad,
          });
        } else if (op.accion === "eliminar") {
          const ids =
            op.selectedProductIds.length > 0
              ? op.selectedProductIds
              : op.selectedProductId
                ? [op.selectedProductId]
                : [];
          for (const id of ids) {
            await onConsume(id);
          }
        } else if (op.accion === "actualizar" && op.selectedProductId) {
          if (op.campo_actualizar === "fecha_vencimiento") {
            await onUpdate(op.selectedProductId, {
              daysUntilExpiry: toDaysUntilExpiry(op.nuevo_valor),
            });
          }
        }
      }
    } finally {
      submitting.current = false;
      closeDialog();
    }
  }, [ops, onAdd, onConsume, onUpdate, closeDialog]);

  return (
    // KEY FIX: no flex/display Tailwind classes on <dialog> itself.
    // Author-origin CSS (Tailwind) beats the UA's dialog:not([open]){display:none},
    // so flex here would keep the dialog visible after close(). Layout lives in the
    // inner div instead.
    <dialog
      ref={dialogRef}
      aria-modal="true"
      className="m-auto w-[min(calc(100vw-1.5rem),440px)] rounded-2xl border border-border bg-bg p-0 shadow-xl backdrop:bg-black/40"
    >
      <div className="flex max-h-[85svh] flex-col">

        {/* Header */}
        <div className="shrink-0 border-b border-border px-5 py-4">
          <p className="text-[15px] font-bold text-ink">Confirmar acciones</p>
          {transcripcion && (
            <p className="mt-0.5 text-[12px] italic leading-snug text-ink-mute">
              &ldquo;{transcripcion}&rdquo;
            </p>
          )}
        </div>

        {/* Op cards */}
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-3">
          {ops.length === 0 && (
            <p className="py-4 text-center text-[13px] text-ink-mute">
              No quedan acciones.
            </p>
          )}

          {ops.map((op, idx) => {
            const meta = ACCION_META[op.accion];
            const matches = op.accion !== "agregar" ? findMatches(products, op.producto) : [];
            const noMatch = op.accion !== "agregar" && matches.length === 0;

            return (
              <div
                key={idx}
                className="flex min-h-[126px] shrink-0 flex-col rounded-xl border border-border bg-surface"
              >
                {/* Tinted label row */}
                <div
                  className="flex shrink-0 items-center gap-2 px-3 py-1.5"
                  style={{ backgroundColor: meta.bg }}
                >
                  <Icon name={meta.icon} size={12} color={meta.color} strokeWidth={2.5} />
                  <span
                    className="flex-1 text-[11px] font-bold uppercase tracking-wide"
                    style={{ color: meta.color }}
                  >
                    {meta.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeOp(idx)}
                    aria-label="Eliminar acción"
                    className="shrink-0 rounded-full p-0.5 transition-opacity hover:opacity-70"
                  >
                    <Icon name="x" size={12} color={meta.color} strokeWidth={2.5} />
                  </button>
                </div>

                {/* Inline editable body */}
                <div className="flex flex-1 flex-col gap-2 p-3">
                  {op.accion === "agregar" && (
                    <>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={op.cantidad}
                          onChange={(e) =>
                            updateOp(idx, { cantidad: Math.max(1, Number(e.target.value)) })
                          }
                          className="w-14 rounded-lg border border-border bg-bg px-2 py-1.5 text-center text-[13px] font-semibold text-ink"
                        />
                        <span className="text-[13px] text-ink-mute">×</span>
                        <input
                          type="text"
                          value={op.producto}
                          maxLength={60}
                          onChange={(e) => updateOp(idx, { producto: e.target.value })}
                          placeholder="nombre del producto"
                          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-[13px] font-semibold text-ink"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-[11px] text-ink-mute">Vence el</span>
                        <input
                          type="date"
                          value={op.fecha_vencimiento}
                          onChange={(e) => updateOp(idx, { fecha_vencimiento: e.target.value })}
                          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-[13px] text-ink"
                        />
                        <select
                          value={op.categoria}
                          onChange={(e) =>
                            updateOp(idx, { categoria: e.target.value as CategoryKey })
                          }
                          className="rounded-lg border border-border bg-bg px-2 py-1.5 text-[12px] text-ink"
                        >
                          {(Object.entries(CATEGORIES) as [CategoryKey, { label: string }][]).map(
                            ([key, { label }]) => (
                              <option key={key} value={key}>{label}</option>
                            ),
                          )}
                        </select>
                      </div>
                    </>
                  )}

                  {op.accion === "eliminar" && (
                    <>
                      {/* Editable quantity + name */}
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          value={op.cantidad}
                          onChange={(e) =>
                            updateOp(idx, { cantidad: Math.max(1, Number(e.target.value)) })
                          }
                          className="w-14 rounded-lg border border-border bg-bg px-2 py-1.5 text-center text-[13px] font-semibold text-ink"
                        />
                        <span className="text-[13px] text-ink-mute">×</span>
                        <input
                          type="text"
                          value={op.producto}
                          maxLength={60}
                          onChange={(e) =>
                            updateOp(idx, {
                              producto: e.target.value,
                              selectedProductId: null,
                              selectedProductIds: [],
                            })
                          }
                          placeholder="nombre del producto"
                          className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-[13px] font-semibold text-ink"
                        />
                      </div>

                      {/* Product selection */}
                      {noMatch ? (
                        <p className="rounded-lg bg-[#FADDD6] px-3 py-2 text-[12px] text-[#D85B4A]">
                          &ldquo;{op.producto}&rdquo; no está en tu despensa.
                        </p>
                      ) : op.selectedProductIds.length > 0 ? (
                        <p className="rounded-lg bg-[#E5F1E8] px-3 py-2 text-[12px] text-[#2F8F5C]">
                          Se eliminará de las {op.selectedProductIds.length} entradas con ese nombre.
                        </p>
                      ) : (
                        <>
                          <ProductPicker
                            matches={matches}
                            selectedId={op.selectedProductId}
                            onSelect={(id, dateStr) =>
                              updateOp(idx, { selectedProductId: id, fecha_vencimiento: dateStr })
                            }
                          />
                          {op.selectedProductId && (
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 text-[11px] text-ink-mute">Vence el</span>
                              <input
                                type="date"
                                value={op.fecha_vencimiento}
                                onChange={(e) =>
                                  updateOp(idx, { fecha_vencimiento: e.target.value })
                                }
                                className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-[13px] text-ink"
                              />
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}

                  {op.accion === "actualizar" && (
                    <>
                      {noMatch ? (
                        <p className="rounded-lg bg-[#FADDD6] px-3 py-2 text-[12px] text-[#D85B4A]">
                          &ldquo;{op.producto}&rdquo; no está en tu despensa.
                        </p>
                      ) : (
                        <>
                          <ProductPicker
                            matches={matches}
                            selectedId={op.selectedProductId}
                            onSelect={(id) => updateOp(idx, { selectedProductId: id })}
                          />
                          {op.campo_actualizar === "fecha_vencimiento" && (
                            <div className="flex items-center gap-2">
                              <span className="shrink-0 text-[11px] text-ink-mute">Nueva fecha</span>
                              <input
                                type="date"
                                value={op.nuevo_valor}
                                onChange={(e) => updateOp(idx, { nuevo_valor: e.target.value })}
                                className="min-w-0 flex-1 rounded-lg border border-border bg-bg px-2 py-1.5 text-[13px] text-ink"
                              />
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex shrink-0 gap-2.5 border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={closeDialog}
            className="flex-1 rounded-full border border-border py-2.5 text-[13.5px] font-semibold text-ink transition-colors hover:bg-surface-alt"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 rounded-full bg-[#2F8F5C] py-2.5 text-[13.5px] font-semibold text-white transition-opacity disabled:opacity-40"
          >
            Confirmar
          </button>
        </div>
      </div>
    </dialog>
  );
}

// ─── ProductPicker ─────────────────────────────────────────────────────────────

function ProductPicker({
  matches,
  selectedId,
  onSelect,
}: {
  matches: Product[];
  selectedId: string | null;
  onSelect: (id: string, dateStr: string) => void;
}) {
  if (matches.length === 1) {
    const p = matches[0];
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + p.daysUntilExpiry);
    return (
      <div className="flex items-center justify-between rounded-lg border border-border bg-bg px-3 py-2">
        <span className="text-[13px] font-semibold text-ink">{p.name}</span>
        <span className="text-[12px] text-ink-mute">
          vence {expiry.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-mute">
        ¿Cuál producto?
      </span>
      <div className="overflow-hidden rounded-lg border border-border">
        {matches.map((p, i) => {
          const isSelected = p.id === selectedId;
          const expiry = new Date();
          expiry.setDate(expiry.getDate() + p.daysUntilExpiry);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id, daysToDateStr(p.daysUntilExpiry))}
              className={`flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors ${
                i < matches.length - 1 ? "border-b border-border-soft" : ""
              } ${isSelected ? "bg-[#E5F1E8]" : "bg-bg hover:bg-surface"}`}
            >
              <span className="text-[13px] font-semibold text-ink">{p.name}</span>
              <div className="flex items-center gap-2">
                {p.quantity != null && (
                  <span className="text-[11px] text-ink-soft">x{p.quantity}</span>
                )}
                <span className="text-[11px] text-ink-mute">
                  {expiry.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                </span>
                {isSelected && <Icon name="check" size={14} color="#2F8F5C" strokeWidth={2.5} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
