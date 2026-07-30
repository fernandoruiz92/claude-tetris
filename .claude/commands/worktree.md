---
description: Crea un worktree aislado en .trees/ y ejecuta ahí las instrucciones dadas
argument-hint: <instrucciones a ejecutar en el worktree>
allowed-tools: Bash(git worktree add:*), Bash(git worktree list:*), Bash(git rev-parse:*), Bash(git status:*), Bash(git branch:*), EnterWorktree, Read, Write, Edit, Glob, Grep
---

# Tarea a ejecutar en un worktree aislado

$ARGUMENTS

---

## Procedimiento

Sigue estos pasos **en orden**. No empieces a implementar nada hasta estar dentro del worktree.

### 1. Determinar el nombre del worktree

Deriva tú mismo el nombre a partir de la tarea de arriba:

- `kebab-case`, en español, sin acentos ni caracteres especiales.
- 1–3 palabras que describan el *qué*, no el *cómo* (ej. `tabla-records`, `menu-pausa`, `fix-rotacion`, `tema-oscuro`).
- Sin prefijos tipo `feat/` ni `claude/` — es también el nombre de la rama que git crea.
- Si ya existe `.trees/<nombre>` o una rama con ese nombre, añade un sufijo (`-2`, `-3`, …).

Verifica antes de crear:

```powershell
git worktree list
git branch --list <nombre>
```

### 2. Crear el worktree

Desde la raíz del repositorio principal:

```powershell
git worktree add .trees/<nombre>
```

Esto crea el directorio `.trees/<nombre>` y una rama nueva llamada `<nombre>` a partir del `HEAD` actual (comportamiento por defecto de `git worktree add` sin commit-ish).

Si necesitas partir de otra base, sé explícito: `git worktree add -b <nombre> .trees/<nombre> origin/main`.

### 3. Entrar al worktree

Usa la herramienta **`EnterWorktree`** con `path: .trees/<nombre>`.

Esto cambia el directorio de trabajo de la sesión al worktree. Es **obligatorio**: sin este paso editarías el código principal en lugar del worktree.

Confirma que estás dentro antes de continuar:

```powershell
git rev-parse --show-toplevel
git branch --show-current
```

### 4. Ejecutar las instrucciones

Ahora sí, implementa la tarea de `$ARGUMENTS`, con estas reglas:

- **Todo el trabajo ocurre dentro del worktree.** No toques rutas del repositorio principal ni de otros worktrees de `.trees/`.
- Respeta `CLAUDE.md` del proyecto: JS vanilla, sin dependencias ni build, textos y comentarios de usuario en español, y las advertencias de la sección *Gotchas* (dimensiones duplicadas canvas/JS, guards de `gameOver`/`paused` en `loop`, alineación `COLORS`/`PIECES`).
- Verificación manual en el navegador (`start index.html` desde el worktree) — no hay tests.
- **No hagas commit ni push** salvo que la tarea lo pida explícitamente.

### 5. Informar al terminar

Reporta en un resumen corto:

- Ruta del worktree y nombre de la rama.
- Archivos modificados o creados.
- Qué debe verificar el usuario manualmente en el navegador.
- Cómo cerrar cuando termine:
  - Conservar: `ExitWorktree` con `action: "keep"` (el worktree y la rama quedan en disco).
  - Descartar: `ExitWorktree` con `action: "remove"`.
  - Manual: `git worktree remove .trees/<nombre>` desde el repo principal.

Indica de forma explícita cualquier parte de la tarea que quedara sin hacer y por qué.
