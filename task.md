# FoodSense SaaS — Backlog de Tareas (task.md)

## 📋 Estado del Proyecto

- [x] **Arquitectura & Definición:** Generar `SPECS.md`, `ROADMAP.MD`, `task.md` y `TEST_PLAN.md`.
- [ ] **Fase 1: Infraestructura & Base de Datos Propia**
- [ ] **Fase 2: Integración de IA con Google Gemini**
- [ ] **Fase 3: Refinamiento de Despensa & Multi-Tenancy**
- [ ] **Fase 4: Dashboard de Impacto & Alertas**
- [ ] **Fase 5: Implementación de Tiers SaaS**
- [ ] **Fase 6: Testing & Entrega**

---

## 🏗️ Fase 1: Infraestructura & Base de Datos Propia
- [ ] **TASK-101:** Crear proyecto nuevo en Supabase bajo la cuenta del alumno/equipo.
- [ ] **TASK-102:** Ejecutar script DDL (`SPECS.md` Sección 4.2) en el SQL Editor de Supabase para crear tablas `products`, `product_events`, `households` y `household_members`.
- [ ] **TASK-103:** Verificar activación de Row Level Security (RLS) y políticas de aislamiento de datos en Supabase.
- [ ] **TASK-104:** Configurar variables de entorno `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` en `web/.env.local`.
- [ ] **TASK-105:** Mantener autenticación en Firebase Auth (Login con Google) y configurar la integración Third-Party JWT en Supabase.
- [ ] **TASK-106:** Actualizar `src/lib/use-inventory.ts` para que todas las operaciones CRUD lean y escriban directamente en la nueva base de datos Supabase.

---

## 🤖 Fase 2: Motor de IA de Voz con Google Gemini
- [ ] **TASK-201:** Obtener `GEMINI_API_KEY` en Google AI Studio y configurarla en `web/.env.local`.
- [ ] **TASK-202:** Instalar SDK oficial `@google/genai` o `@google/generative-ai` en el paquete web.
- [ ] **TASK-203:** Implementar Route Handler `web/src/app/api/voice/actions/route.ts` que reciba audio base64, procese con Gemini 2.0 Flash / 1.5 Flash y retorne transcripción + operaciones estructuradas JSON.
- [ ] **TASK-204:** Actualizar `src/components/voz/voice-button.tsx` para reemplazar el endpoint antiguo de AWS (`execute-api.us-east-2.amazonaws.com`) por `/api/voice/actions`.
- [ ] **TASK-205:** Validar modal de revisión `VoiceActionModal` con casos de uso: "Agregar 3 leches", "Eliminar yogur", "Cambiar vencimiento de tomate".

---

## 📦 Fase 3: Despensa Inteligente & Experiencia de Usuario
- [ ] **TASK-301:** Verificar ordenamiento por urgencia de vencimiento ascendente en `/despensa` (US-07).
- [ ] **TASK-302:** Verificar y optimizar filtrado por categorías y búsqueda por texto en tiempo real (US-08).
- [ ] **TASK-303:** Implementar flujo de marcar como consumido y eliminación con registro de métricas (US-09 y US-10).
- [ ] **TASK-304:** Verificar escaneo de códigos de barra con cámara (`@zxing/browser`) en `/agregar`.
- [ ] **TASK-305:** Validar flujo de edición manual de productos en `/editar/[id]`.

---

## 📊 Fase 4: Analíticas de Ahorro & Alertas
- [ ] **TASK-401:** Integrar métricas reales en el Dashboard (`/`): Productos activos, Urgentes, Aprovechados este mes, Desperdiciados este mes.
- [ ] **TASK-402:** Consolidar pantalla de Alertas (`/alertas`) clasificando productos por vencer en Críticos (≤1 día), Advertencia (≤4 días) e Informativos.
- [ ] **TASK-403:** Verificar y asegurar soporte de notificaciones push web o banner persistente en la despensa.

---

## 💎 Fase 5: Implementación de Tiers SaaS & Monetización
- [ ] **TASK-501:** Implementar lógica para identificar usuarios "Free" vs "Premium" (ej. flag en base de datos o custom claim en Firebase).
- [ ] **TASK-502:** Restringir funcionalidad de IA (botón de voz y endpoint `/api/voice/actions`) solo para usuarios Premium.
- [ ] **TASK-503:** Crear pantalla `/premium` para simular suscripción al plan de pago.

---

## 🧪 Fase 6: Testing & Entrega Final
- [ ] **TASK-601:** Configurar suite de pruebas unitarias con Vitest para funciones críticas (`date-utils.ts`, `urgency.ts`, `product-form-utils.ts`).
- [ ] **TASK-602:** Ejecutar la matriz completa del Plan de Pruebas (`TEST_PLAN.md`).
- [ ] **TASK-603:** Ejecutar `pnpm lint` y `pnpm build` asegurando cero errores de compilación TypeScript y ESLint.
- [ ] **TASK-604:** Realizar despliegue en Vercel y documentar credenciales de usuario de prueba para la presentación del TP.
