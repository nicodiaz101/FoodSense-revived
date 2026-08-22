# FoodSense SaaS — Especificación Técnica del Sistema (SPECS.md)

**Versión del documento:** 2.0.0  
**Estado:** Aprobado / Base de Desarrollo  
**Fecha:** 2026-08-17  
**Proyecto:** FoodSense — Gestor Inteligente de Almacén Familiar y Reducción de Desperdicio de Alimentos (SaaS)

---

## 1. Visión General y Modelo de Dominio SaaS

### 1.1 Propósito del Producto
FoodSense es una plataforma **SaaS (Software as a Service) mobile-first y cloud-native** orientada a hogares y familias para gestionar el inventario de despensa, refrigerador y alacena, priorizando los alimentos según su urgencia de vencimiento para **eliminar el desperdicio de comida y generar ahorro económico familiar**.

### 1.2 Modelo SaaS Multi-Tenant
- **Tenant = Hogar / Despensa Familiar (Household):** Un hogar puede estar compuesto por uno o más miembros (roles: `owner`, `admin`, `member`).
- **Aislamiento Estricto de Datos:** Cada usuario u hogar solo puede consultar, modificar y recibir alertas de sus propios productos mediante **Row Level Security (RLS)** en base de datos.
- **Modelo de Cuentas / Tiers (Simulación SaaS para TP):**
  - **Tier Gratuito (Free):** 1 Despensa/Hogar, productos activos ilimitados, alertas básicas.
  - **Tier Familiar / Pro (SaaS Premium):** Despensas ilimitadas (ej. Casa, Oficina), miembros familiares ilimitados con sincronización en tiempo real, **Operaciones de voz IA con Gemini exclusivas**, analíticas avanzadas de ahorro y exportación de métricas.

---

## 2. Pila Tecnológica y Versiones Fijadas

Para garantizar estabilidad y evitar divergencias de dependencias, se fijan las siguientes versiones de referencia:

| Capa | Tecnología | Versión Fijada | Justificación Técnica |
|---|---|---|---|
| **Runtime** | Node.js | `>=20.18.0 LTS` (recomendado `22.x`) | Estabilidad de LTS en servidor y CI/CD |
| **Package Manager** | `pnpm` | `10.x` / `11.x` | Rendimiento de resolución y aislamiento estricto |
| **Framework Web / App** | **Next.js** (App Router) | `16.2.x` (o `15.x/16.x` compatible) | Server Actions, API Route Handlers, SSR/SSG y PWA |
| **Biblioteca UI** | **React** | `19.2.x` | Compatibilidad nativa con Server Components y hooks modernos |
| **Lenguaje** | **TypeScript** | `^5.4.0` | Tipado estricto en modelos de datos, API y contratos |
| **Estilos & Diseño** | **Tailwind CSS** + PostCSS | `v4.x` | Tokens nativos en CSS (`@theme`), cero runtime overhead |
| **Base de Datos** | **Supabase (PostgreSQL 16+)** | `@supabase/supabase-js: ^2.x` | Motor relacional ACID, RLS nativo, integración de JWT de terceros. |
| **Autenticación** | **Firebase Auth** | `firebase: ^12.x` | Gestión simple de usuarios, Login con Google integrado, sin fricción de tokens manuales. |
| **Motor de IA Multimodal** | **Google Gemini API** | `@google/genai` o `@google/generative-ai: ^0.24.x` | Procesamiento nativo de audio a JSON estructurado en una sola llamada |
| **Escaneo de Códigos** | `@zxing/browser` + Open Food Facts API | `^0.2.0` | Lectura EAN-13/UPC por cámara y enriquecimiento con base abierta |
| **Testing** | Vitest + Playwright | `vitest: ^3.0.x`<br>`@playwright/test: ^1.50.x` | Pruebas unitarias ultrarrápidas y pruebas E2E multi-dispositivo |

---

## 3. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            CLIENTE (Browser / PWA)                          │
│  Mobile-First Responsive Layout (Plus Jakarta Sans, Tokens UI HSL)          │
│  - Captura Audio (MediaRecorder WebM/WAV)                                    │
│  - Escáner Cámara / Barcode (@zxing/browser)                                │
│  - Service Worker (Push Notifications & Offline PWA)                        │
└───────────────────────┬───────────────────────────────┬─────────────────────┘
                        │                               │
        (1) HTTPS / SSR / Client Routes        (2) API Handlers / Server Actions
                        │                               │
┌───────────────────────▼───────────────────────────────▼─────────────────────┐
│                         NEXT.JS APP ROUTER (Backend)                        │
│                                                                             │
│  ├── /api/voice/actions ───► Conexión a Gemini API (Audio In -> JSON Out)    │
│  ├── /api/barcode/[ean] ───► Consulta Open Food Facts / Catálogo Interno    │
│  ├── Middleware Auth ──────► Validación de Sesión Supabase SSR / JWT        │
│  └── Cron / Background ────► Evaluación diaria de vencimientos y Push       │
└───────────────────────┬───────────────────────────────┬─────────────────────┘
                        │                               │
            (3) Supabase Client / SQL (RLS)    (4) Google AI SDK
                        │                               │
