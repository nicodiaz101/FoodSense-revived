# FoodSense SaaS — Plan Integral de Pruebas y Validación (TEST_PLAN.md)

**Versión:** 1.0.0  
**Fecha:** 2026-08-17  
**Propósito:** Definir la estrategia, niveles de prueba, matriz de casos de prueba y criterios de aceptación para validar integralmente todas las funciones del SaaS FoodSense antes de la entrega y evaluación académica.

---

## 1. Estrategia y Niveles de Prueba

El plan de pruebas se estructura en 4 niveles complementarios:

```
                  ┌───────────────────────────────┐
                  │    4. Pruebas de Usabilidad   │
                  │   & Responsive Mobile-First   │
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────▼───────────────┐
                  │     3. Pruebas E2E & SaaS     │
                  │  (Flujos completos de usuario)│
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────▼───────────────┐
                  │   2. Pruebas de Integración   │
                  │ (Supabase RLS + API Gemini)   │
                  └───────────────┬───────────────┘
                                  │
                  ┌───────────────▼───────────────┐
                  │     1. Pruebas Unitarias      │
                  │ (Cálculo de fechas, semáforo) │
                  └───────────────────────────────┘
```

1. **Pruebas Unitarias:** Lógica pura de fechas, semáforo de urgencia, inferencia de categorías y cálculo de estadísticas.
2. **Pruebas de Integración:** Comunicación del frontend con Supabase (CRUD + RLS) y con el Route Handler de Google Gemini (`/api/voice/actions`).
3. **Pruebas End-to-End (E2E):** Flujos de usuario completos desde el registro hasta el consumo y visualización de métricas.
4. **Pruebas de Seguridad & Multi-Tenancy (RLS):** Validación estricta de que el Usuario A no pueda leer ni alterar los productos del Usuario B.
5. **Pruebas de Usabilidad & Mobile:** Comportamiento responsivo en dispositivos móviles (iOS Safari, Android Chrome) y desktop.

---

## 2. Matriz Detallada de Casos de Prueba

### Módulo 1: Autenticación, Sesión y Aislamiento de Datos (Multi-Tenant)

| ID | Caso de Prueba | Precondiciones | Pasos de Ejecución | Resultado Esperado | Prioridad |
|---|---|---|---|---|---|
| **TC-AUTH-01** | Registro de nuevo usuario | Email no registrado | 1. Ingresar a `/register`<br>2. Completar nombre, email y contraseña segura<br>3. Enviar formulario | Cuenta creada en Supabase Auth, sesión iniciada y redirección a `/despensa`. | Alta |
| **TC-AUTH-02** | Validación de contraseña débil | En formulario de registro | 1. Ingresar clave menor a 8 caracteres o sin números/mayúsculas | Mensaje de error explícito impidiendo el envío. | Media |
| **TC-AUTH-03** | Inicio de sesión válido | Usuario registrado | 1. Ingresar credenciales correctas en `/login` | Sesión iniciada y carga del inventario del usuario. | Alta |
| **TC-AUTH-04** | Aislamiento RLS entre usuarios | Dos usuarios: User A y User B | 1. User A crea 3 productos en su despensa.<br>2. User B inicia sesión en otro navegador. | User B ve su despensa vacía. Las consultas a Supabase retornan solo filas donde `user_id = auth.uid()`. | **Crítica** |
| **TC-AUTH-05** | Cierre de sesión (Logout) | Sesión activa | 1. Ir a `/perfil` o menú lateral<br>2. Presionar "Cerrar sesión" | Sesión destruida, redirección a `/login` y caché local de inventario purgado. | Alta |

---

### Módulo 2: Despensa Inteligente & Urgencia de Vencimiento (US-07 a US-10)

