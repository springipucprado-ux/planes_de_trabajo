/**
 * Backend de recepción para el formulario publicado en GitHub Pages.
 * Configura SPREADSHEET_ID en Propiedades del proyecto antes de desplegar.
 */
const SHEET_NAME = 'Planes de trabajo';
const HEADERS = ['Fecha de envío', 'Área', 'Año', 'Líder que presenta', 'Correo', 'Objetivo general', 'Integrantes del comité (JSON)', 'Eventos (JSON)', 'Presupuesto total aproximado (COP)', 'ID del plan'];

// Abre la URL /exec en un navegador para comprobar el despliegue y el acceso a Sheets.
function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  if (params.board === '1') return serveDashboard_();

  // Endpoint JSONP de solo lectura para consultar el estado de un envío.
  if (params.prefix && params.requestId) {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]{0,100}$/.test(params.prefix) || !/^[A-Za-z0-9_-]{8,80}$/.test(params.requestId)) {
      return ContentService.createTextOutput('/* Parámetros inválidos */').setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    const saved = CacheService.getScriptCache().get('plan_status_' + params.requestId);
    const result = saved ? JSON.parse(saved) : { state: 'pending' };
    return ContentService.createTextOutput(params.prefix + '(' + JSON.stringify(result) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) return json_({ ok: false, service: 'Planes de trabajo', error: 'Falta la propiedad de script SPREADSHEET_ID.' });
  try {
    const ss = SpreadsheetApp.openById(id);
    return json_({ ok: true, service: 'Planes de trabajo', spreadsheet: ss.getName(), sheet: SHEET_NAME, sheetExists: Boolean(ss.getSheetByName(SHEET_NAME)) });
  } catch (err) {
    console.error('Error de diagnóstico: ' + (err && err.stack ? err.stack : err));
    return json_({ ok: false, service: 'Planes de trabajo', error: 'No se pudo abrir la hoja. Revisa SPREADSHEET_ID y los permisos del propietario del script.' });
  }
}

function serveDashboard_() {
  if (!isDashboardViewer_()) {
    return HtmlService.createHtmlOutput(
      '<!doctype html><html lang="es"><meta charset="utf-8"><title>Acceso restringido</title>' +
      '<body style="font:16px system-ui;padding:48px;color:#18332d"><h1>Acceso restringido</h1>' +
      '<p>Esta página es solo para integrantes autorizados de la junta directiva.</p></body></html>'
    ).setTitle('Acceso restringido');
  }
  return HtmlService.createHtmlOutputFromFile('Dashboard').setTitle('Tablero de planes de trabajo');
}

/** Devuelve las respuestas solo a cuentas autorizadas. */
function getDashboardData() {
  if (!isDashboardViewer_()) throw new Error('Tu cuenta no está autorizada para consultar este tablero.');
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Falta configurar SPREADSHEET_ID en las propiedades del script.');

  const sheet = SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return { plans: [] };
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, HEADERS.length).getValues();
  const plans = rows.filter(row => row.some(value => value !== '' && value != null)).map(row => {
    let submitted = '';
    if (row[0] instanceof Date && !isNaN(row[0].getTime())) {
      submitted = Utilities.formatDate(row[0], 'America/Bogota', 'dd/MM/yyyy HH:mm');
    } else {
      submitted = String(row[0] || '');
    }
    const parsedEvents = parseJsonCell_(row[7], []);
    const events = Array.isArray(parsedEvents) ? parsedEvents : [];
    return {
      submitted: submitted,
      area: String(row[1] || ''),
      year: String(row[2] || ''),
      leader: String(row[3] || ''),
      email: String(row[4] || ''),
      objective: String(row[5] || ''),
      committee: parseJsonCell_(row[6], []),
      events: events,
      totalBudget: Number(row[8]) || 0,
      planId: String(row[9] || '')
    };
  });
  return { plans: plans.reverse(), canEdit: isDashboardEditor_(), needsMigration: plans.some(plan => !plan.planId || plan.events.some(event => !event || !event.id)) };
}

function isDashboardViewer_() {
  const email = Session.getActiveUser().getEmail().trim().toLowerCase();
  if (!email) return false;
  const allowed = (PropertiesService.getScriptProperties().getProperty('DASHBOARD_VIEWERS') || '')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email);
}

function isDashboardEditor_() {
  const email = Session.getActiveUser().getEmail().trim().toLowerCase();
  if (!email) return false;
  const allowed = (PropertiesService.getScriptProperties().getProperty('DASHBOARD_EDITORS') || '')
    .split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email);
}