┌───────────────────────▼─────────────┐   ┌─────────────▼─────────────────────┐
│    SUPABASE (PostgreSQL 16)         │   │       GOOGLE GEMINI API           │
│  - Integración Third-Party Auth     │   │  Modelo: gemini-2.0-flash         │
│  - Tablas: households, products,    │   │  Audio Multimodal + Structured    │
│    product_events, categories       │   │  JSON Schema Output               │
│  - Row Level Security (RLS)         │   └───────────────────────────────────┘
│  - PostgreSQL Functions & Triggers  │
└─────────────────────────────────────┘
         ▲
         │ (5) Validación JWT en BD (Automática)
┌────────┴────────────────────────────┐
│          FIREBASE AUTH              │
│  - Login con Google / Email         │
│  - Emisión de JWT                   │
└─────────────────────────────────────┘
```

---

## 4. Estrategia de Base de Datos y Migración de Control

### 4.1 Decisión Arquitectónica: Arquitectura Híbrida (Firebase Auth + Supabase DB)
Se mantiene la arquitectura híbrida original documentada en el proyecto. 
Firebase Auth seguirá manejando el login (Email/Contraseña y Login con Google) dado que es un flujo ya consolidado, cómodo y efectivo en el frontend.

**¿Por qué se mantiene y cómo se evita pelear con JWT?**
1. **Google Login Fácil:** Firebase Auth ya provee el login con Google de manera muy sencilla.
2. **Cero manipulación manual de JWT en código:** El cliente de Supabase en el frontend (`supabase-client.ts`) ya está configurado para inyectar automáticamente el token de Firebase (`auth.currentUser?.getIdToken()`). No necesitas escribir código complejo para parsear ni validar JWTs.
3. **Validación automática en Supabase:** Al configurar Firebase como proveedor "Third-Party Auth" en el dashboard de tu nuevo proyecto Supabase, la base de datos se encarga de validar la firma del token automáticamente y aplicar las políticas de Row Level Security (RLS) usando el `auth.jwt()->>'sub'` (que corresponde al UID de Firebase).
4. **Control Total:** Creás tu propio proyecto gratuito en Supabase, corres el script SQL y configuras la integración con tu Firebase existente en 2 minutos.

### 4.2 Esquema Relacional de Base de Datos (PostgreSQL DDL)

```sql
-- Extensión para IDs únicos
create extension if not exists "pgcrypto";

-- 1. Tabla de Hogares / Despensas (Multi-tenancy)
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mi Hogar',
  created_by text not null,
  created_at timestamptz not null default now()
);

-- 2. Miembros de Hogares (Colaboración familiar)
create table if not exists household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  user_id text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  unique (household_id, user_id)
);

-- 3. Tabla de Productos en Despensa
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  user_id text not null,
  name text not null,
  category text not null,
  state text not null default 'cerrado',
  expires_at date not null,
  quantity integer default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_products_user_expires on products(user_id, expires_at);
create index if not exists idx_products_household_expires on products(household_id, expires_at);

-- 4. Registro de Eventos para Analíticas de Desperdicio / Ahorro
create table if not exists product_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  household_id uuid references households(id) on delete cascade,
  product_name text,
  category text,
  type text not null check (type in ('consumed', 'wasted')),
  quantity integer default 1,
  estimated_cost_ars numeric(10,2) default 0.00,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_events_user_date on product_events(user_id, occurred_at);

-- 5. Trigger para actualizar updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_products_updated_at
  before update on products
  for each row execute function update_updated_at_column();

-- 6. Configuración de Row Level Security (RLS) con JWT de Firebase
alter table households enable row level security;
alter table household_members enable row level security;
alter table products enable row level security;
alter table product_events enable row level security;

grant select, insert, update, delete on products to anon, authenticated;
grant select, insert, update, delete on product_events to anon, authenticated;
grant select, insert, update, delete on households to anon, authenticated;
grant select, insert, update, delete on household_members to anon, authenticated;

-- Políticas de Seguridad (Aislamiento por Usuario y Hogar basado en Firebase UID)
create policy "products_firebase_issuer"
  on products as restrictive to anon, authenticated
  using (
    auth.jwt()->>'iss' = 'https://securetoken.google.com/foodsense-revive'
    and auth.jwt()->>'aud' = 'foodsense-revive'
  );

create policy "events_firebase_issuer"
  on product_events as restrictive to anon, authenticated
  using (
    auth.jwt()->>'iss' = 'https://securetoken.google.com/foodsense-revive'
    and auth.jwt()->>'aud' = 'foodsense-revive'
  );

create policy "users_access_own_households"
  on households for all
  using (created_by = (auth.jwt()->>'sub'));

create policy "members_access_household_members"
  on household_members for all
  using (user_id = (auth.jwt()->>'sub'));

