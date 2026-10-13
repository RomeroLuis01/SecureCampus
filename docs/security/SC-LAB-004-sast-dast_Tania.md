<!--
CÓMO USAR ESTE ESQUELETO
========================
1. Cada sección trae instrucciones en cursiva entre corchetes [así]. Bórralas
   y escribe tu contenido real en su lugar — no dejes texto de ejemplo sin
   reemplazar.
2. Todo lo que pongas aquí debe venir de una ejecución REAL de los comandos
   (Semgrep/ZAP) y de una revisión REAL del código, no de lo que "crees" que
   va a pasar. Si un comando falla o no tienes Docker corriendo, documenta el
   error tal cual, no inventes un resultado.
3. Guarda este archivo en: docs/security/SC-LAB-004-sast-dast_Tania.md
   (sigue el mismo patrón de nombre que tus labs 001-003).
4. Al final, bórralo todo este bloque de comentario HTML — es solo tu guía de
   llenado y no debe aparecer en la entrega.
-->

# SC-LAB-004 — Análisis de Seguridad Estático y Dinámico (SAST + DAST)
## Proyecto: SecureCampus

**Integrante:** Tania Cortés
**Fecha:** 13/10/2026

---

## 1. Objetivo

[Reescribe con tus palabras, 2-3 líneas: qué vas a analizar (el backend
Node/Express/TypeScript y/o el frontend React de SecureCampus), con qué
técnicas (SAST con Semgrep, DAST con OWASP ZAP), y qué esperas lograr
(identificar hallazgos reales, interpretarlos con criterio, y si aplica,
corregir y reanalizar).]

---

## 2. Entorno

| Componente | Detalle |
|---|---|
| Sistema | [Windows + PowerShell + VS Code, o lo que uses] |
| Proyecto analizado | SecureCampus — backend Node.js/Express/TypeScript + frontend React/TypeScript |
| Base de datos | PostgreSQL (vía `docker compose`) |
| Gestor de paquetes | npm |
| Herramienta SAST | Semgrep Community (contenedor Docker) |
| Herramienta DAST | OWASP ZAP (contenedor Docker) |
| Puertos usados | Backend: [el que indique tu `.env` → `PORT`] · Frontend: [normalmente 5173 con Vite] |

> **Nota de alcance:** [aquí explica en 2-3 líneas la decisión que confirmaste
> con tu profesor: ¿analizaste el proyecto real tal cual está, o usaste una
> rama/archivo aislado con una vulnerabilidad introducida a propósito para
> poder demostrar el ciclo detectar→corregir→reanalizar? Sé explícita, porque
> esto enmarca cómo se deben leer tus resultados.]

---

## 3. Preparación

**Comandos ejecutados para levantar el entorno:**
```
npm run db:up
npm run db:migrate
npm run db:seed
npm run api:dev
npm run dev:ui
```

**Verificación de que el entorno está arriba** (`git status`, `docker info`,
y que el navegador/`curl` responda en los puertos esperados):
```
[pega aquí la salida real de tus comandos de verificación]
```

---

## 4. Parte A · SAST con Semgrep

### 4.1 Análisis humano previo (antes de ejecutar la herramienta)

Elige **un archivo real** de tu backend que maneje datos del usuario y
toque la base de datos — por ejemplo `backend/src/academic/grade.service.ts`
o `backend/src/academic/student.service.ts` — y analízalo tú primero, a mano.

| Pregunta | Tu respuesta |
|---|---|
| ¿Qué dato controla el usuario? | [ej.: el `grupoId`, el `inscripcionId`, el `valorCalificacion` que llegan en el body/params de la petición HTTP] |
| ¿A dónde llega ese dato? | [ej.: pasa del route handler al service, y de ahí a una consulta `pool.query(...)` contra PostgreSQL] |
| ¿Qué riesgo observas (o descartas) y por qué? | [di explícitamente si ves o no el patrón de concatenación insegura — en este proyecto es más probable que **no** lo encuentres, porque ya usan `$1, $2...`; explica eso] |
| ¿Qué control ya existe o propondrías? | [ej.: ya usa consultas parametrizadas; además `requireAuth`/`requireRoles`/`requirePermissions` antes de llegar al service] |

### 4.2 Ejecuta Semgrep

**Comando(s) ejecutados** (ajustados a tu estructura real de carpetas):
```
docker run --rm -v "${PWD}:/src" semgrep/semgrep semgrep scan --config auto /src/backend/src
docker run --rm -v "${PWD}:/src" semgrep/semgrep semgrep scan --config auto /src/src
```

| Evidencia SAST | Registro |
|---|---|
| Regla/hallazgo | [nombre exacto de la regla que reportó Semgrep, o "0 findings" si no reportó nada] |
| Archivo/línea | [ruta y número de línea reales que señaló la herramienta] |
| ¿Qué evidencia aporta? | [qué te dice el hallazgo: fuente del dato → flujo → sink] |
| ¿Coincide con tu análisis humano? | [sí/no, y por qué] |

> Si el resultado fue **0 findings relevantes**, no lo dejes así nada más:
> explica qué significa eso en tu caso concreto (que las reglas de Semgrep no
> encontraron el patrón de SQLi/XSS clásico, probablemente porque el código
> ya usa consultas parametrizadas y JSX con escape automático) — eso también
> es un hallazgo que hay que interpretar, no ignorar.

