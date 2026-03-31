# 💸 FinanzApp

App de finanzas personales y de hogar. PWA instalable en celular y PC.

---

## Stack

- **Frontend:** React + Vite + PWA (instalable)
- **Backend:** Node.js + Express
- **DB:** PostgreSQL
- **IA:** Claude API (contexto financiero real)
- **Deploy:** Render

---

## Estructura

```
finance-app/
├── backend/     → API REST (Node + Express)
└── frontend/    → React PWA
```

---

## Deploy en Render (paso a paso)

### 1. Subir a GitHub

Crea un repo en GitHub y sube todo el proyecto.

### 2. Crear PostgreSQL en Render

1. Dashboard → **New** → **PostgreSQL**
2. Nombre: `finanzapp-db`
3. Free tier → Create
4. Copia la **Internal Database URL**

### 3. Deploy del Backend

1. Dashboard → **New** → **Web Service**
2. Conecta tu repo de GitHub
3. **Root Directory:** `backend`
4. **Build Command:** `npm install`
5. **Start Command:** `node index.js`
6. **Environment Variables:**
   ```
   DATABASE_URL    → (Internal Database URL del paso 2)
   JWT_SECRET      → (cualquier string largo y aleatorio)
   FRONTEND_URL    → (URL del frontend, la agregas después)
   ANTHROPIC_API_KEY → sk-ant-...
   NODE_ENV        → production
   ```
7. Deploy → copia la URL del backend (ej: `https://finanzapp-api.onrender.com`)

### 4. Deploy del Frontend

1. Dashboard → **New** → **Static Site**
2. Conecta el mismo repo
3. **Root Directory:** `frontend`
4. **Build Command:** `npm install && npm run build`
5. **Publish Directory:** `dist`
6. **Environment Variables:**
   ```
   VITE_API_URL → https://finanzapp-api.onrender.com/api
   ```
7. Deploy → copia la URL del frontend

### 5. Actualizar FRONTEND_URL en el backend

Vuelve al Web Service del backend → Environment → actualiza `FRONTEND_URL` con la URL del frontend.

---

## Desarrollo local

### Backend
```bash
cd backend
cp .env.example .env
# Edita .env con tus valores
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Funcionalidades

- ✅ Login / registro con JWT
- ✅ Múltiples cuentas (personal + compartidas)
- ✅ Ingresos, gastos, transferencias, pagos de deuda
- ✅ Categorías fijas + personalizadas
- ✅ Tracker de deudas con progreso
- ✅ Dashboard con gráficas (dona + barras)
- ✅ Hogar compartido con código de invitación
- ✅ Chat IA con contexto financiero real
- ✅ PWA instalable (Android, iOS, PC)
- ✅ Diseño dark mobile-first

---

## Instalar como app en el celular

**Android:** Chrome → menú ⋮ → "Instalar app" o "Agregar a pantalla de inicio"

**iPhone:** Safari → compartir → "Agregar a pantalla de inicio"

---

*© 2026 Ana Alvarado · Educadora Tech & Desarrolladora Full Stack · linkedin.com/in/ana-alvarado-instructora-full-stack*
