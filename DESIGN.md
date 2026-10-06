# SecureCampus — Design System & Institutional Identity

Este documento define el sistema de diseño visual, tipografía, paleta de colores, componentes y directrices estéticas de **SecureCampus**, extraído y sincronizado directamente desde el proyecto de diseño en **Stitch** (*SecureCampus Institutional Identity*).

---

## 1. Filosofía de Diseño: Modern Institutional Minimalism

El sistema de diseño proyecta **autoridad institucional, integridad académica y precisión operativa**. Está concebido para administradores, directores académicos, profesores y estudiantes de educación superior.

* **Tono y Personalidad:** Formal, confiable, sobrio, altamente estructurado y seguro.
* **Jerarquía Visual:** Prioriza la alta densidad de información sin saturación visual (*high-density information architecture*). Se eliminan adornos puramente decorativos en favor de tipografía funcional, delimitaciones nítidas de 1px y estados cromáticos explícitos.
* **Propósito Cognitivo:** Minimizar la fatiga visual durante jornadas intensivas de consulta, auditoría académica y captura de calificaciones.

---

## 2. Paleta de Colores Institucional (Navy & Slate)

### Colores Principales y de Marca

| Token | HEX | Rol y Aplicación |
| :--- | :--- | :--- |
| `primary` | `#1e3a8a` / `#00236f` | **Collegiate Navy:** Color primario institucional. Botones de acción principal (CTA), headers activos, nodos de navegación seleccionados. |
| `primary-hover` | `#1e40af` | Estado hover de acciones primarias. |
| `primary-active` | `#172554` | Estado presionado / activo. |
| `secondary` | `#0f172a` / `#565e74` | **Deep Slate:** Textos de máximo contraste, títulos principales, cabeceras de tablas y tarjetas maestras. |
| `tertiary` | `#2563eb` | **Tertiary Blue:** Enlaces interactivos, anillos de foco accesibles (`focus-ring`), barras de progreso y acentos secundarios. |
| `accent-tint` | `#4059aa` | Matiz de superficie y acentos de navegación. |

### Superficies y Fondos (*Surfaces & Canvas*)

| Token | HEX | Propósito |
| :--- | :--- | :--- |
| `background` / `surface` | `#f8fafc` / `#f8f9ff` | Lienzo base de la aplicación (gris frío pizarra para evitar fatiga ocular). |
| `surface-container-lowest` | `#ffffff` | Fondo de tarjetas elevadas, hojas de datos, tablas y modales. |
| `surface-container-low` | `#eff4ff` | Fondos de secciones alternas, filas seleccionadas. |
| `surface-container` | `#e5eeff` | Paneles informativos secundarios. |
| `surface-container-high` | `#dce9ff` | Paneles de auditoría o bloques de resumen académico. |
| `surface-container-highest`| `#d3e4fe` | Resaltados de métricas o filtros activos. |

### Bordes y Separadores Estructurales

| Token | HEX | Propósito |
| :--- | :--- | :--- |
| `border-subtle` | `#f1f5f9` | Líneas divisorias de filas interiores de tablas (`slate-100`). |
| `border-default` | `#e2e8f0` | Cuadrículas estructurales, bordes de contenedores y tarjetas (`slate-200`). |
| `border-strong` | `#cbd5e1` | Bordes de inputs, dropdowns y menús emergentes (`slate-300`). |
| `border-focus` | `#2563eb` | Borde de foco accesible. |

### Paleta Semántica y Validación Académica

| Estado | Fondo (`bg`) | Borde (`border`) | Texto / Icono (`text`) | Contexto Académico |
| :--- | :--- | :--- | :--- | :--- |
| **Aprobado / Regular** | `#ecfdf5` | `#a7f3d0` | `#065f46` (`#059669`) | Materias aprobadas, expediente al corriente, credenciales activas. |
| **Advertencia / Revisión** | `#fffbeb` | `#fde68a` | `#92400e` (`#d97706`) | Alumnos condicionales, adeudos pendientes, prerrequisitos en revisión. |
| **Crítico / Disciplinary** | `#fef2f2` | `#fecaca` | `#991b1b` (`#dc2626`) | Materias reprobadas, bajas académicas, bloqueos de seguridad. |
| **Inactivo / Histórico** | `#f1f5f9` | `#cbd5e1` | `#475569` | Periodos concluidos, materias archivadas, usuarios suspendidos. |

---

## 3. Tipografía: Familia Inter

La tipografía oficial es **Inter** (`sans-serif`), seleccionada por su legibilidad clínica y soporte nativo para cifras tabulares uniformes.

```css
font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
font-feature-settings: "cv02", "cv03", "cv04", "cv11", "tnum"; /* Tabular numbers habilitado */
```

> **Regla de Oro:** Todas las representaciones numéricas (matrículas, calificaciones, promedios, grupos, aulas, créditos) deben utilizar `font-variant-numeric: tabular-nums` para permitir comparación vertical uniforme en tablas.

### Escala Tipográfica

