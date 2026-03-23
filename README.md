# Margen Claro Almacén · SaaS Fase 4 Starter

Esta versión ya no es solo PWA local. Queda preparada para dos modos:

- **Modo demo local**: Funciona sin backend. Sirve para validar flujo, UX y lógica comercial.
- **Modo SaaS real con Supabase**: Actívalo cargando las variables del archivo `.env`.

## 1) Ejecutar en local

```bash
npm install
npm run dev
```

## 2) Activar backend real con Supabase

1. Copia `.env.example` a `.env`
2. Completa:

```bash
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

3. En Supabase, ejecuta `supabase/schema.sql`
4. Crea al menos:
   - una empresa en `companies`
   - un usuario en Authentication
   - un perfil en `profiles` con el mismo `auth.users.id`

## 3) Login demo local

- Email: `admin@mca.local`
- Clave: `1234`

## 4) Qué trae esta fase

- Login
- Empresa y sesión
- Clientes
- Historial de análisis
- Guardado centralizado demo o en Supabase
- Importación de Excel
- Exportación Excel
- Reporte PDF
- PWA instalable
- Logo aumentado para mejor presencia visual

## 5) Qué falta para producción seria

- Recuperación de contraseña
- Invitaciones de usuarios
- Auditoría de cambios
- Storage para archivos
- Dominio propio
- CI/CD y monitoreo