| ID | Caso de Prueba | Precondiciones | Pasos de Ejecución | Resultado Esperado | Prioridad |
|---|---|---|---|---|---|
| **TC-PANTRY-01** | Ordenamiento por urgencia ascendente (US-07) | Usuario logueado | 1. Agregar 3 productos con vencimientos: Producto A (10 días), Producto B (1 día), Producto C (3 días).<br>2. Observar `/despensa`. | El orden visual estricto es: 1° Producto B (Rojo), 2° Producto C (Ámbar), 3° Producto A (Verde). | **Crítica** |
| **TC-PANTRY-02** | Filtrado por categoría (US-08) | Despensa con productos variados | 1. Seleccionar el chip "Lácteos" | La lista solo muestra lácteos, manteniendo el orden de urgencia interno. Contador de ítems actualizado. | Alta |
| **TC-PANTRY-03** | Búsqueda por texto en tiempo real | Despensa con múltiples ítems | 1. Escribir "leche" en la barra de búsqueda | Se filtran instantáneamente los productos cuyo nombre coincida sin recargar la página. | Alta |
| **TC-PANTRY-04** | Marcar producto como consumido (US-09) | Producto activo en despensa | 1. Presionar botón "Consumir" (icono check) en un producto | El producto desaparece de la lista activa y se incrementa el contador "Aprovechados este mes" (`consumed`) en `product_events`. | Alta |
| **TC-PANTRY-05** | Eliminar / Descartar producto (US-10) | Producto activo en despensa | 1. Presionar "Eliminar" (icono basura)<br>2. Confirmar en el diálogo | El producto se elimina de la despensa y se registra evento `wasted` en `product_events`. | Alta |

---

### Módulo 3: Motor de Voz e Inteligencia Artificial con Google Gemini

| ID | Caso de Prueba | Precondiciones | Pasos de Ejecución | Resultado Esperado | Prioridad |
|---|---|---|---|---|---|
| **TC-AI-01** | Carga de un producto por voz | Micrófono habilitado, `GEMINI_API_KEY` configurada | 1. Presionar "Comando de voz" en Home (`/`)<br>2. Decir: *"Compré dos paquetes de galletitas que vencen el viernes"*<br>3. Detener grabación | Gemini procesa el audio, transcribe el texto y abre `VoiceActionModal` con acción `agregar`, nombre "galletitas", cantidad 2, categoría `panificados` y fecha estimada calculada. | **Crítica** |
| **TC-AI-02** | Carga de múltiples productos en un solo audio | Micrófono habilitado | 1. Grabar: *"Compré un kilo de manzanas, dos leches descremadas y tres tomates"* | El modal muestra 3 operaciones individuales de tipo `agregar` con sus respectivas categorías (`frutas`, `lacteos`, `verduras`). | Alta |
| **TC-AI-03** | Eliminación de producto por voz | Producto "Yogur" existente en despensa | 1. Grabar: *"Ya me tomé el yogur"* | Gemini genera operación `eliminar` para el producto "Yogur". Al confirmar, se consume de la base de datos. | Alta |
| **TC-AI-04** | Edición interactiva antes de confirmar | Modal de voz abierto | 1. El usuario modifica manualmente la cantidad o la categoría sugerida en el modal antes de confirmar.<br>2. Presionar "Confirmar". | Se guardan en base de datos los valores editados por el usuario. | Alta |
| **TC-AI-05** | Manejo de audio incomprensible o silencio | Micrófono habilitado | 1. Iniciar grabación y guardar silencio o ruido blanco | La app muestra un mensaje amigable: *"No se pudo procesar el audio. Intentá de nuevo."* sin crashear. | Media |

---

### Módulo 4: Ingreso Manual y Escaneo de Código de Barras