create policy "users_manage_own_products"
  on products for all
  using (user_id = (auth.jwt()->>'sub'))
  with check (user_id = (auth.jwt()->>'sub'));

create policy "users_manage_own_events"
  on product_events for all
  using (user_id = (auth.jwt()->>'sub'))
  with check (user_id = (auth.jwt()->>'sub'));
```

---

## 5. Especificación de la Integración con Gemini AI

### 5.1 Reemplazo de Arquitectura Anterior
- **Anterior:** Frontend WebM -> AWS API Gateway -> AWS Lambda -> OpenAI Whisper (Transcripción) -> OpenAI GPT-4 (Extracción) -> JSON.
- **Nueva:** Frontend WebM/Base64 -> Next.js Route Handler (`/api/voice/actions`) -> **Google Gemini 2.0 Flash / 2.5 Flash** con entrada de Audio nativa y salida estructurada JSON (`responseSchema`).

### 5.2 Endpoint de API: `/api/voice/actions`
- **Método:** `POST`
- **Headers:** `Content-Type: application/json` o `multipart/form-data`
- **Body de Entrada:**
  ```json
  {
    "audio_base64": "GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH...",
    "mime_type": "audio/webm"
  }
  ```

### 5.3 Contrato de Salida de Gemini (Structured JSON Schema)
```json
{
  "transcripcion": "Compré dos leches descremadas que vencen el 25 de agosto y un paquete de fideos",
  "resultado": {
    "operaciones": [
      {
        "accion": "agregar",
        "producto": "leche descremada",
        "cantidad": 2,
        "categoria": "lacteos",
        "fecha_vencimiento": "2026-08-25",
        "campo_actualizar": null,
        "nuevo_valor": null
      },
      {
        "accion": "agregar",
        "producto": "fideos",
        "cantidad": 1,
        "categoria": "conservas",
        "fecha_vencimiento": null,
        "campo_actualizar": null,
        "nuevo_valor": null
      }
    ]
  }
}
```

### 5.4 Reglas de Prompting del Motor Gemini
1. **Normalización de Categorías:** Mapear estrictamente a uno de: `lacteos`, `carnes`, `verduras`, `frutas`, `panificados`, `bebidas`, `huevos`, `conservas`.
2. **Inferencia de Acciones:** Soportar `agregar` (compré, sumá, guardé), `eliminar` (consumí, tiré, gasté, borrá), `actualizar` (cambiá la fecha de X a Y).
3. **Resolución de Fechas Relativas:** Si el usuario dice "vence en 5 días", Gemini calcula `fecha_vencimiento = CURRENT_DATE + 5 días`.

---

## 6. Alcance del Proyecto SaaS (Límites y No-Objetivos)

### 6.1 Dentro del Alcance (In-Scope - MVP SaaS para TP)
- [x] **Autenticación SaaS:** Registro, Login, Recuperación de contraseña y Logout vía Supabase Auth.
- [x] **Despensa Inteligente (US-07 a US-10):** Lista ordenada por urgencia de vencimiento, chips de filtrado por categoría, buscador en tiempo real, marcar como consumido y eliminar.
- [x] **Motor de IA con Gemini:** Carga y edición de inventario mediante comandos de voz por micrófono.
- [x] **Ingreso Rápido & Código de Barras:** Formulario inteligente con inferencia de categoría y escáner de código de barras vía cámara (`@zxing/browser`).
- [x] **Centro de Alertas & Notificaciones:** Pantalla de alertas con clasificación por tono (Crítica, Advertencia, Informativa) y notificaciones Push Web / Service Worker.
- [x] **Dashboard de Impacto Familiar:** Métricas mensuales de productos aprovechados vs desperdiciados y estimación de ahorro.
- [x] **Diseño Responsivo Mobile-First:** Experiencia tipo app nativa en móviles y panel con sidebar en tablets/desktop.

### 6.2 Fuera del Alcance (Non-Goals / Postergado)
- ❌ **Aplicación Android Nativa Kotlin/Jetpack Compose:** Postergada explícitamente para priorizar la entrega SaaS Web.
- ❌ **Procesamiento OCR complejo de tickets de papel largos:** Se reemplaza prioritariamente por carga rápida por voz con Gemini y código de barras.
- ❌ **Integración con pasarelas de pago reales (Stripe/MercadoPago):** El modelo SaaS y tiers se simularán conceptualmente para la evaluación académica.

---

## 7. Variables de Entorno Requeridas (`.env.local`)

```bash
# Supabase (Base de datos propia y Auth)
NEXT_PUBLIC_SUPABASE_URL=https://<TU-PROJECT-REF>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJh... (Publishable Anon Key)

# Google Gemini AI API
GEMINI_API_KEY=AIzaSy... (Obtenida de Google AI Studio)

# Web Push Notifications (Opcional para FCM / VAPID)
NEXT_PUBLIC_FIREBASE_VAPID_KEY=...
```
