# SC-LAB-004 — Análisis de Seguridad Estático y Dinámico (SAST + DAST)
## Proyecto: SecureCampus

**Integrante:** Tania Cortés
**Fecha:** 13/10/2026

---

## 1. Objetivo

Analizar el código TypeScript del backend Express y del frontend React de SecureCampus con Semgrep (SAST), y evaluar la aplicación en ejecución con OWASP ZAP (DAST). Se busca documentar hallazgos verificables y distinguir entre resultados limpios y pruebas que no pudieron ejecutarse por falta de disponibilidad del entorno.

## 2. Entorno

| Componente | Detalle |
|---|---|
| Sistema | Windows, PowerShell y VS Code |
| Proyecto analizado | SecureCampus — backend Node.js/Express/TypeScript y frontend React/TypeScript |
| Base de datos | PostgreSQL en Docker Compose, puerto 5433 |
| Gestor de paquetes | npm |
| Herramienta SAST | Semgrep Community en Docker |
| Herramienta DAST | OWASP ZAP estable en Docker |
| Puertos previstos | API: 4000; frontend Vite: 5173 |

**Alcance:** Se analizaron los directorios del proyecto real (`backend/src` y `src`), sin introducir deliberadamente una vulnerabilidad ni modificar código de la aplicación. La ejecución dinámica quedó limitada porque el backend no inició; por tanto, ZAP no pudo probar una aplicación accesible y sus resultados no permiten concluir que SecureCampus esté libre de vulnerabilidades.

## 3. Preparación

Se ejecutó `npm run dev`. El orquestador inició PostgreSQL en el puerto 5433 y aplicó correctamente estas migraciones:

```text
20261011000000_autenticacion_local.sql
20261012000000_parciales_y_solicitudes_activas.sql
20261012120000_auditoria_concurrencia_y_parciales.sql
```

Después, el backend no pudo arrancar porque faltó el ejecutable de `tsx`. El proceso reportó:

```text
Error: Cannot find module
'C:\Users\Yaneth\Documents\GitHub\SecureCampus\node_modules\tsx\dist\cli.mjs'
Node.js v22.22.0
[Backend] El proceso del backend terminó inesperadamente (código 1).
```

El coordinador realizó el apagado ordenado y detuvo PostgreSQL. No se inició el frontend ni quedó una API disponible para el análisis DAST. En la inspección inicial, `git status --short` no mostró cambios.

## 4. Parte A · SAST con Semgrep

### 4.1 Análisis humano previo

Se revisó `backend/src/academic/grade.service.ts`, que procesa y consulta calificaciones.

| Pregunta | Respuesta |
|---|---|
| ¿Qué dato controla el usuario? | En la ruta de captura, `inscripcionId`, `numeroParcial` y `valorCalificacion` llegan en el cuerpo de la petición; `grupoId` está en la ruta. |
| ¿A dónde llega ese dato? | El route valida el cuerpo con Zod y pasa los datos a `capturePartialGrade`; el servicio consulta y actualiza PostgreSQL. La ruta de lectura pasa `grupoId` a `getGroupGrades`. |
| ¿Qué riesgo observas o descartas? | En el código revisado, las consultas usan parámetros de PostgreSQL (`$1`, `$2`, etc.) y separan los valores SQL de los datos. No se observó concatenación de entrada del usuario en la sentencia SQL, por lo que no se identificó el patrón clásico de SQLi en este flujo. |
| ¿Qué control ya existe o propondrías? | El endpoint de captura valida UUID, parcial de 1 a 6 y calificación de 0 a 100 con Zod; además usa `requireAuth`, `requireRoles('PROFESOR')` y `requirePermissions`. El servicio comprueba la inscripción, el estado y el número de parciales configurados. Conviene verificar por separado la autorización del profesor sobre el grupo/inscripción concreta. |

### 4.2 Ejecución de Semgrep

**Comandos ejecutados:**

```powershell
docker run --rm -v "${PWD}:/src" semgrep/semgrep semgrep scan --config auto /src/backend/src
docker run --rm -v "${PWD}:/src" semgrep/semgrep semgrep scan --config auto /src/src
```