| ID | Caso de Prueba | Precondiciones | Pasos de Ejecución | Resultado Esperado | Prioridad |
|---|---|---|---|---|---|
| **TC-SCAN-01** | Inferencia automática de categoría | En `/agregar` | 1. Escribir "Queso cremoso" en el campo nombre | La categoría cambia automáticamente a "Lácteos" y sugiere el estado y fecha estimada correspondiente. | Alta |
| **TC-SCAN-02** | Escaneo de código de barras (Cámara) | Permiso de cámara otorgado | 1. Abrir escáner de código de barras en `/agregar`<br>2. Apuntar la cámara a un código EAN-13 válido | El lector detecta el código, emite respuesta y autocompleta el nombre/categoría del producto. | Media |
| **TC-SCAN-03** | Sesión de agregado múltiple | En `/agregar` | 1. Completar producto A y presionar "Agregar otro"<br>2. Completar producto B y presionar "Finalizar" | Ambos productos se guardan en la despensa y se muestra el resumen de sesión. | Alta |

---

### Módulo 5: Centro de Alertas y Analíticas de Desperdicio

| ID | Caso de Prueba | Precondiciones | Pasos de Ejecución | Resultado Esperado | Prioridad |
|---|---|---|---|---|---|
| **TC-ALERT-01** | Detección de vencimiento crítico (≤1 día) | Producto con vencimiento hoy o mañana | 1. Ingresar a `/alertas` | El producto aparece en la sección crítica con tarjeta roja y sugerencia de consumo urgente. | Alta |
| **TC-ALERT-02** | Banner de aviso en Despensa | Productos urgentes existentes | 1. Ingresar a `/despensa` | Se visualiza el banner flotante de advertencia indicando la cantidad de productos que requieren atención. | Media |
| **TC-DASH-01** | Métricas del Dashboard (`/`) | Eventos registrados en el mes | 1. Consumir 3 productos y descartar 1.<br>2. Ir a la pantalla de inicio | Los contadores reflejan exactamente: "3 aprovechados", "1 desperdiciado" y el gráfico de barras por bandas de urgencia. | Alta |

---

## 3. Plan de Pruebas de Carga y Resiliencia (Edge Cases)

1. **Modo Sin Conexión / PWA:** Verificar que la interfaz informe amigablemente ante la pérdida de conexión y reintente la sincronización al volver el enlace.
2. **Productos con el mismo nombre y distinta fecha:** Verificar que el sistema permita tener "Leche" que vence hoy y "Leche" que vence la próxima semana como dos registros independientes con cantidades claras.
3. **Formatos de Audio Diversos:** Probar el endpoint `/api/voice/actions` con audio grabado desde Chrome en Windows (WebM Opus) y Safari en iOS (MP4/AAC).

---

## 4. Guía de Ejecución de Pruebas Automatizadas

### 4.1 Pruebas Unitarias con Vitest
Para validar algoritmos de fechas y reglas de negocio:

```bash
cd web
# Ejecutar suite de pruebas unitarias
pnpm test
```

*Ejemplo de prueba a incluir (`src/lib/__tests__/urgency.test.ts`):*
- Validar que `days <= 1` retorne tono `critical` (Rojo).
- Validar que `days <= 4` retorne tono `warning` (Ámbar).
- Validar que `days > 4` retorne tono `positive` (Verde).

### 4.2 Pruebas de Compilación y Linter (CI/CD Quality Gate)
```bash
cd web
pnpm lint     # Verificación de sintaxis y buenas prácticas
pnpm build    # Verificación de compilación estricta TypeScript y Next.js
```

---

## 5. Criterios de Aceptación para la Entrega del TP SaaS

- [x] **100% de Casos Críticos Aprobados:** Autenticación, RLS, orden por urgencia y procesamiento por voz con Gemini funcionando sin caídas.
- [x] **Cero Errores en Consola:** No deben existir excepciones no controladas ni advertencias críticas de React.
- [x] **Tiempo de Respuesta de IA:** La llamada a Gemini API (`/api/voice/actions`) debe resolver en menos de 3.5 segundos en condiciones normales de red.
- [x] **Diseño Responsivo:** Verificado en resoluciones móviles (375px a 430px) y de escritorio (1080p).