/** Ejecutar una vez desde el editor para agregar IDs estables a planes y eventos existentes. */
function migratePlanIds() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Falta configurar SPREADSHEET_ID en las propiedades del script.');
  const sheet = SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('No existe la pestaña ' + SHEET_NAME + '. Ejecuta setupSheet primero.');
  if (sheet.getLastColumn() < HEADERS.length) sheet.insertColumnAfter(Math.max(sheet.getLastColumn(), 1));
  sheet.getRange(1, 10).setValue(HEADERS[9]);
  if (sheet.getLastRow() < 2) return 'No hay planes antiguos para migrar.';

  const rowCount = sheet.getLastRow() - 1;
  const ids = sheet.getRange(2, 10, rowCount, 1).getValues();
  const eventCells = sheet.getRange(2, 8, rowCount, 1).getValues();
  let planIdsAdded = 0, eventIdsAdded = 0;
  for (let i = 0; i < rowCount; i++) {
    if (!ids[i][0]) { ids[i][0] = Utilities.getUuid(); planIdsAdded++; }
    const events = parseJsonCell_(eventCells[i][0], []);
    let changed = false;
    if (Array.isArray(events)) {
      events.forEach(event => {
        if (event && !event.id) { event.id = Utilities.getUuid(); eventIdsAdded++; changed = true; }
      });
      if (changed) eventCells[i][0] = JSON.stringify(events);
    }
  }
  sheet.getRange(2, 10, rowCount, 1).setValues(ids);
  sheet.getRange(2, 8, rowCount, 1).setValues(eventCells);
  return `Migración lista: ${planIdsAdded} planes y ${eventIdsAdded} eventos recibieron identificadores.`;
}

/** Guarda la nueva fecha de un evento. Solo los correos en DASHBOARD_EDITORS pueden modificarla. */
function updateEventDate(planId, eventId, newDate, newEndDate) {
  if (!isDashboardViewer_() || !isDashboardEditor_()) throw new Error('Tu cuenta tiene permiso de lectura, no de edición.');
  if (!planId || !eventId || !isValidIsoDate_(newDate) || (newEndDate && (!isValidIsoDate_(newEndDate) || newEndDate < newDate))) throw new Error('Datos de evento o fecha inválidos.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (!id) throw new Error('Falta configurar SPREADSHEET_ID.');
    const sheet = SpreadsheetApp.openById(id).getSheetByName(SHEET_NAME);
    if (!sheet || sheet.getLastRow() < 2) throw new Error('No se encontró la hoja de planes.');
    const rowCount = sheet.getLastRow() - 1;
    const planIds = sheet.getRange(2, 10, rowCount, 1).getDisplayValues().flat();
    const matchIndex = planIds.indexOf(String(planId));
    if (matchIndex < 0) throw new Error('No se encontró el plan asociado al evento.');
    const sheetRow = matchIndex + 2;
    const events = parseJsonCell_(sheet.getRange(sheetRow, 8).getValue(), []);
    const event = Array.isArray(events) ? events.find(item => String(item.id || '') === String(eventId)) : null;
    if (!event) throw new Error('No se encontró el evento dentro del plan.');
    event.date = newDate;
    if (newEndDate) { event.startDate = newDate; event.endDate = newEndDate; event.dateType = 'week'; }
    else { delete event.startDate; delete event.endDate; event.dateType = 'single'; }
    sheet.getRange(sheetRow, 8).setValue(JSON.stringify(events));
    return { ok: true, date: newDate, endDate: newEndDate || null };
  } finally {
    lock.releaseLock();
  }
}

function isValidIsoDate_(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parts = value.split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.getUTCFullYear() === parts[0] && date.getUTCMonth() === parts[1] - 1 && date.getUTCDate() === parts[2];
}

function parseJsonCell_(value, fallback) {
  try { return value ? JSON.parse(String(value)) : fallback; }
  catch (err) { return fallback; }
}

