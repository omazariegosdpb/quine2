// Genera supabase/seed/seed.sql a partir de matches.csv y el catálogo de equipos.
// Uso:  node supabase/seed/build_seed.mjs
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// --- Catálogo de equipos -----------------------------------------------------
// id orden alfabético dentro de cada grupo (A1..L4)
const TEAMS = [
  // A
  { id: 1,  name: "Czechia",              iso: "CZE", group: "A" },
  { id: 2,  name: "Mexico",               iso: "MEX", group: "A" },
  { id: 3,  name: "South Africa",         iso: "RSA", group: "A" },
  { id: 4,  name: "South Korea",          iso: "KOR", group: "A" },
  // B
  { id: 5,  name: "Bosnia & Herzegovina", iso: "BIH", group: "B" },
  { id: 6,  name: "Canada",               iso: "CAN", group: "B" },
  { id: 7,  name: "Qatar",                iso: "QAT", group: "B" },
  { id: 8,  name: "Switzerland",          iso: "SUI", group: "B" },
  // C
  { id: 9,  name: "Brazil",               iso: "BRA", group: "C" },
  { id: 10, name: "Haiti",                iso: "HAI", group: "C" },
  { id: 11, name: "Morocco",              iso: "MAR", group: "C" },
  { id: 12, name: "Scotland",             iso: "SCO", group: "C" },
  // D
  { id: 13, name: "Australia",            iso: "AUS", group: "D" },
  { id: 14, name: "Paraguay",             iso: "PAR", group: "D" },
  { id: 15, name: "Türkiye",              iso: "TUR", group: "D" },
  { id: 16, name: "USA",                  iso: "USA", group: "D" },
  // E
  { id: 17, name: "Curaçao",              iso: "CUW", group: "E" },
  { id: 18, name: "Ecuador",              iso: "ECU", group: "E" },
  { id: 19, name: "Germany",              iso: "GER", group: "E" },
  { id: 20, name: "Ivory Coast",          iso: "CIV", group: "E" },
  // F
  { id: 21, name: "Japan",                iso: "JPN", group: "F" },
  { id: 22, name: "Netherlands",          iso: "NED", group: "F" },
  { id: 23, name: "Sweden",               iso: "SWE", group: "F" },
  { id: 24, name: "Tunisia",              iso: "TUN", group: "F" },
  // G
  { id: 25, name: "Belgium",              iso: "BEL", group: "G" },
  { id: 26, name: "Egypt",                iso: "EGY", group: "G" },
  { id: 27, name: "Iran",                 iso: "IRN", group: "G" },
  { id: 28, name: "New Zealand",          iso: "NZL", group: "G" },
  // H
  { id: 29, name: "Cape Verde",           iso: "CPV", group: "H" },
  { id: 30, name: "Saudi Arabia",         iso: "KSA", group: "H" },
  { id: 31, name: "Spain",                iso: "ESP", group: "H" },
  { id: 32, name: "Uruguay",              iso: "URU", group: "H" },
  // I
  { id: 33, name: "France",               iso: "FRA", group: "I" },
  { id: 34, name: "Iraq",                 iso: "IRQ", group: "I" },
  { id: 35, name: "Norway",               iso: "NOR", group: "I" },
  { id: 36, name: "Senegal",              iso: "SEN", group: "I" },
  // J
  { id: 37, name: "Algeria",              iso: "ALG", group: "J" },
  { id: 38, name: "Argentina",            iso: "ARG", group: "J" },
  { id: 39, name: "Austria",              iso: "AUT", group: "J" },
  { id: 40, name: "Jordan",               iso: "JOR", group: "J" },
  // K
  { id: 41, name: "Colombia",             iso: "COL", group: "K" },
  { id: 42, name: "DR Congo",             iso: "COD", group: "K" },
  { id: 43, name: "Portugal",             iso: "POR", group: "K" },
  { id: 44, name: "Uzbekistan",           iso: "UZB", group: "K" },
  // L
  { id: 45, name: "Croatia",              iso: "CRO", group: "L" },
  { id: 46, name: "England",              iso: "ENG", group: "L" },
  { id: 47, name: "Ghana",                iso: "GHA", group: "L" },
  { id: 48, name: "Panama",               iso: "PAN", group: "L" },
];

const teamIdByName = new Map(TEAMS.map(t => [t.name, t.id]));