| Nivel | Tamaño / Line Height | Peso | Tracking | Uso |
| :--- | :--- | :--- | :--- | :--- |
| `display-lg` | 32px / 40px | 700 (Bold) | -0.02em | Títulos de login institucional y landing. |
| `headline-lg` | 24px / 32px | 600 (SemiBold) | -0.015em | Encabezados de módulo o dashboard principal. |
| `headline-md` | 18px / 24px | 600 (SemiBold) | -0.01em | Títulos de secciones y títulos de tarjetas maestras. |
| `headline-sm` | 16px / 22px | 600 (SemiBold) | Normal | Títulos de modales y subtítulos de grupo. |
| `body-lg` | 15px / 22px | 400 (Regular) | Normal | Párrafos introductorios y descripciones. |
| `body-md` | 13px / 18px | 400 (Regular) | Normal | **Texto estándar de tablas administrativas y datos.** |
| `body-sm` | 12px / 16px | 400 (Regular) | Normal | Descripciones secundarias y metadatos. |
| `label-md` | 12px / 16px | 500 (Medium) | +0.01em | Etiquetas de campos de formulario (`<label>`). |
| `label-sm` | 11px / 14px | 600 (SemiBold) | +0.03em | Chips y badges de estado en **MAYÚSCULAS**. |
| `code-num` | 13px / 18px | 500 (Medium) | Tabular | Matrículas, códigos de asignatura, notas y GPA. |

---

## 4. Sistema de Espaciado y Cuadrícula

### Grid Administrativo
* **Desktop (≥ 1280px):** Cuadrícula de 12 columnas. Margen exterior de `24px` (`1.5rem`), canalones (*gutters*) de `24px`. Barra de navegación lateral fija (`240px` expandida, `64px` colapsada).
* **Tablet (768px – 1279px):** Cuadrícula de 8 columnas, márgenes y canalones de `16px`. Navegación colapsable.
* **Mobile (< 768px):** Flujo de 1 columna con márgenes de `16px`. Tablas adaptadas a vista de tarjetas compactas.

### Escala de Espaciado
* `space-xs`: `4px` (separación entre icono y texto, padding micro)
* `space-sm`: `6px` (padding interior de inputs densos y celdas de tabla)
* `space-md`: `12px` (gap entre campos de formulario y botones de grupo)
* `space-lg`: `20px` (padding de tarjetas y paneles)
* `space-xl`: `28px` (separación entre secciones mayores)

---

## 5. Formas y Radio de Esquinas (*Border Radius*)

El sistema mantiene una estética geométrica, limpia e institucional:

* `rounded-sm` (`2px`): Casillas de verificación (*checkboxes*), mini tags y badges compactos.
* `rounded-md` (`4px`): **Estándar institucional** para inputs, botones de acción, celdas de tabla y selectores.
* `rounded-lg` (`8px`): Tarjetas contenedoras, paneles maestros y cuadros de diálogo modales.
* `rounded-full` (`9999px`): **Estrictamente reservado** para avatares circulares de usuario y contadores numéricos circulares. *(Quedan prohibidos los botones estilo píldora para preservar el rigor institucional).*

---

## 6. Elevación, Sombras y Capas

1. **Capa 0 (Canvas Base):** `#f8fafc` sin sombras.
2. **Capa 1 (Tarjetas, Paneles, Tablas):** Fondo `#ffffff`, borde continuo `1px solid #e2e8f0`, sombra difusa:
   `box-shadow: 0 1px 3px 0 rgba(15, 23, 42, 0.05);`
3. **Capa 2 (Menús desplegables, Popovers):** Fondo `#ffffff`, borde `1px solid #cbd5e1`, sombra:
   `box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04);`
4. **Capa 3 (Diálogos Modales, Drawers de Auditoría):** Cortina de fondo `rgba(15, 23, 42, 0.45)` con `backdrop-filter: blur(2px)`, sombra:
   `box-shadow: 0 20px 25px -5px rgba(15, 23, 42, 0.12), 0 10px 10px -5px rgba(15, 23, 42, 0.04);`

---

## 7. Especificación de Componentes Base

### Botones (`Button`)
* **Primario:** Fondo `#1e3a8a`, texto `#ffffff`, radio `4px`, altura `36px` (estándar) o `32px` (en tablas). Hover: `#1e40af`.
* **Secundario / Outline:** Fondo `#ffffff`, borde `1px solid #cbd5e1`, texto `#0f172a`. Hover: `#f8fafc`.
* **Peligro / Terminal:** Fondo `#dc2626`, texto `#ffffff`. Para cancelaciones irrevocables o bajas definitivas.

### Tablas de Datos (`Data Table`)
* **Cabecera (`th`):** Fondo `#f8fafc`, texto `#475569`, fuente `11px` bold en mayúsculas, padding vertical `8px`, horizontal `12px`.
* **Fila de datos (`td`):** Altura `40px`, texto `13px` `#0f172a`, borde inferior `1px solid #f1f5f9`.
* **Hover de fila:** Transición suave a fondo `#f8fafc`.
* **Fila seleccionada:** Fondo `#eff6ff` con borde acento izquierdo de `2px` en `#1e3a8a`.

### Badges de Estado Académico (`Badge`)
* Altura fija `20px`, tipografía `11px` mayúsculas bold (`tracking: 0.03em`), radio de `2px`.
* Formato: `[INDICADOR] TEXTO` (ej. `● REGULAR`, `▲ EN REVISIÓN`, `■ BAJA TEMPORAL`).
