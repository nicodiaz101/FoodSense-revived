"use client";

import { useEffect, useState, useCallback } from "react";
import type { Product } from "./types";
import { supabase } from "./supabase-client";
import { auth } from "./firebase";
import { toExpiresAt, toDaysUntilExpiry } from "./date-utils";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    state: row.state,
    daysUntilExpiry: toDaysUntilExpiry(row.expires_at),
    ...(row.quantity != null ? { quantity: row.quantity as number } : {}),
  };
}

export function useInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [consumedThisMonth, setConsumedThisMonth] = useState(0);
  const [wastedThisMonth, setWastedThisMonth] = useState(0);

  const reload = useCallback(async () => {
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    ).toISOString();

    const [{ data: rows, error: rowsError }, { data: events, error: eventsError }] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, category, state, expires_at, quantity")
        .order("expires_at", { ascending: true }),
      supabase
        .from("product_events")
        .select("type")
        .gte("occurred_at", startOfMonth),
    ]);

    if (rowsError) {
      console.error("[useInventory] Error cargando productos de Supabase:", rowsError);
    }
    if (eventsError) {
      console.error("[useInventory] Error cargando eventos de Supabase:", eventsError);
    }

    if (rows) setProducts(rows.map(rowToProduct));
    if (events) {
      setConsumedThisMonth(events.filter((e) => e.type === "consumed").length);
      setWastedThisMonth(events.filter((e) => e.type === "wasted").length);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        setProducts([]);
        setIsLoaded(true);
        return;
      }
      await reload();
      setIsLoaded(true);
    });
    return unsubscribe;
  }, [reload]);

  async function addProduct(product: Product) {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      console.warn("[useInventory] No hay usuario logueado en Firebase");
      return;
    }

    setProducts((prev) =>
      [...prev, product].sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
    );

    const { data, error } = await supabase
      .from("products")
      .insert({
        user_id: uid,
        name: product.name,
        category: product.category,
        state: product.state,
        expires_at: toExpiresAt(product.daysUntilExpiry),
        quantity: product.quantity ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error("[useInventory] Error al insertar producto en Supabase:", error);
      throw error;
    }

    if (data) {
      const saved = rowToProduct(data);
      setProducts((prev) =>
        prev
          .map((p) => (p.id === product.id ? saved : p))
          .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
      );
    }
  }

  async function consume(id: string) {
    const uid = auth.currentUser?.uid;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setConsumedThisMonth((c) => c + 1);
    await Promise.all([
      supabase.from("products").delete().eq("id", id),
      uid
        ? supabase.from("product_events").insert({ user_id: uid, type: "consumed" })
        : Promise.resolve(),
    ]);
  }

  async function remove(id: string) {
    const uid = auth.currentUser?.uid;
    setProducts((prev) => prev.filter((p) => p.id !== id));
    setWastedThisMonth((w) => w + 1);
    await Promise.all([
      supabase.from("products").delete().eq("id", id),
      uid
        ? supabase.from("product_events").insert({ user_id: uid, type: "wasted" })
        : Promise.resolve(),
    ]);
  }

  async function updateProduct(id: string, changes: Partial<Product>) {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...changes } : p)),
    );
    const dbChanges: Record<string, unknown> = {};
    if (changes.name !== undefined) dbChanges.name = changes.name;
    if (changes.category !== undefined) dbChanges.category = changes.category;
    if (changes.state !== undefined) dbChanges.state = changes.state;
    if (changes.quantity !== undefined) dbChanges.quantity = changes.quantity;
    if (changes.daysUntilExpiry !== undefined) {
      dbChanges.expires_at = toExpiresAt(changes.daysUntilExpiry);
    }
    await supabase.from("products").update(dbChanges).eq("id", id);
  }

  return {
    products,
    addProduct,
    consume,
    remove,
    updateProduct,
    isLoaded,
    consumedThisMonth,
    wastedThisMonth,
  };
}