| Evidencia SAST | Resultado |
|---|---|
| Regla/hallazgo | 0 findings en ambos análisis; 0 findings bloqueantes. No se reportó una regla o vulnerabilidad específica. |
| Archivos analizados | Backend: 24 archivos; frontend: 47 archivos. |
| Reglas ejecutadas | 210 en cada análisis. Semgrep indicó una configuración de 1074 reglas disponibles y que el análisis se limitó a archivos rastreados por Git. |
| Líneas interpretadas | Aproximadamente 100.0 % del backend y 99.9 % del frontend. |
| ¿Qué evidencia aporta? | En los archivos rastreados y bajo las reglas ejecutadas, Semgrep no detectó patrones que reportar. Esto no prueba ausencia de fallas; tampoco cubre reglas no ejecutadas, archivos no rastreados ni autorización de negocio. |
| ¿Coincide con el análisis humano? | Sí: el flujo revisado usa consultas parametrizadas y Semgrep no reportó SQLi en el backend. El resultado no equivale a una validación exhaustiva de todos los riesgos. |

### 4.3 Corrección y reanálisis

No se corrigió código porque estos análisis no reportaron hallazgos. Los dos comandos anteriores son los resultados obtenidos sobre el código existente; no hubo una corrección seguida de un reanálisis independiente ni se introdujo una vulnerabilidad de laboratorio.

## 5. Parte B · DAST con OWASP ZAP

### 5.1 Verificación de acceso

No se obtuvo una respuesta HTTP de la aplicación. El arranque integral falló antes de iniciar la API y el frontend. La prueba de ZAP contra el puerto 5173 corroboró que no había servicio escuchando:

```text
docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t http://host.docker.internal:5173

Automation plan failures:
Job spider failed to access URL
http://host.docker.internal:5173 :
Connect to http://host.docker.internal:5173 failed: Connection refused
Failed to access summary file /home/zap/zap_out.json
```

No se compartió una ejecución independiente de `curl`; por lo tanto, no se registra una respuesta de `curl` como evidencia.

### 5.2 Baseline — observación pasiva

| Resultado baseline | ¿Qué observa? | ¿Requiere análisis? | Interpretación |
|---|---|---|---|
| El spider no pudo acceder al objetivo (`Connection refused`); no se generó `zap_out.json`. | Conectividad HTTP con `http://host.docker.internal:5173`. | Sí: primero debe levantarse y verificarse la aplicación; después hay que repetir el baseline para obtener observaciones HTTP. | No es un hallazgo de seguridad de la aplicación ni un resultado limpio. Es una ejecución fallida por falta de servicio disponible. No se obtuvieron resultados sobre cabeceras o cookies. |

### 5.3 Active Scan — interacción deliberada

No se ejecutó `zap-full-scan.py`. Al no estar accesible la aplicación y haber fallado el spider del baseline, no existe evidencia de un active scan. En consecuencia, no se puede afirmar que se haya probado o descartado XSS reflejado, SQLi u otras vulnerabilidades dinámicas. Aunque React escapa texto interpolado por defecto, esa propiedad no sustituye una prueba contra la aplicación en ejecución.

### 5.4 Validación manual

No hubo un hallazgo dinámico que validar, porque el objetivo no respondió. Tampoco se realizó una prueba manual de autorización. Como siguiente prueba, una vez disponible el entorno, se recomienda autenticar un profesor y consultar o modificar un grupo no asignado, verificando la respuesta del backend. En el código revisado hay controles de autenticación, rol y permiso, pero se debe confirmar específicamente la autorización a nivel de grupo e inscripción con datos y respuestas reales.

### 5.5 Evidencia en Git de la línea base

La inspección inicial con `git status --short` no mostró cambios. No se modificó código fuente, por lo que no se ejecutaron `git add` ni `git commit`. Este documento registra la evidencia disponible; no se afirma que se haya creado un commit.

### 5.6 Corrección

No aplicó: Semgrep no reportó hallazgos y el escaneo dinámico no pudo acceder a la aplicación. No se modificó código de la aplicación.

### 5.7 Retesting

