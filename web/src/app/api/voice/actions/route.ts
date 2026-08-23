import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType, Schema } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error: "Falta configurar GEMINI_API_KEY en las variables de entorno.",
        },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { audio_base64, mime_type } = body;

    if (!audio_base64) {
      return NextResponse.json(
        { error: "No se proporcionó audio_base64." },
        { status: 400 }
      );
    }

    const rawMime = mime_type || "audio/webm";
    let cleanMimeType = rawMime.split(";")[0].trim().toLowerCase();
    if (!cleanMimeType.startsWith("audio/")) {
      cleanMimeType = "audio/webm";
    }

    const schemaConfig: Schema = {
      type: SchemaType.OBJECT,
      properties: {
        transcripcion: {
          type: SchemaType.STRING,
          description: "Transcripción textual del audio del usuario.",
        },
        resultado: {
          type: SchemaType.OBJECT,
          properties: {
            operaciones: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  accion: {
                    type: SchemaType.STRING,
                    format: "enum",
                    enum: ["agregar", "eliminar", "actualizar"],
                    description: "Acción de inventario a realizar.",
                  },
                  producto: {
                    type: SchemaType.STRING,
                    description: "Nombre del alimento o producto.",
                  },
                  cantidad: {
                    type: SchemaType.INTEGER,
                    description: "Cantidad de unidades (por defecto 1).",
                  },
                  categoria: {
                    type: SchemaType.STRING,
                    format: "enum",
                    enum: [
                      "lacteos",
                      "carnes",
                      "verduras",
                      "frutas",
                      "panificados",
                      "bebidas",
                      "huevos",
                      "conservas",
                    ],
                    description: "Categoría asignada al producto.",
                  },
                  fecha_vencimiento: {
                    type: SchemaType.STRING,
                    nullable: true,
                    description:
                      "Fecha calculada en formato YYYY-MM-DD si se menciona en el audio, o null.",
                  },
                  campo_actualizar: {
                    type: SchemaType.STRING,
                    nullable: true,
                    description:
                      "Si accion es actualizar, el campo a modificar (ej. 'fecha_vencimiento').",
                  },
                  nuevo_valor: {
                    type: SchemaType.STRING,
                    nullable: true,
                    description:
                      "Si accion es actualizar, el nuevo valor (ej. fecha YYYY-MM-DD).",
                  },
                },
                required: ["accion", "producto", "cantidad", "categoria"],
              },
            },
          },
          required: ["operaciones"],
        },
      },
      required: ["transcripcion", "resultado"],
    };

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schemaConfig,
      },
    });

    const todayISO = new Date().toISOString().split("T")[0];
    const systemPrompt = `Eres el asistente de voz inteligente de FoodSense, una app de gestión de despensa y alimentos.
Fecha actual: ${todayISO}.

Tu tarea:
1. Escuchar atentamente el audio del usuario (en español).
2. Transcribir el comando en el campo "transcripcion".
3. Identificar cada producto mencionado y generar su operación correspondiente en "resultado.operaciones":
   - "agregar": cuando el usuario compró, guardó o sumó alimentos (ej. "compré dos leches descremadas y 3 manzanas").
   - "eliminar": cuando el usuario consumió, gastó, tiró o borró productos (ej. "ya nos comimos las empanadas", "tira el yogur").
   - "actualizar": cuando el usuario modifica datos (ej. "cambiá el vencimiento de la leche al 30 de agosto").

Reglas de categorías:
- Mapea siempre a una de: "lacteos", "carnes", "verduras", "frutas", "panificados", "bebidas", "huevos", "conservas".

Reglas de fechas:
- Si el usuario menciona una fecha relativa (ej. "vence en 4 días", "vence el viernes que viene", "para fin de mes") o una fecha exacta, calcúlala a partir de hoy (${todayISO}) en formato YYYY-MM-DD.
- Si no se menciona fecha, deja "fecha_vencimiento" como null.`;

    let result;
    try {
      result = await model.generateContent([
        systemPrompt,
        {
          inlineData: {
            data: audio_base64,
            mimeType: cleanMimeType,
          },
        },
      ]);
    } catch (primaryErr) {
      console.warn("Fallo con gemini-2.0-flash, reintentando con gemini-1.5-flash:", primaryErr);
      const fallbackModel = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schemaConfig,
        },
      });
      result = await fallbackModel.generateContent([
        systemPrompt,
        {
          inlineData: {
            data: audio_base64,
            mimeType: cleanMimeType,
          },
        },
      ]);
    }

    const text = result.response.text();
    const parsed = JSON.parse(text);

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[api/voice/actions] Error procesando audio con Gemini:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error interno procesando el audio.",
      },
      { status: 500 }
    );
  }
}
