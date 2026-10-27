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

1. En `index.html`, pega la URL `/exec` de tu implementación.
2. Sube `index.html` a tu repositorio GitHub y activa **Settings → Pages** para la rama y carpeta que usarás.
3. Abre la URL de Pages y envía un registro de prueba. Revisa que apareció en la pestaña **Planes de trabajo**.

Si haces cambios en `Code.gs`, crea una versión nueva desde **Implementar → Administrar implementaciones → Editar → Nueva versión**. Conserva la URL de implementación si Apps Script te la muestra.

## Si el formulario no escribe en Sheets

1. Abre la URL `/exec` del despliegue en una pestaña. Debe mostrar JSON con `"ok": true` y el nombre de la hoja de cálculo. Si indica que falta `SPREADSHEET_ID`, agrega esa propiedad en **Configuración del proyecto → Propiedades del script**.
2. Si no puede abrir la hoja, verifica que el ID sea solo el identificador de la URL y que el propietario del script tenga acceso de editor a esa hoja. Ejecuta `setupSheet` una vez desde el editor y acepta los permisos.
3. Revisa **Apps Script → Ejecuciones** justo después de intentar enviar el formulario. `doPost` debe aparecer como ejecución. Si aparece fallida, abre el detalle para ver el error.
4. Después de cambiar `Code.gs`, publica **Nueva versión** de la implementación web. Guarda/sube también el HTML actualizado a GitHub Pages.

## Qué se guarda

Una fila por plan: fecha de envío, área, año, líder, correo, objetivo, integrantes (JSON), eventos con fecha única o rango de fechas, lugar y presupuesto (JSON) y suma de presupuestos en COP. Los eventos de varios días guardan `startDate` y `endDate` (inclusive); los eventos de un día conservan el campo `date`.

## Mensaje después del envío

Al completarse la solicitud `POST`, el formulario muestra una confirmación de pantalla completa y permite iniciar otro plan. Si la solicitud falla a nivel de red, conserva lo escrito. Como el navegador no puede leer la respuesta de Apps Script en modo `no-cors`, la confirmación se basa en que la solicitud se haya transmitido; comprueba la hoja si necesitas verificar el registro.

## Tablero privado para la junta directiva

`Dashboard.html` presenta cada envío como una tarjeta con filtros por texto, área y año, además del objetivo, comité, actividades y presupuesto. Incluye una pestaña de calendario mensual con actividades de un día o de varios días. Al arrastrar una actividad, se mueve todo su rango y se guarda la nueva fecha en el JSON del plan. El botón **Exportar este mes a PDF** prepara un informe imprimible con las actividades que coinciden con el mes abierto; en el diálogo del navegador selecciona **Guardar como PDF**.

1. En Apps Script, crea un archivo HTML llamado `Dashboard` y copia allí el contenido de `Dashboard.html`.
2. Copia también la versión actualizada de `Code.gs` al proyecto.
3. En **Configuración del proyecto → Propiedades del script**, agrega `DASHBOARD_VIEWERS` con los correos autorizados separados por comas. Incluye tu correo y los de la junta. Agrega `DASHBOARD_EDITORS` con el correo de la persona que podrá mover eventos; déjalo solo para administradores.
4. Comparte la hoja con los miembros de la junta como **Lector** y con el correo de `DASHBOARD_EDITORS` como **Editor**. La implementación privada se ejecuta como el usuario que accede para usar los permisos de la cuenta conectada.
5. Ejecuta `migratePlanIds` una vez desde el editor de Apps Script. Esto agrega un identificador estable a cada plan existente y a cada uno de sus eventos, necesarios para guardar la fecha del elemento arrastrado.
6. Publica una nueva versión de la implementación pública del formulario y de la implementación privada del tablero, conservando en cada una sus propios permisos de acceso y ejecución. La versión nueva de `doPost` agrega IDs a planes y eventos futuros.
7. Abre la URL de la implementación privada agregando `?board=1`. Los miembros en `DASHBOARD_VIEWERS` pueden consultar el calendario; solo quienes estén en `DASHBOARD_EDITORS` pueden cambiar fechas.
