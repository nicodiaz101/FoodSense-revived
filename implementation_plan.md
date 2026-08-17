# Plan de Implementación: Resurrección & Evolución SaaS de FoodSense

Este documento describe la estrategia técnica para revivir FoodSense como una **plataforma SaaS web mobile-first**, migrar la base de datos a una instancia bajo control directo en Supabase, y modernizar la inteligencia artificial integrando la **API de Google Gemini**.

> **Nota:** La migración a Android nativo queda oficialmente postergada para priorizar la entrega del proyecto como solución SaaS.

---

## 1. Resumen de Cambios Clave

1. **Base de Datos & Auth Propios:** Migración desde la antigua instancia compartida a un proyecto propio de Supabase con PostgreSQL 16+, activando Row Level Security (RLS) para aislamiento multi-tenant.
2. **IA Multimodal con Google Gemini:** Reemplazo total del antiguo backend de AWS Lambda + OpenAI por un Route Handler local (`/api/voice/actions`) que envía audio directamente a Gemini 2.0 Flash y recibe operaciones estructuradas JSON en una sola llamada.
3. **Evolución SaaS:** Dashboard de métricas de ahorro y reducción de desperdicio, centro de alertas por urgencia de vencimiento y arquitectura multi-tenant lista para colaboración familiar.

---

## 2. Documentos del Proyecto Creados

- 📄 **[SPECS.md](file:///d:/Documents/GitHub/FoodSense-native/SPECS.md):** Especificación técnica formal, modelo de dominio SaaS, arquitectura, límites de alcance, versiones fijadas y esquema DDL de PostgreSQL.
- 🗺️ **[ROADMAP.MD](file:///d:/Documents/GitHub/FoodSense-native/ROADMAP.MD):** Hoja de ruta dividida en 5 fases de ejecución desde la infraestructura hasta el despliegue.
- 📋 **[task.md](file:///d:/Documents/GitHub/FoodSense-native/task.md):** Backlog de tareas granulares con identificadores de seguimiento.
- 🧪 **[TEST_PLAN.md](file:///d:/Documents/GitHub/FoodSense-native/TEST_PLAN.md):** Matriz integral de pruebas (Unitarias, Integración, E2E, Seguridad RLS y Usabilidad Mobile).

---

## 3. Próximos Pasos Inmediatos para Ejecución

1. **Crear proyecto en Supabase** y ejecutar el script SQL de [SPECS.md](file:///d:/Documents/GitHub/FoodSense-native/SPECS.md#42-esquema-relacional-de-base-de-datos-postgresql-ddl).
2. **Generar API Key en Google AI Studio** para `GEMINI_API_KEY`.
3. **Completar archivo `.env.local`** con las credenciales nuevas.
4. **Implementar el Route Handler de Gemini** (`/api/voice/actions`) y conectar `VoiceButton`.