// --- Helpers de fecha --------------------------------------------------------
// Excel date serial (epoch 1899-12-30, 1-indexed con bug del año 1900 ya considerado).
// 46184 -> 2026-06-11. Convertimos a UTC asumiendo que la hora en Excel está en
// hora de Guatemala (UTC-6) según decisión de Oscar.
const EXCEL_EPOCH = Date.UTC(1899, 11, 30); // 1899-12-30 UTC
const GT_OFFSET_HOURS = -6;

function excelSerialToDateLocalGT(dateSerial, timeFraction) {
  const totalMs = (dateSerial + timeFraction) * 86400 * 1000;
  const gtMs = EXCEL_EPOCH + totalMs;
  // gtMs es la fecha/hora "como si fuera UTC", pero representa hora GT.
  // Convertimos a UTC real sumando 6 horas.
  return new Date(gtMs - GT_OFFSET_HOURS * 3600 * 1000);
}

// --- Parsear CSV -------------------------------------------------------------
const csvPath = path.join(__dirname, "..", "matches.csv");
const csv = readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
const header = csv.shift();
if (!/MatchID/.test(header ?? "")) throw new Error("Cabecera CSV inesperada");

function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const matches = csv.map((line) => {
  const [matchId, fecha, hora, grupo, local, visita, sede] = splitCsvLine(line);
  return {
    id: Number(matchId),
    fecha: Number(fecha),
    hora: Number(hora),
    grupo,
    local,
    visita,
    sede,
  };
});

// --- Generar SQL -------------------------------------------------------------
const sqlEscape = (s) => (s == null ? "null" : `'${String(s).replace(/'/g, "''")}'`);

let sql = "";
sql += "-- Auto-generado por supabase/seed/build_seed.mjs — no editar a mano.\n";
sql += "-- Re-ejecutar:  node supabase/seed/build_seed.mjs\n\n";

sql += "begin;\n\n";

// 1. Ronda GRUPOS
sql += "-- Ronda 1: Fase de Grupos\n";
sql += "insert into public.rounds (code, name, closes_at) values\n";
sql += "  ('GROUPS', 'Fase de Grupos', '2026-06-08 23:59:00-06')\n";
sql += "  on conflict (code) do nothing;\n\n";

// 2. Equipos
sql += "-- Equipos (48 selecciones, 12 grupos)\n";
sql += "insert into public.teams (id, name, iso_code, group_letter) values\n";
sql += TEAMS
  .map(t => `  (${t.id}, ${sqlEscape(t.name)}, ${sqlEscape(t.iso)}, ${sqlEscape(t.group)})`)
  .join(",\n");
sql += "\n  on conflict (id) do update set\n";
sql += "    name = excluded.name,\n";
sql += "    iso_code = excluded.iso_code,\n";
sql += "    group_letter = excluded.group_letter;\n\n";

// 3. Partidos
sql += "-- 72 partidos de fase de grupos\n";
sql += "with r as (select id from public.rounds where code = 'GROUPS')\n";
sql += "insert into public.matches (id, round_id, group_letter, home_team_id, away_team_id, kickoff_at, venue) values\n";
sql += matches
  .map((m) => {
    const home = teamIdByName.get(m.local);
    const away = teamIdByName.get(m.visita);
    if (!home) throw new Error(`Equipo local no encontrado: ${m.local}`);
    if (!away) throw new Error(`Equipo visita no encontrado: ${m.visita}`);
    const ko = excelSerialToDateLocalGT(m.fecha, m.hora).toISOString();
    return `  (${m.id}, (select id from r), '${m.grupo}', ${home}, ${away}, '${ko}', ${sqlEscape(m.sede)})`;
  })
  .join(",\n");
sql += "\n  on conflict (id) do update set\n";
sql += "    round_id = excluded.round_id,\n";
sql += "    group_letter = excluded.group_letter,\n";
sql += "    home_team_id = excluded.home_team_id,\n";
sql += "    away_team_id = excluded.away_team_id,\n";
sql += "    kickoff_at = excluded.kickoff_at,\n";
sql += "    venue = excluded.venue;\n\n";

sql += "commit;\n";

const outPath = path.join(__dirname, "seed.sql");
writeFileSync(outPath, sql, "utf8");
console.log(`OK -> ${outPath} (${matches.length} partidos, ${TEAMS.length} equipos)`);
