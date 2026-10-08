# KenKen Maker 2.0

Generador de puzzles [KenKen](http://kenkenpuzzle.com) escrito en TypeScript.
Garantiza la generación de puzzles con **exactamente una solución válida**.

## Requisitos
- Node.js (versión 20.x o superior recomendada)
- npm

## Instalación

1. Clona el repositorio e instala las dependencias:
   ```bash
   npm install
   ```

2. **Instalación del navegador (Playwright)**
   Este proyecto utiliza Playwright para renderizar los puzzles a imágenes PNG. Debes instalar los navegadores requeridos, en especial Chromium:
   ```bash
   npx playwright install chromium
   ```

## Compilación y Pruebas

Para compilar el código TypeScript a JavaScript:
```bash
npm run build
```

Para ejecutar el conjunto de pruebas automatizadas:
```bash
npm test
```

## Uso

La herramienta principal permite generar lotes de puzzles KenKen garantizando unicidad y validando cada tablero antes de guardarlo.

### Comandos de Ejemplo

- **Generar el lote completo (3x3 a 9x9, 4 de cada tamaño)** (Configuración predeterminada):
  ```bash
  npm run generate
  ```

- **Generar un único puzzle (por ejemplo, 5x5):**
  ```bash
  npm run generate -- --min-size 5 --max-size 5 --per-size 1
  ```

- **Generar cuatro puzzles de un tamaño específico (ej. 6x6):**
  ```bash
  npm run generate -- --min-size 6 --max-size 6 --per-size 4
  ```

- **Generar usando una semilla reproducible (para obtener siempre los mismos puzzles):**
  ```bash
  npm run generate -- --seed 12345
  ```

- **Generar mostrando logs detallados de progreso (recomendado para 8x8 y 9x9):**
  ```bash
  npm run generate -- --verbose
  ```

> **Advertencia:** Los tamaños 8x8 y 9x9 pueden tardar más tiempo debido a la naturaleza exponencial del algoritmo de comprobación de unicidad.

### Opciones de Línea de Comandos

| Opción | Descripción | Valor Predeterminado |
|--------|-------------|----------------------|
| `--min-size N` | Tamaño mínimo del tablero | `3` |
| `--max-size N` | Tamaño máximo del tablero | `9` |
| `--per-size N` | Cantidad de puzzles por tamaño | `4` |
| `--output DIR` | Directorio de salida | `output` |
| `--seed N` | Semilla aleatoria | (aleatoria) |
| `--verbose` | Muestra el progreso de cada intento | `false` |
| `--max-attempts N` | Número máximo de intentos antes de abortar | `500` |

---

## Estructura de Salida

El programa genera los resultados en el directorio `output` con la siguiente estructura:

```
output/
  3x3.json
  3x3_solutions.json
  4x4.json
  ...
  9x9.json
  images/
    imagen3x3_1.png
    imagen3x3_2.png
    ...
    imagen9x9_4.png
```

### Formato JSON

El formato de los archivos JSON generados es el siguiente:

```json
{
  "n": 3,
  "images": [
    {
      "filename": "imagen3x3_1.png",
      "cages": [
        {
          "op": "-",
          "target": 2,
          "cells": [[0, 0], [0, 1]]
        },
        {
          "op": "+",
          "target": 5,
          "cells": [[0, 2], [1, 2]]
        },
        {
          "op": "=",
          "target": 1,
          "cells": [[2, 2]]
        }
      ]
    }
  ]
}
```

*Nota: Se generarán operaciones estándar del tipo `+`, `-`, `x`, `÷` y `=`. Las coordenadas de las celdas están en formato `[fila, columna]` iniciando en 0.*

## Garantía de Solución Única (Validación)

A diferencia de muchos generadores sencillos, **este generador comprueba la unicidad del puzzle de forma estricta**.

El flujo de generación es el siguiente:
1. Crea un tablero resuelto válido (cuadrado latino).
2. Agrupa las celdas contiguas en jaulas (cages) y determina las operaciones y objetivos.
3. Se desechan las jaulas inválidas (ej. `-` o `÷` con más de 2 celdas).
4. El puzzle se somete a un **solucionador por backtracking (fuerza bruta)**.
5. El solucionador busca hasta dos soluciones válidas para toda la cuadrícula.
6. **Descarte:** 
   - Si se encuentran **0 soluciones** (por error en la generación o en la configuración) el puzzle se **descarta**.
   - Si se encuentran **2 o más soluciones**, el puzzle es ambiguo y se **descarta**.
   - Solo se acepta un puzzle y se renderiza si se encuentra **exactamente 1 solución**.

## Solución de Problemas

**Error de "Chromium browser not found" o fallos en el renderizado:**
- Playwright necesita el binario del navegador para capturar la imagen. Ejecuta:
  `npx playwright install chromium`

**Generador atascado o que falla en 8x8 / 9x9:**
- La búsqueda de un puzzle único de 9x9 puede requerir decenas de intentos descartados. Usa `--verbose` para visualizar los rechazos. Si el algoritmo aborta por intentos excesivos, intenta aumentar el límite mediante `--max-attempts 2000`.

**El código antiguo usando `main.ts` lanza error de ts-node o .sbv:**
- El soporte legado se encuentra en `.sbv` pero se recomienda utilizar `npm run generate` para obtener el formato modernizado JSON+PNG directamente.