- **Prueba funcional normal:** no ejecutada; el backend no inició por el error de módulo `tsx` ausente.
- **Repetición de una prueba que detectó un problema:** no aplica; no se identificó un hallazgo explotable.
- **Nueva ejecución de `zap-full-scan.py`:** no ejecutada.
- **¿El hallazgo pasó de WARN/FAIL a PASS?:** no; no hubo un hallazgo de aplicación ni retest.
- **Advertencias que permanecieron:** no se obtuvo lista de alertas del baseline; el spider falló antes de generar el archivo de resumen.

## 6. Comparación SAST vs DAST

| Criterio | SAST | DAST |
|---|---|---|
| Objeto | Código fuente del backend y frontend | Aplicación en ejecución (API y frontend) |
| ¿Necesita ejecutar la app? | No | Sí |
| Perspectiva | Interna/estática | Externa/dinámica |
| Evidencia obtenida en este lab | 0 findings en 24 archivos de backend y 47 de frontend, con 210 reglas ejecutadas por análisis. | Baseline intentado contra el puerto 5173, pero el spider recibió `Connection refused`; active scan no ejecutado. |
| Fortaleza | Detecta patrones de riesgo en el código analizado. | Observa el comportamiento HTTP expuesto cuando el objetivo está disponible. |
| Límite | No garantiza la corrección de lógica de negocio, autorización ni configuración de ejecución. | No ve todo el código y requiere que el servicio y las rutas estén disponibles y recorridos. |

## 7. Reflexión

**1. ¿Por qué 0 findings en SAST no equivale a aplicación segura?**
Significa únicamente que las reglas ejecutadas no reportaron patrones en los archivos analizados. No demuestra que la lógica de negocio, la autorización por objeto, la configuración de producción o las dependencias estén libres de riesgo. En este laboratorio, el flujo revisado usa consultas parametrizadas, pero eso no cubre todos los controles.

**2. ¿Por qué un WARN de ZAP debe validarse antes de declararlo vulnerabilidad?**
Una alerta puede señalar una recomendación de endurecimiento o un comportamiento que no sea explotable en el contexto concreto. Hay que reproducirla, comprobar el endpoint, la respuesta y el impacto. En esta ejecución no se obtuvo ningún WARN de aplicación: ZAP no logró conectarse.

**3. ¿Qué diferencia observaste entre baseline y active scan?**
La evidencia disponible solo permite decir que se intentó el baseline pasivo y que su spider falló por `Connection refused`. No se ejecutó active scan, así que no hubo una comparación empírica entre ambos en este entorno.

**4. ¿Por qué 200 OK no descarta una vulnerabilidad?**
El estado 200 solo indica que la solicitud recibió una respuesta satisfactoria a nivel HTTP. La respuesta todavía podría contener datos expuestos o reflejar contenido peligroso; la vulnerabilidad se determina inspeccionando el contenido y el efecto, no solo el código de estado.

**5. ¿Qué aprendiste de tener que reiniciar el servidor antes del retest?**
El retest debe apuntar a la versión del código realmente cargada por el proceso. En este caso no se llegó a esa etapa: `npm run dev` falló al iniciar el backend porque no encontró `node_modules/tsx/dist/cli.mjs` y el coordinador apagó PostgreSQL. Por ello tampoco se pudo comprobar si Vite habría aplicado cambios con hot reload.

**6. ¿Qué problema de autorización podría seguir existiendo aunque SAST y DAST no lo reporten?**
Podría existir un IDOR/BOLA si un profesor con rol y permiso válidos pudiera consultar o modificar una inscripción o un grupo que no tiene asignado. Los middlewares revisados comprueban rol y permiso, mientras que la relación del profesor con el objeto requiere validación específica. Esta posible brecha no se probó en ejecución y debe verificarse manualmente o con pruebas de autorización.

## 8. Conclusión

Semgrep completó sus análisis de backend y frontend sin findings reportados; la revisión del servicio de calificaciones también observó consultas parametrizadas y validación de entrada. DAST quedó inconcluso: el backend no arrancó por el módulo `tsx` ausente y ZAP no pudo conectarse al frontend en el puerto 5173. Queda pendiente restablecer las dependencias y repetir baseline, active scan y pruebas de autorización por grupo e inscripción.
