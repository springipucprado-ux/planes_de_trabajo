# Formulario de planes de trabajo

Formulario web estático para GitHub Pages y backend en Google Apps Script. Cada envío agrega una fila a Google Sheets; integrantes y eventos quedan en columnas como JSON y se incluye el presupuesto total aproximado.

## 1. Prepara Google Sheets

1. Crea una hoja de cálculo en Google Drive.
2. Copia el ID de la URL: `https://docs.google.com/spreadsheets/d/ID_DE_LA_HOJA/edit`.
3. En la hoja, comparte acceso de edición con la cuenta de Google que será propietaria del proyecto Apps Script. No hace falta hacer pública la hoja.

## 2. Publica el backend

1. Abre [script.google.com](https://script.google.com) y crea un proyecto.
2. Copia el contenido de `Code.gs` al editor.
3. En **Configuración del proyecto → Propiedades del script**, agrega `SPREADSHEET_ID` con el ID copiado.
4. Ejecuta `setupSheet` desde el editor y acepta los permisos de Sheets.
5. Selecciona **Implementar → Nueva implementación → Aplicación web**.
6. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier persona** (necesario para que los líderes puedan enviar desde GitHub Pages).
7. Implementa y copia la URL que termina en `/exec`.

> Al permitir acceso a cualquier persona, cualquiera que encuentre la URL del formulario puede enviar filas. La hoja sigue privada; comparte el formulario solo con tu congregación y revisa los envíos.

## 3. Conecta GitHub Pages

1. En `index.html`, sustituye `PEGA_AQUI_LA_URL_DE_APPS_SCRIPT` por la URL `/exec` de tu implementación.
2. Sube `index.html` a tu repositorio GitHub y activa **Settings → Pages** para la rama y carpeta que usarás.
3. Abre la URL de Pages y envía un registro de prueba. Revisa que apareció en la pestaña **Planes de trabajo**.

Si haces cambios en `Code.gs`, crea una versión nueva desde **Implementar → Administrar implementaciones → Editar → Nueva versión**. Conserva la URL de implementación si Apps Script te la muestra.

## Qué se guarda

Una fila por plan: fecha de envío, área, año, líder, correo, objetivo, integrantes (JSON), eventos con fecha, lugar y presupuesto (JSON) y suma de presupuestos en COP. Para ver los detalles en columnas separadas, se puede adaptar el backend a pestañas relacionadas de eventos e integrantes.

## Nota sobre la confirmación

El navegador envía el formulario en modo `no-cors`, porque Apps Script no habilita CORS para una respuesta legible desde GitHub Pages. El sitio confirma que el navegador envió la solicitud, pero no puede leer una eventual respuesta de error del servidor; valida el primer envío directamente en la hoja.