function doPost(e) {
  let requestId = '';
  try {
    if (!e || !e.postData || !e.postData.contents) return json_({ ok: false, error: 'Solicitud vacía.' });
    const data = JSON.parse(e.postData.contents);
    requestId = data.requestId || '';
    saveStatus_(requestId, { state: 'pending' });
    const error = validate_(data);
    if (error) {
      saveStatus_(requestId, { state: 'error', message: error });
      return json_({ ok: false, error: error });
    }

    const props = PropertiesService.getScriptProperties();
    const spreadsheetId = props.getProperty('SPREADSHEET_ID');
    if (!spreadsheetId) throw new Error('Falta configurar la propiedad SPREADSHEET_ID.');
    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#1d5a49').setFontColor('#ffffff');
    } else {
      if (sheet.getMaxColumns() < 10) sheet.insertColumnAfter(sheet.getMaxColumns());
      if (sheet.getRange(1, 10).getValue() !== HEADERS[9]) {
        sheet.getRange(1, 10).setValue(HEADERS[9]).setFontWeight('bold').setBackground('#1d5a49').setFontColor('#ffffff');
      }
    }

    const events = data.events.map(event => Object.assign({}, event, { id: event.id || Utilities.getUuid() }));
    const total = events.reduce((sum, event) => sum + (event.budget == null ? 0 : event.budget), 0);
    const row = [new Date(), safeCell_(data.area), data.year, safeCell_(data.leader), safeCell_(data.email), safeCell_(data.objective), JSON.stringify(data.committee), JSON.stringify(events), total, Utilities.getUuid()];
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try { sheet.appendRow(row); } finally { lock.releaseLock(); }
    saveStatus_(requestId, { state: 'success', message: 'Plan guardado correctamente.' });
    return json_({ ok: true, message: 'Plan guardado.' });
  } catch (err) {
    console.error('Error en doPost: ' + (err && err.stack ? err.stack : err));
    saveStatus_(requestId, { state: 'error', message: 'No se pudo guardar el plan. Revisa la configuración del servidor.' });
    return json_({ ok: false, error: 'No se pudo guardar el plan.' });
  }
}

function saveStatus_(requestId, status) {
  if (!requestId || !/^[A-Za-z0-9_-]{8,80}$/.test(requestId)) return;
  try {
    CacheService.getScriptCache().put('plan_status_' + requestId, JSON.stringify(status), 21600);
  } catch (err) {
    console.error('No se pudo guardar el estado de confirmación: ' + err);
  }
}

function validate_(data) {
  if (!data || typeof data !== 'object') return 'Datos inválidos.';
  if (!text_(data.area, 100) || !text_(data.leader, 120) || !text_(data.objective, 1500)) return 'Completa área, líder y objetivo.';
  if (!Number.isInteger(data.year) || data.year < 2020 || data.year > 2100) return 'Año inválido.';
  if (data.email && (String(data.email).length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))) return 'Correo inválido.';
  if (!Array.isArray(data.committee) || data.committee.length < 1 || data.committee.length > 50) return 'Agrega entre 1 y 50 integrantes.';
  for (const person of data.committee) if (!text_(person.name, 120) || !text_(person.role, 100)) return 'Revisa los nombres y cargos del comité.';
  if (!Array.isArray(data.events) || data.events.length < 1 || data.events.length > 100) return 'Agrega entre 1 y 100 eventos.';
  for (const event of data.events) {
    const startDate = event && (event.startDate || event.date);
    const endDate = event && event.endDate;
    if (!text_(event.name, 150) || !isValidIsoDate_(startDate) || (endDate && (!isValidIsoDate_(endDate) || endDate < startDate))) return 'Revisa el nombre y la fecha o semana de cada evento.';
    if (event.budget != null && (!Number.isFinite(event.budget) || event.budget < 0 || event.budget > 1000000000000)) return 'Hay un presupuesto inválido.';
    if (!optionalText_(event.place, 150) || !optionalText_(event.notes, 1000)) return 'Hay un campo de evento demasiado largo.';
  }
  return '';
}

function text_(value, max) { return typeof value === 'string' && value.trim().length > 0 && value.length <= max; }
function optionalText_(value, max) { return value == null || (typeof value === 'string' && value.length <= max); }
// Evita que datos enviados por un usuario se interpreten como fórmulas en Sheets.
function safeCell_(value) { const s = String(value == null ? '' : value).trim(); return /^[=+\-@\t\r]/.test(s) ? "'" + s : s; }
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }

/** Ejecuta manualmente una vez desde el editor para validar el acceso a la hoja. */
function setupSheet() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) throw new Error('Primero configura SPREADSHEET_ID en Configuración del proyecto > Propiedades del script.');
  const ss = SpreadsheetApp.openById(id);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  else if (sheet.getMaxColumns() < HEADERS.length) sheet.insertColumnAfter(sheet.getMaxColumns());
  sheet.getRange(1, 10).setValue(HEADERS[9]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#1d5a49').setFontColor('#ffffff');
}
