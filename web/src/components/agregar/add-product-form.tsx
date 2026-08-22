"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons/icon";
import { CameraScanner } from "./camera-scanner";
import { DaysPill } from "@/components/product/days-pill";
import { CATEGORIES } from "@/lib/categories";
import { useInventory } from "@/lib/use-inventory";
import type { CategoryKey, ProductState } from "@/lib/types";
import { toExpiresAt } from "@/lib/date-utils";
import { BarcodeScanner } from "./barcode-scanner";
import type { BarcodeScanResult } from "./barcode-scanner";
import { CategoryIcon } from "@/components/product/category-icon";
import { ConfirmExitDialog } from "./confirm-exit-dialog";
import { SessionSummary } from "./session-summary";
import { ExpiryDatePicker } from "./expiry-date-picker";

import {
  STATE_OPTIONS,
  addDaysToToday,
  dateToDays,
  formatDateLabel,
  getSuggestedExpiryDays,
  getSuggestedState,
  formatExpiryHint,
  formatStateHint,
  inferCategoryFromName,
} from "@/lib/product-form-utils";

type SessionItem = {
  id: string;
  name: string;
  category: CategoryKey;
  state: ProductState;
  daysUntilExpiry: number;
  expiryDate: string;
  quantity: number;
};

export function AddProductForm() {
  const router = useRouter();
  const { products, addProduct, updateProduct, remove } = useInventory();

  const [name, setName] = useState("");
  const [category, setCategory] = useState<CategoryKey>("lacteos");
  const [state, setState] = useState<ProductState>(getSuggestedState("lacteos"));
  const [expiryDate, setExpiryDate] = useState(
    addDaysToToday(getSuggestedExpiryDays("lacteos", "abierto")),
  );
  const [expiryWasCustomized, setExpiryWasCustomized] = useState(false);
  const [stateWasCustomized, setStateWasCustomized] = useState(false);
  const [hasManuallyChangedCategory, setHasManuallyChangedCategory] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [sessionProducts, setSessionProducts] = useState<SessionItem[]>([]);
  const [sessionExpanded, setSessionExpanded] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [showConfirmExit, setShowConfirmExit] = useState(false);
  const [summaryItems, setSummaryItems] = useState<SessionItem[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const daysUntilExpiry = dateToDays(expiryDate);
  const dateLabel = formatDateLabel(expiryDate);
  const dateHint = formatExpiryHint(getSuggestedExpiryDays(category, state));
  const stateHint = formatStateHint(getSuggestedState(category));

  function findMatchingProduct(productName: string, productExpiryDate: string) {
    const normalized = productName.trim().toLowerCase();
    return products.find(
      (p) =>
        p.name.toLowerCase() === normalized &&
        toExpiresAt(p.daysUntilExpiry) === productExpiryDate,
    );
  }

  function handleCategoryChange(nextCategory: CategoryKey, isManual = true) {
    if (isManual) setHasManuallyChangedCategory(true);
    setCategory(nextCategory);
    const nextState = stateWasCustomized ? state : getSuggestedState(nextCategory);

    if (!expiryWasCustomized) {
      setExpiryDate(addDaysToToday(getSuggestedExpiryDays(nextCategory, nextState)));
    }
    if (!stateWasCustomized) {
      setState(nextState);
    }
  }

  function handleNameChange(value: string) {
    setName(value);
    if (value) setNameError(false);

    if (!hasManuallyChangedCategory) {
      const inferred = inferCategoryFromName(value);
      if (inferred && inferred !== category) {
        handleCategoryChange(inferred, false);
      }
    }
  }

  function handleExpiryDateChange(value: string) {
    setExpiryWasCustomized(true);
    setExpiryDate(value);
  }

  function handleStateChange(nextState: ProductState) {
    setStateWasCustomized(true);
    setState(nextState);

    if (!expiryWasCustomized) {
      setExpiryDate(addDaysToToday(getSuggestedExpiryDays(category, nextState)));
    }
  }

  function handleRemoveFromSession(id: string) {
    setSessionProducts((prev) => prev.filter((p) => p.id !== id));
    remove(id);
  }

  function handleQuantityChange(id: string, delta: number) {
    const item = sessionProducts.find((p) => p.id === id);
    if (!item) return;
    const newQty = Math.max(1, item.quantity + delta);
    setSessionProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, quantity: newQty } : p)),
    );
    updateProduct(id, { quantity: newQty });
  }

  function handleScanDetected(barcode: string, info: BarcodeScanResult | null) {
    setShowScanner(false);
    if (info) {
      setName(info.name);
      setNameError(false);
      handleCategoryChange(info.category, false);
    }
  }

  function handleEditItem(id: string) {
    const item = sessionProducts.find((p) => p.id === id);
    if (!item) return;
    setEditingItemId(id);
    setName(item.name);
    setCategory(item.category);
    setState(item.state);
    setExpiryDate(item.expiryDate);
    
    const defaultDays = getSuggestedExpiryDays(item.category, item.state);
    setExpiryWasCustomized(item.daysUntilExpiry !== defaultDays);
    
    const defaultState = getSuggestedState(item.category);
    setStateWasCustomized(item.state !== defaultState);
    
    setHasManuallyChangedCategory(true);
    setNameError(false);
    setSessionExpanded(false);
  }

  function handleSaveEdit() {
    if (!name.trim()) {
      setNameError(true);
      return;
    }
    if (!editingItemId) return;
    const prevQty = sessionProducts.find((p) => p.id === editingItemId)?.quantity ?? 1;
    const updatedItem: SessionItem = {
      id: editingItemId,
      name: name.trim(),
      category,
      state,
      daysUntilExpiry,
      expiryDate,
      quantity: prevQty,
    };
    setSessionProducts((prev) =>
      prev.map((p) => (p.id === editingItemId ? updatedItem : p)),
    );
    updateProduct(editingItemId, {
      name: updatedItem.name,
      category: updatedItem.category,
      state: updatedItem.state,
      daysUntilExpiry: updatedItem.daysUntilExpiry,
    });
    handleCancelEdit();
  }

  function handleCancelEdit() {
    setEditingItemId(null);
    setName("");
    setHasManuallyChangedCategory(false);
    setExpiryWasCustomized(false);
    setStateWasCustomized(false);
    setNameError(false);
    const resetState = getSuggestedState(category);
    setState(resetState);
    setExpiryDate(addDaysToToday(getSuggestedExpiryDays(category, resetState)));
  }

  async function handleSaveAndAddAnother() {
    if (!name.trim()) {
      setNameError(true);
      return;
    }

    const existing = findMatchingProduct(name, expiryDate);
    if (existing) {
      const newQty = (existing.quantity ?? 1) + 1;
      await updateProduct(existing.id, { quantity: newQty });
      setSessionProducts((prev) => {
        const inSession = prev.find((p) => p.id === existing.id);
        if (inSession) {
          return prev.map((p) => (p.id === existing.id ? { ...p, quantity: newQty } : p));
        }
        return [
          ...prev,
          {
            id: existing.id,
            name: existing.name,
            category: existing.category,
            state: existing.state,
            daysUntilExpiry: existing.daysUntilExpiry,
            expiryDate,
            quantity: newQty,
          },
        ];
      });
    } else {
      const newItem: SessionItem = {
        id: Date.now().toString(),
        name: name.trim(),
        category,
        state,
        daysUntilExpiry,
        expiryDate,
        quantity: 1,
      };
      await addProduct(newItem);
      setSessionProducts((prev) => [...prev, newItem]);
    }

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2000);

    setName("");
    setHasManuallyChangedCategory(false);
    setExpiryWasCustomized(false);
    setStateWasCustomized(false);
    const resetState = getSuggestedState(category);
    setState(resetState);
    setExpiryDate(addDaysToToday(getSuggestedExpiryDays(category, resetState)));
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setNameError(true);
      return;
    }

    const existing = findMatchingProduct(name, expiryDate);
    if (existing) {
      const newQty = (existing.quantity ?? 1) + 1;
      await updateProduct(existing.id, { quantity: newQty });
      const mergedItem: SessionItem = {
        id: existing.id,
        name: existing.name,
        category: existing.category,
        state: existing.state,
        daysUntilExpiry: existing.daysUntilExpiry,
        expiryDate,
        quantity: newQty,
      };
      if (sessionProducts.length > 0) {
        const inSession = sessionProducts.find((p) => p.id === existing.id);
        const updatedSession = inSession
          ? sessionProducts.map((p) => (p.id === existing.id ? mergedItem : p))
          : [...sessionProducts, mergedItem];
        setSummaryItems(updatedSession);
      } else {
        router.push("/despensa");
      }
    } else {
      const finalItem: SessionItem = {
        id: Date.now().toString(),
        name: name.trim(),
        category,
        state,
        daysUntilExpiry,
        expiryDate,
        quantity: 1,
      };
      await addProduct(finalItem);
      if (sessionProducts.length > 0) {
        setSummaryItems([...sessionProducts, finalItem]);
      } else {
        router.push("/despensa");
      }
    }
  }

  return (
    <>
    {showSuccessToast && (
      <div className="fixed left-4 right-4 top-4 z-50 flex justify-center transition-opacity duration-300">
        <div className="flex items-center gap-2 rounded-full bg-green px-5 py-3 text-[14px] font-bold text-white shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
          <Icon name="check" size={18} color="#fff" strokeWidth={2.5} />
          ¡Producto guardado!
        </div>
      </div>
    )}
    {showScanner && (
      <BarcodeScanner
        onDetected={handleScanDetected}
        onClose={() => setShowScanner(false)}
      />
    )}
    {summaryItems.length > 0 && (
      <SessionSummary
        items={summaryItems}
        onConfirm={() => router.push("/despensa")}
      />
    )}
    <ConfirmExitDialog
      open={showConfirmExit}
      onConfirm={() => router.back()}
      onCancel={() => setShowConfirmExit(false)}
    />
    <ExpiryDatePicker
      open={showDatePicker}
      value={expiryDate}
      onChange={(date) => handleExpiryDateChange(date)}
      onClose={() => setShowDatePicker(false)}
    />
    <div className="flex h-full flex-col bg-bg">
      {/* Top bar */}
      <header className="flex items-center justify-between px-[18px] pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={() => {
            if (name.trim() !== "" && editingItemId === null) {
              setShowConfirmExit(true);
            } else {
              router.back();
            }
          }}
          aria-label="Cancelar y volver"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-alt"
        >
          <Icon name="x" size={20} color="currentColor" />
        </button>
        <h1 className="text-[15px] font-bold tracking-tight">
          Agregar producto
        </h1>
        <button
          type="button"
          onClick={() => setShowScanner(true)}
          aria-label="Escanear código de barras"
          className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface-alt"
        >
          <Icon name="barcode" size={20} color="currentColor" />
        </button>
      </header>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto pb-28">
        {/* Intro */}
        <div className="px-[22px] pb-5 pt-2">
          <p className="text-[22px] font-bold leading-snug tracking-tight">
            {editingItemId ? "Corregí lo que necesites" : "Contanos qué guardás"}
          </p>
          <p className="mt-1.5 text-[13.5px] leading-[1.45] text-ink-soft">
            {editingItemId
              ? "Cambiá lo que esté mal y guardá los cambios."
              : "Lo de siempre alcanza — nombre y fecha. El resto lo sugerimos nosotros."}
          </p>
        </div>

        {/* Nombre */}
        <FormSection label="Nombre del producto">
          <div
            className={`flex h-[52px] items-center gap-2 rounded-xl border px-4 bg-surface text-[15px] font-semibold transition-shadow ${
              nameError
                ? "border-red shadow-[0_0_0_4px_#FDEEEA]"
                : name
                  ? "border-green shadow-[0_0_0_4px_#F2F8F3]"
                  : "border-border"
            }`}
          >
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="Ej: Yogur natural"
              className="flex-1 bg-transparent text-ink placeholder:text-ink-mute focus:outline-none"
              autoFocus
              maxLength={60}
            />
          </div>
          {nameError && (
            <p className="mt-1.5 text-[12px] text-red">
              Ingresá el nombre del producto
            </p>
          )}
        </FormSection>

        {/* Categoría */}
        <FormSection label="Categoría" hint="Tocá para elegir otra">
          <div className="-mx-[18px] flex gap-2 overflow-x-auto px-[18px] pb-1 scrollbar-none">
            {(Object.entries(CATEGORIES) as [CategoryKey, typeof CATEGORIES[CategoryKey]][]).map(
              ([key, cat]) => {
                const isSelected = category === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleCategoryChange(key)}
                    className="flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2.5 transition-colors"
                    style={{
                      background: isSelected ? cat.tint : "#fff",
                      borderColor: isSelected ? cat.stroke : "#E7E6E0",
                      borderWidth: "1.5px",
                    }}
                  >
                    <Icon
                      name={cat.icon}
                      size={18}
                      color={cat.stroke}
                      strokeWidth={1.75}
                    />
                    <span
                      className="text-[13px]"
                      style={{ fontWeight: isSelected ? 700 : 600, color: "#1B221F" }}
                    >
                      {cat.label}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </FormSection>

        {/* Estado */}
        <FormSection label="Estado" hint={stateHint}>
          <div className="flex rounded-xl border border-border bg-surface-alt p-1">
            {STATE_OPTIONS.map((opt) => {
              const isActive = state === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleStateChange(opt.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-[10px] py-2.5 text-[13px] transition-all ${
                    isActive
                      ? "border border-border bg-surface font-bold text-ink shadow-sm"
                      : "font-medium text-ink-soft"
                  }`}
                >
                  <Icon
                    name={opt.icon}
                    size={14}
                    color={isActive ? "#1B221F" : "#5C6460"}
                    strokeWidth={2}
                  />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </FormSection>

        {/* Fecha de vencimiento */}
        <FormSection label="Fecha de vencimiento" hint={dateHint}>
          <button
            type="button"
            onClick={() => setShowDatePicker(true)}
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3.5 transition-colors hover:border-green/40"
          >
            <Icon name="calendar" size={20} color="#5C6460" />
            <div className="flex-1 text-left">
              <p className="font-mono text-[10px] uppercase tracking-[1.3px] text-ink-mute">
                Vence
              </p>
              <p className="mt-0.5 text-[15px] font-bold capitalize">
                {dateLabel}
              </p>
            </div>
            <DaysPill days={daysUntilExpiry} />
          </button>
        </FormSection>
      </div>

      {/* Bottom panel: lista de sesión + botones */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-surface shadow-lg lg:absolute">
        {/* Lista colapsable de productos agregados en la sesión */}
        {sessionProducts.length > 0 && (
          <>
            {sessionExpanded && (
              <div className="max-h-44 divide-y divide-border overflow-y-auto">
                {sessionProducts.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-[18px] py-2.5">
                    <CategoryIcon category={item.category} size={32} />
                    <span className="flex-1 truncate text-[13.5px] font-semibold text-ink">
                      {item.name}
                    </span>
                    <DaysPill days={item.daysUntilExpiry} />
                    <div className="ml-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.id, -1)}
                        aria-label="Restar cantidad"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-alt text-[16px] font-bold text-ink-soft transition-colors active:bg-border"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-[14px] font-bold text-ink">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.id, +1)}
                        aria-label="Sumar cantidad"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-alt text-[16px] font-bold text-ink-soft transition-colors active:bg-border"
                      >
                        +
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEditItem(item.id)}
                        aria-label="Editar producto"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-alt text-ink-soft transition-colors active:bg-border"
                      >
                        <Icon name="pencil" size={13} color="currentColor" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveFromSession(item.id)}
                        aria-label="Eliminar de la lista"
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-alt text-ink-soft transition-colors active:bg-red/10 active:text-red active:border-red/30"
                      >
                        <Icon name="trash" size={13} color="currentColor" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button
              type="button"
              onClick={() => setSessionExpanded((v) => !v)}
              className="flex w-full items-center justify-between border-b border-border px-[18px] py-2.5"
            >
              <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                <div
                  style={{
                    transform: sessionExpanded ? "rotate(0deg)" : "rotate(-90deg)",
                    transition: "transform 200ms",
                  }}
                >
                  <Icon name="chevronDown" size={14} color="#1B221F" />
                </div>
                {sessionProducts.length === 1
                  ? "1 producto agregado"
                  : `${sessionProducts.length} productos agregados`}
              </span>
              <span className="text-[11.5px] text-ink-mute">
                {sessionExpanded ? "Cerrar" : "Ver y editar"}
              </span>
            </button>
          </>
        )}

        {/* Botones de acción */}
        <div className="px-[18px] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3">
          {editingItemId ? (
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[16px] border-[2px] border-border bg-transparent text-[14px] font-bold text-ink-soft transition-opacity active:opacity-60"
              >
                <Icon name="x" size={18} color="currentColor" strokeWidth={2.5} />
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-green text-[14px] font-bold text-white shadow-md transition-opacity active:opacity-80"
              >
                <Icon name="check" size={18} color="#fff" strokeWidth={2.5} />
                Guardar cambios
              </button>
            </div>
          ) : (
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleSaveAndAddAnother}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[16px] border-[2px] border-green bg-transparent text-[14px] font-bold text-green transition-opacity active:opacity-60"
              >
                <Icon name="plus" size={18} color="currentColor" strokeWidth={2.5} />
                Agregar otro
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[16px] bg-green text-[14px] font-bold text-white shadow-md transition-opacity active:opacity-80"
              >
                <Icon name="check" size={18} color="#fff" strokeWidth={2.5} />
                Finalizar
              </button>
            </div>
          )}
        </div>
      </div>

      {showCamera && <CameraScanner onClose={() => setShowCamera(false)} />}
    </div>
    </>
  );
}

function FormSection({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="px-[18px] pb-5">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[10.5px] font-semibold uppercase tracking-[1.3px] text-ink-soft">
          {label}
        </span>
        {hint && <span className="text-[11.5px] text-ink-mute">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
