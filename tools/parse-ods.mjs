import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import xlsx from 'xlsx';

const rootDir = process.cwd();
const assetsDir = path.join(rootDir, 'assets');
const outputDir = path.join(rootDir, 'apps', 'renderer', 'src', 'data');

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const formatDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseSerialDate = (serial) => {
  const parsed = xlsx.SSF.parse_date_code(serial);
  if (!parsed || !parsed.y || !parsed.m || !parsed.d) return null;
  return new Date(parsed.y, parsed.m - 1, parsed.d);
};

const parseDateFromString = (value) => {
  const match = String(value).match(/(\d{2})\.(\d{2})\.(\d{2,4})/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const yearRaw = match[3];
  const year = yearRaw.length === 2 ? 2000 + Number(yearRaw) : Number(yearRaw);
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
};

const extractStrikeStyles = (xml) => {
  const styleBlocks = [...xml.matchAll(/<style:style[^>]+style:name="([^"]+)"[^>]*>[\s\S]*?<\/style:style>/g)];
  const strikeStyles = new Set();

  styleBlocks.forEach((match) => {
    if (/text-line-through-style="solid"|text-line-through-type="single"/i.test(match[0])) {
      strikeStyles.add(match[1]);
    }
  });

  return strikeStyles;
};

const extractStrikeCells = (xml, strikeStyles) => {
  const strikeCellStyles = new Set(
    Array.from(strikeStyles).filter((name) => name.startsWith('ce')),
  );
  const strikeTextStyles = new Set(
    Array.from(strikeStyles).filter((name) => name.startsWith('T')),
  );

  const tableRegex = /<table:table[^>]+table:name="([^"]+)"[^>]*>([\s\S]*?)<\/table:table>/g;
  const rowRegex = /<table:table-row([^>]*)>([\s\S]*?)<\/table:table-row>/g;
  const cellRegex = /<table:(table-cell|covered-table-cell)([^>]*)>([\s\S]*?)<\/table:\1>|<table:(table-cell|covered-table-cell)([^>]*)\/>/g;

  const strikeMap = new Map();

  let tableMatch;
  while ((tableMatch = tableRegex.exec(xml)) !== null) {
    const sheetName = tableMatch[1];
    const tableContent = tableMatch[2];
    let rowIndex = 0;
    const strikeCells = new Set();

    let rowMatch;
    while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
      const rowAttrs = rowMatch[1] || '';
      const rowContent = rowMatch[2] || '';
      const rowRepeatMatch = rowAttrs.match(/table:number-rows-repeated="(\d+)"/);
      const rowRepeat = rowRepeatMatch ? Number(rowRepeatMatch[1]) : 1;

      const rowCells = [];
      let cellMatch;
      while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
        const attrs = cellMatch[2] || cellMatch[5] || '';
        const content = cellMatch[3] || '';
        rowCells.push({ attrs, content });
      }

      for (let r = 0; r < rowRepeat; r += 1) {
        let colIndex = 0;
        rowCells.forEach(({ attrs, content }) => {
          const repeatMatch = attrs.match(/table:number-columns-repeated="(\d+)"/);
          const colRepeat = repeatMatch ? Number(repeatMatch[1]) : 1;
          const styleMatch = attrs.match(/table:style-name="([^"]+)"/);
          const styleName = styleMatch ? styleMatch[1] : null;

          let isStrike = false;
          if (styleName && strikeCellStyles.has(styleName)) {
            isStrike = true;
          }

          if (!isStrike && strikeTextStyles.size > 0 && content) {
            const spanMatches = [...content.matchAll(/text:style-name="([^"]+)"/g)];
            if (spanMatches.some((m) => strikeTextStyles.has(m[1]))) {
              isStrike = true;
            }
          }

          if (isStrike) {
            for (let c = 0; c < colRepeat; c += 1) {
              strikeCells.add(`${rowIndex}:${colIndex + c}`);
            }
          }

          colIndex += colRepeat;
        });

        rowIndex += 1;
      }
    }

    strikeMap.set(sheetName, strikeCells);
  }

  return strikeMap;
};

const parsePlanHistory = () => {
  const planPath = path.join(assetsDir, 'Putzplan.ods');
  const wb = xlsx.readFile(planPath);
  const contentXml = execSync(`unzip -p "${planPath}" content.xml`).toString();
  const strikeStyles = extractStrikeStyles(contentXml);
  const strikeMap = extractStrikeCells(contentXml, strikeStyles);
  const years = [];

  wb.SheetNames.forEach((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
    const assignments = [];
    const strikeCells = strikeMap.get(sheetName) ?? new Set();

    const isStrike = (rowIndex, colIndex) => strikeCells.has(`${rowIndex}:${colIndex}`);
    const collectNames = (row, rowIndex) =>
      row
        .slice(1)
        .map((cell, index) => ({ cell, colIndex: index + 1 }))
        .filter(({ cell, colIndex }) =>
          typeof cell === 'string' && cell.trim() !== '' && !isStrike(rowIndex, colIndex),
        )
        .map(({ cell }) => cell.trim());

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const firstCell = row[0];
      const dateFromNumber = typeof firstCell === 'number' ? parseSerialDate(firstCell) : null;
      const dateFromString = typeof firstCell === 'string' ? parseDateFromString(firstCell) : null;
      const date = dateFromNumber ?? dateFromString;

      if (!date) {
        // Month header like "Januar" or non-date row
        continue;
      }

      const namesFirstRow = collectNames(row, i);
      const nextRow = rows[i + 1] || [];
      const nextRowFirst = nextRow[0];
      const nextRowHasDate =
        typeof nextRowFirst === 'number' ||
        (typeof nextRowFirst === 'string' && !!parseDateFromString(nextRowFirst));
      const nextRowIsContinuation =
        !nextRowHasDate &&
        (nextRowFirst === undefined || nextRowFirst === null || String(nextRowFirst).trim() === '');

      const namesSecondRow = nextRowIsContinuation ? collectNames(nextRow, i + 1) : [];
      const members = [...namesFirstRow, ...namesSecondRow].slice(0, 10);

      if (members.length > 0) {
        assignments.push({
          date: formatDate(date),
          members,
        });
      }

      if (nextRowIsContinuation) {
        i += 1; // skip continuation row
      }
    }

    if (assignments.length > 0) {
      years.push({
        year: sheetName,
        assignments,
      });
    }
  });

  return years;
};

const parseChronik = () => {
  const chronikPath = path.join(assetsDir, 'Putzchronik.ods');
  const wb = xlsx.readFile(chronikPath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(sheet, { header: 1, blankrows: false });
  const entries = [];

  rows.slice(1).forEach((row) => {
    if (!row || row.length === 0) return;
    const name = row[0];
    if (typeof name !== 'string' || name.trim() === '') return;

    const dates = row
      .slice(1)
      .filter((cell) => typeof cell === 'string' && cell.trim() !== '')
      .map((cell) => cell.trim());

    entries.push({ name, dates });
  });

  return entries;
};

ensureDir(outputDir);

const history = parsePlanHistory();
const chronik = parseChronik();

fs.writeFileSync(
  path.join(outputDir, 'planHistorySeed.json'),
  JSON.stringify(history, null, 2),
  'utf-8',
);

fs.writeFileSync(
  path.join(outputDir, 'chronikSeed.json'),
  JSON.stringify(chronik, null, 2),
  'utf-8',
);

console.log(`Wrote ${history.length} plan history years and ${chronik.length} chronik entries.`);
