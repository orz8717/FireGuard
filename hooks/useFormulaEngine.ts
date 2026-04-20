import React from 'react';
import { dbService } from '../services/dbService';

export function useFormulaEngine(contextData: Record<string, any[]>, currentUser: any) {
  const lookupCache = React.useRef<Map<string, { value: any; timestamp: number }>>(new Map());

  const formulaFunctions = React.useMemo(() => {
    const funcs: any = {
      // --- Logical ---
      AND: (...args: any[]) => args.every(Boolean),
      OR: (...args: any[]) => args.some(Boolean),
      NOT: (val: any) => !val,
      IF: (cond: any, t: any, f: any) => (!!cond ? t : f),
      IFS: (...args: any[]) => {
        for (let i = 0; i < args.length; i += 2) {
          if (args[i]) return args[i + 1];
        }
        return null;
      },
      SWITCH: (val: any, ...args: any[]) => {
        for (let i = 0; i < args.length - 1; i += 2) {
          if (val === args[i]) return args[i + 1];
        }
        return args.length % 2 !== 0 ? args[args.length - 1] : null;
      },
      ISBLANK: (val: any) => val === undefined || val === null || String(val).trim() === '' || (Array.isArray(val) && val.length === 0),
      ISNOTBLANK: (val: any) => !(val === undefined || val === null || String(val).trim() === '' || (Array.isArray(val) && val.length === 0)),
      TRUE: true,
      FALSE: false,
      COALESCE: (...args: any[]) => args.find(a => a !== null && a !== undefined && String(a).trim() !== ''),
      ISNUMBER: (val: any) => !isNaN(parseFloat(val)) && isFinite(val),
      ISDATE: (val: any) => !isNaN(Date.parse(val)),

      // --- Math ---
      ABS: (n: any) => Math.abs(Number(n) || 0),
      CEILING: (n: any) => Math.ceil(Number(n) || 0),
      FLOOR: (n: any) => Math.floor(Number(n) || 0),
      ROUND: (n: any) => Math.round(Number(n) || 0),
      ROUNDUP: (n: any) => Math.ceil(Number(n) || 0),
      ROUNDDOWN: (n: any) => Math.floor(Number(n) || 0),
      MOD: (a: any, b: any) => (Number(a) || 0) % (Number(b) || 1),
      POWER: (a: any, b: any) => Math.pow(Number(a) || 0, Number(b) || 0),
      SQRT: (n: any) => Math.sqrt(Number(n) || 0),
      LOG: (n: any) => Math.log10(Number(n) || 0),
      LN: (n: any) => Math.log(Number(n) || 0),
      EXP: (n: any) => Math.exp(Number(n) || 0),
      SIGN: (n: any) => Math.sign(Number(n) || 0),
      MAX: (...args: any[]) => {
        const nums = args.flat().map(n => Number(n)).filter(n => !isNaN(n));
        return nums.length ? Math.max(...nums) : 0;
      },
      MIN: (...args: any[]) => {
        const nums = args.flat().map(n => Number(n)).filter(n => !isNaN(n));
        return nums.length ? Math.min(...nums) : 0;
      },
      AVERAGE: (...args: any[]) => {
        const nums = args.flat().map(n => Number(n)).filter(n => !isNaN(n));
        return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      },
      COUNT: (...args: any[]) => args.flat().length,
      SUM: (...args: any[]) => args.flat().reduce((acc, val) => acc + (Number(val) || 0), 0),
      RANDBETWEEN: (min: any, max: any) => {
        const mn = Math.ceil(Number(min) || 0);
        const mx = Math.floor(Number(max) || 0);
        return Math.floor(Math.random() * (mx - mn + 1)) + mn;
      },

      // --- Text ---
      CONCATENATE: (...args: any[]) => args.map(a => a === null || a === undefined ? '' : String(a)).join(''),
      EXACT: (a: any, b: any) => String(a || '') === String(b || ''),
      FIND: (find: any, within: any) => (String(within || '')).indexOf(String(find || '')) + 1,
      LEFT: (text: any, num: any) => (String(text || '')).substring(0, Number(num) || 0),
      LEN: (text: any) => (String(text || '')).length,
      LOWER: (text: any) => (String(text || '')).toLowerCase(),
      MID: (text: any, start: any, num: any) => (String(text || '')).substring((Number(start) || 1) - 1, ((Number(start) || 1) - 1) + (Number(num) || 0)),
      RIGHT: (text: any, num: any) => (String(text || '')).slice(-(Number(num) || 0)),
      SUBSTITUTE: (text: any, oldT: any, newT: any) => (String(text || '')).split(String(oldT || '')).join(String(newT || '')),
      REPLACE: (text: any, start: number, num: number, newText: string) => {
        const s = String(text || '');
        return s.substring(0, start - 1) + newText + s.substring(start - 1 + num);
      },
      TRIM: (text: any) => (String(text || '')).trim(),
      UPPER: (text: any) => (String(text || '')).toUpperCase(),
      CONTAINS: (text: any, search: any) => {
        const str = String(text || '');
        return str ? str.includes(String(search || '')) : false;
      },
      SPLIT: (text: any, delimiter: string) => String(text || '').split(delimiter),
      INITIALS: (text: any) => (String(text || '')).trim().split(/\s+/).filter(Boolean).map((w: string) => w[0]).join('').toUpperCase(),
      TEXT: (val: any, format?: string) => {
        if (val instanceof Date || (!isNaN(Date.parse(val)) && isNaN(Number(val)))) {
          return new Date(val).toLocaleDateString('he-IL');
        }
        return String(val);
      },

      // --- Date & Time ---
      TODAY: () => new Date().toISOString().split('T')[0],
      NOW: () => new Date().toISOString(),
      TIMENOW: () => new Date().toLocaleTimeString(),
      DAY: (date: any) => date ? new Date(date).getDate() : null,
      MONTH: (date: any) => date ? new Date(date).getMonth() + 1 : null,
      YEAR: (date: any) => date ? new Date(date).getFullYear() : null,
      HOUR: (time: any) => time ? new Date(`1970-01-01T${time}`).getHours() : null,
      MINUTE: (time: any) => time ? new Date(`1970-01-01T${time}`).getMinutes() : null,
      SECOND: (time: any) => time ? new Date(`1970-01-01T${time}`).getSeconds() : null,
      EOMONTH: (date: any, months: number) => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return null;
        d.setMonth(d.getMonth() + Number(months) + 1);
        d.setDate(0);
        return d.toISOString().split('T')[0];
      },
      DATEDIF: (start: any, end: any, unit: 'Y' | 'M' | 'D') => {
        const s = new Date(start), e = new Date(end);
        if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
        const diffTime = Math.abs(e.getTime() - s.getTime());
        if (unit === 'D') return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (unit === 'M') return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
        if (unit === 'Y') return e.getFullYear() - s.getFullYear();
        return null;
      },
      WORKDAY: (startDate: any, days: number) => {
        let d = new Date(startDate);
        let added = 0;
        while (added < days) {
          d.setDate(d.getDate() + 1);
          if (d.getDay() !== 5 && d.getDay() !== 6) added++; // Skip Friday & Saturday
        }
        return d.toISOString().split('T')[0];
      },

      // --- System ---
      UNIQUEID: () => Math.random().toString(36).substring(2, 11).toUpperCase(),
      UNIQUEID_V4: () => crypto.randomUUID().toUpperCase(),
      USEREMAIL: () => currentUser?.email || '',
      USERNAME: () => currentUser?.name || '',
      USERROLE: () => currentUser?.role || '',
      DURATION: (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return [h, m, s].map(v => v < 10 ? "0" + v : v).join(":");
      },

      // --- List & Ref ---
      ANY: (list: any[]) => Array.isArray(list) ? list[0] : list,
      INDEX: (list: any[], idx: number) => Array.isArray(list) ? list[idx - 1] : null,
      TOP: (list: any[], num: number) => Array.isArray(list) ? list.slice(0, num) : [],
      UNION: (l1: any[], l2: any[]) => Array.from(new Set([...(Array.isArray(l1) ? l1 : []), ...(Array.isArray(l2) ? l2 : [])])),
      INTERSECT: (l1: any[], l2: any[]) => Array.isArray(l1) && Array.isArray(l2) ? l1.filter(x => l2.includes(x)) : [],
      LIST: (...args: any[]) => args.flat(),
      UNIQUE: (list: any[]) => Array.from(new Set(list)),
      SORT: (list: any[]) => [...list].sort(),
      
      // --- Data Access & Helpers ---
      IN: async (val: any, listOrTable: any, optionalCol?: string) => {
        try {
          const searchVal = String(val || '').trim();
          if (Array.isArray(listOrTable)) {
            return listOrTable.map(v => String(v || '').trim()).includes(searchVal);
          }
          if (typeof listOrTable === 'string' && optionalCol) {
            const cacheKey = `IN:${listOrTable}:${optionalCol}:${searchVal}`;
            const cached = lookupCache.current.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp < 10000)) return cached.value;
            const data = await dbService.getTableData(listOrTable, { [optionalCol]: searchVal });
            const exists = data && data.length > 0;
            lookupCache.current.set(cacheKey, { value: exists, timestamp: Date.now() });
            return exists;
          }
          return false;
        } catch (e) { return false; }
      },

      LOOKUP: async (findValue: any, tableName: string, inColumn: string, returnColumn: string) => {
        try {
          const sVal = String(findValue || '').trim();
          const tName = String(tableName || '').trim();
          const iCol = String(inColumn || '').trim();
          const rCol = String(returnColumn || '').trim();
          if (!sVal || !tName || !iCol || !rCol) return null;

          const cacheKey = `LOOKUP:${tName}:${iCol}:${sVal}:${rCol}`;
          const cached = lookupCache.current.get(cacheKey);
          if (cached && (Date.now() - cached.timestamp < 10000)) return cached.value;

          const tNameLower = tName.toLowerCase();
          let tableData = contextData[tName] || Object.values(contextData).find((t: any, idx) => 
            Object.keys(contextData)[idx].toLowerCase() === tNameLower
          ) || [];

          if (Array.isArray(tableData) && tableData.length > 0) {
            const row = tableData.find((r: any) => String(r[iCol] || '').trim() === sVal);
            if (row) {
              const result = row[rCol] !== undefined ? (row[rCol] === null ? "" : row[rCol]) : null;
              lookupCache.current.set(cacheKey, { value: result, timestamp: Date.now() });
              return result;
            }
          }

          const data = await dbService.getTableData(tName, { [iCol]: sVal });
          const row = data && data.length > 0 ? data[0] : null;
          const result = row ? row[rCol] : null;
          lookupCache.current.set(cacheKey, { value: result, timestamp: Date.now() });
          return result;
        } catch (e) { return null; }
      },

      __SELECT: async (tableName: string, returnCol: string, conditionStr: string) => {
        const tableData = contextData[tableName] || [];
        const parsedCondition = conditionStr.replace(/\[([^\]]+)\]/g, `row["$1"]`).replace(/([^<>=!])=([^=])/g, '$1===$2');
        // Sanitize condition to prevent prototype/global access
        if (/(__proto__|constructor|prototype|globalThis|window|document|process|fetch|eval|import)/i.test(parsedCondition)) {
          return [];
        }
        const condFunc = new Function('row', `"use strict"; try { return ${parsedCondition}; } catch(e) { return false; }`);
        return tableData.filter((r: any) => condFunc(r)).map((r: any) => r[returnCol]);
      },

      __GET_RELATED_VALUE: (tableName: string, col: string, currentData: Record<string, any>) => {
        const tNameLower = tableName.toLowerCase();
        let tableData = contextData[tableName] || Object.values(contextData).find((t: any, idx) => 
          Object.keys(contextData)[idx].toLowerCase() === tNameLower
        ) || [];

        if (!Array.isArray(tableData) || !tableData.length) return null;
        const singularName = tNameLower.endsWith('s') ? tNameLower.slice(0, -1) : tNameLower;
        const foreignKeyField = currentData[`${singularName}Id`] || currentData['customerId'] || currentData['userId'];

        if (foreignKeyField) {
          const row = tableData.find((r: any) => String(r.id) === String(foreignKeyField));
          if (row && row[col] !== undefined) return row[col] === null ? "" : row[col];
        }
        return null;
      },

      __DEREF: async (refVal: any, returnCol: string) => {
        if (!refVal) return null;
        for (const table of Object.values(contextData)) {
          if (Array.isArray(table)) {
            const row = table.find((r: any) => String(r.id) === String(refVal));
            if (row && row[returnCol] !== undefined) return row[returnCol];
          }
        }
        return null;
      },

      __LIST_MATH: (list1: any, op: string, list2: any) => {
        const l1 = Array.isArray(list1) ? list1 : [list1];
        const l2 = Array.isArray(list2) ? list2 : [list2];
        if (op === '+') return [...l1, ...l2];
        if (op === '-') return l1.filter(x => !l2.includes(x));
        return l1;
      }
    };
    return funcs;
  }, [contextData, currentUser]);

  const BLOCKED_KEYWORDS = /(__proto__|constructor\.prototype|globalThis|window\b|document\b|process\b|fetch\b(?!\s*\()|\beval\b|\bimport\b|\brequire\b|\bFunction\b)/i;

  const evaluateFormula = React.useCallback(async (formula: string, data: Record<string, any>) => {
    try {
      if (!formula || formula.trim() === '') return null;
      if (formula.length > 4000) { console.warn('Formula too long, skipping.'); return null; }

      let script = formula;

      // Sugar Replacements
      script = script.replace(/SELECT\s*\(\s*([a-zA-Z0-9_]+)\[([^\]]+)\]\s*,\s*(.+?)\s*\)/ig, `__SELECT("$1", "$2", "$3")`);
      script = script.replace(/\[([^\]]+)\]\.\[([^\]]+)\]/g, `__DEREF(data["$1"], "$2")`);
      script = script.replace(/([a-zA-Z0-9_]+)\[([^\]]+)\]/g, `__GET_RELATED_VALUE("$1", "$2", data)`);
      script = script.replace(/\[([^\]]+)\]/g, `data["$1"]`);
      script = script.replace(/([^<>=!])=([^=])/g, '$1===$2');

      // Block dangerous patterns before execution
      if (BLOCKED_KEYWORDS.test(script)) {
        console.warn('[FormulaEngine] Blocked potentially unsafe expression:', formula);
        return null;
      }

      const asyncFuncs = ['LOOKUP', 'IN', '__SELECT', '__DEREF'];
      asyncFuncs.forEach(fn => {
        const regex = new RegExp(`\\b${fn}\\s*\\(`, 'g');
        script = script.replace(regex, `await ${fn}(`);
      });

      const keys = Object.keys(formulaFunctions);
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      const evaluator = new AsyncFunction(...keys, 'data', `"use strict"; try { return await (${script}); } catch(e) { return null; }`);

      return await evaluator(...Object.values(formulaFunctions), data);
    } catch (e) {
      console.error("Formula Error:", e);
      return null;
    }
  }, [formulaFunctions]);

  return { evaluateFormula, formulaFunctions };
}