### 4.3 Corrección y reanálisis

[Si encontraste algo que corregir: pega el código antes/después y el
comando de reanálisis con su resultado.
Si NO encontraste nada que corregir en el código real: explica aquí la
decisión de alcance que tomaste con tu profesor (ver nota de la sección 2) —
por ejemplo, que demostraste el ciclo de corrección sobre un archivo de
laboratorio aislado, y resume brevemente qué hiciste ahí.]

```
[comando de reanálisis]
```

**Resultado del reanálisis:** [pega la salida real]

---

## 5. Parte B · DAST con OWASP ZAP

### 5.1 Verificación de que la app está accesible

```
docker run --rm curlimages/curl http://host.docker.internal:[puerto]
```
**Resultado:** [pega la respuesta real]

### 5.2 Baseline — observación pasiva

```
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://host.docker.internal:[puerto]
```

| Hallazgo baseline | ¿Qué observa? | ¿Requiere análisis? | Tu interpretación |
|---|---|---|---|
| [ej.: Missing Anti-clickjacking Header] | [Cabecera HTTP] | [Sí/No — recuerda: con Helmet ya configurado, varios de estos pueden salir en PASS en lugar de WARN] | [explica si aplica o no a tu proyecto] |
| [otro hallazgo real] | | | |

### 5.3 Active Scan — interacción deliberada

```
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-full-scan.py -t http://host.docker.internal:[puerto]
```

**Hallazgos relevantes encontrados:** [lista los hallazgos reales que haya
reportado el active scan — si no aparece nada equivalente a XSS reflejado,
dilo explícitamente y explica por qué crees que es así (React escapa por
defecto, no se encontró `dangerouslySetInnerHTML`, etc.)]

### 5.4 Validación manual

[Si el active scan reportó algo explotable, documenta aquí cómo lo
verificaste manualmente (qué endpoint, qué input probaste, qué observaste).
Si no había nada que validar porque no se encontró XSS/SQLi real, dilo y
pasa a documentar en su lugar una prueba de autorización manual relevante a
tu proyecto — por ejemplo, intentar que un profesor consulte calificaciones
de un grupo que no tiene asignado, y confirmar que el backend lo rechaza.]

### 5.5 Evidencia en Git de la línea base

```
git status
git diff
git add [archivos reales que hayas tocado, si aplica]
git commit -m "[mensaje real]"
```

### 5.6 Corrección (si aplicó)

[Código antes/después, si corregiste algo.]

### 5.7 Retesting

- Prueba funcional normal: [resultado]
- Repetición de la prueba que detectó el problema: [resultado]
- Nueva ejecución de `zap-full-scan.py`: [resultado]
- ¿El hallazgo pasó de WARN/FAIL a PASS? [sí/no]
- ¿Qué advertencias permanecieron y por qué? [explica]

---

## 6. Comparación SAST vs DAST (aplicada a SecureCampus)

| Criterio | SAST | DAST |
|---|---|---|
| Objeto | Código fuente (backend TS / frontend TSX) | Aplicación en ejecución (API + frontend) |
| ¿Necesita ejecutar la app? | No | Sí |
| Perspectiva | Interna/estática | Externa/dinámica |
| Evidencia obtenida en este lab | [resume tu hallazgo real de la Parte A] | [resume tu hallazgo real de la Parte B] |
| Fortaleza | Detecta patrones/rutas en código | Observa comportamiento real expuesto |
| Límite | No garantiza lógica de negocio ni autorización | No ve todo el código ni todas las rutas internas |

---

## 7. Reflexión

**1. ¿Por qué 0 findings en SAST no equivale a aplicación segura?**
[Tu respuesta — idealmente conectada con tu propio resultado: si tu backend
dio pocos/ningún hallazgo de SQLi, explica qué SAST sigue sin poder ver
(lógica de negocio, autorización, configuración en producción, etc.)]

**2. ¿Por qué un WARN de ZAP debe validarse antes de declararlo vulnerabilidad?**
[Tu respuesta]

**3. ¿Qué diferencia observaste entre baseline y active scan?**
[Tu respuesta, con datos reales de tu ejecución]

**4. ¿Por qué 200 OK no descarta una vulnerabilidad?**
[Tu respuesta]

**5. ¿Qué aprendiste del hecho de tener que reiniciar el servidor antes del retest?**
[Tu respuesta — en tu proyecto esto aplica al backend (`npm run api:dev`) y,
si usaste Vite con hot-reload, explica si el frontend sí se actualizó solo o no]

**6. ¿Qué problema de autorización podría seguir existiendo aunque SAST y DAST no lo reporten?**
[Tu respuesta — puedes usar como ejemplo real el middleware `requireRoles`/
`requirePermissions` de tu proyecto: protege la ruta por rol, pero ¿valida
también que, por ejemplo, un profesor solo vea/edite calificaciones de
*su propio* grupo y no de cualquier grupo? Eso es autorización a nivel de
objeto (tipo IDOR) y ninguna herramienta automática lo prueba sola.]

---

## 8. Conclusión

[2-4 líneas cerrando el laboratorio: qué evidencia generaste, qué controles
del proyecto ya funcionan bien, y qué quedaría pendiente de revisar con más
profundidad (pruebas de autorización, revisión manual de otros servicios, etc.)]
