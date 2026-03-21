import React from 'react';
import { dbService } from '../services/dbService';

export function useFormulaEngine(contextData: Record<string, any[]>, currentUser: any) {
  const lookupCache = React.useRef<Map<string, { value: any; timestamp: number }>>(new Map());

  const formulaFunctions = React.useMemo(() => {
    const funcs: any = {
      // Logical
      AND: (...args: any[]) => args.every(Boolean),
      OR: (...args: any[]) => args.some(Boolean),
      NOT: (val: any) => !val,
      IF: (cond: any, t: any, f: any) => (!!cond ? t : f),
      IFS: (...args: any[]) => {
        for (let i = 0; i < args.length; i += 2) {
          if (args[i]) return args[i+1];
        }
        return null;
      },
      SWITCH: (val: any, ...args: any[]) => {
        for (let i = 0; i < args.length - 1; i += 2) {
          if (val === args[i]) return args[i+1];
        }
        return args.length % 2 !== 0 ? args[args.length - 1] : null;
      },
      ISBLANK: (val: any) => val === undefined || val === null || String(val).trim() === '' || (Array.isArray(val) && val.length === 0),
      ISNOTBLANK: (val: any) => !(val === undefined || val === null || String(val).trim() === '' || (Array.isArray(val) && val.length === 0)),
      TRUE: true,
      FALSE: false,
      
      // Math (Strict Type-Safe)
      ABS: (n: any) => Math.abs(Number(n) || 0),
      CEILING: (n: any) => Math.ceil(Number(n) || 0),
      FLOOR: (n: any) => Math.floor(Number(n) || 0),
      ROUND: (n: any) => Math.round(Number(n) || 0),
      MOD: (a: any, b: any) => (Number(a) || 0) % (Number(b) || 1),
      POWER: (a: any, b: any) => Math.pow(Number(a) || 0, Number(b) || 0),
      SQRT: (n: any) => Math.sqrt(Number(n) || 0),
      LOG: (n: any) => Math.log10(Number(n) || 0),
      LN: (n: any) => Math.log(Number(n) || 0),
      EXP: (n: any) => Math.exp(Number(n) || 0),
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
      
      // Text (Safe Null Handling)
      CONCATENATE: (...args: any[]) => args.map(a => a === null || a === undefined ? '' : String(a)).join(''),
      EXACT: (a: any, b: any) => String(a || '') === String(b || ''),
      FIND: (find: any, within: any) => (String(within || '')).indexOf(String(find || '')) + 1,
      LEFT: (text: any, num: any) => (String(text || '')).substring(0, Number(num) || 0),
      LEN: (text: any) => (String(text || '')).length,
      LOWER: (text: any) => (String(text || '')).toLowerCase(),
      MID: (text: any, start: any, num: any) => (String(text || '')).substring((Number(start) || 1) - 1, ((Number(start) || 1) - 1) + (Number(num) || 0)),
      RIGHT: (text: any, num: any) => (String(text || '')).slice(-(Number(num) || 0)),
      SUBSTITUTE: (text: any, oldT: any, newT: any) => (String(text || '')).split(String(oldT || '')).join(String(newT || '')),
      TRIM: (text: any) => (String(text || '')).trim(),
      UPPER: (text: any) => (String(text || '')).toUpperCase(),
      CONTAINS: (text: any, search: any) => {
        const str = String(text || '');
        return str ? str.includes(String(search || '')) : false;
      },
      INITIALS: (text: any) => (String(text || '')).trim().split(/\s+/).filter(Boolean).map((w: string) => w[0]).join('').toUpperCase(),
      
      // Date & Time
      TODAY: () => new Date().toISOString().split('T')[0],
      NOW: () => new Date().toISOString(),
      TIMENOW: () => new Date().toLocaleTimeString(),
      DAY: (date: any) => date ? new Date(date).getDate() : null,
      MONTH: (date: any) => date ? new Date(date).getMonth() + 1 : null,
      YEAR: (date: any) => date ? new Date(date).getFullYear() : null,
      HOUR: (time: any) => time ? new Date(`1970-01-01T${time}`).getHours() : null,
      MINUTE: (time: any) => time ? new Date(`1970-01-01T${time}`).getMinutes() : null,
      SECOND: (time: any) => time ? new Date(`1970-01-01T${time}`).getSeconds() : null,
      
      // System
      UNIQUEID: () => Math.random().toString(36).substring(2, 11).toUpperCase(),
      USEREMAIL: () => currentUser?.email || '',
      USERNAME: () => currentUser?.name || '',
      USERROLE: () => currentUser?.role || '',
      
      // List & Ref
      ANY: (list: any[]) => Array.isArray(list) ? list[0] : list,
      IN: async (val: any, listOrTable: any, optionalCol?: string) => {
        try {
          const searchVal = String(val || '').trim();
          
          // Case 1: Local List
          if (Array.isArray(listOrTable)) {
            return listOrTable.map(v => String(v || '').trim()).includes(searchVal);
          }

          // Case 2: Supabase Table Column Check
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
        } catch (e) {
          return false;
        }
      },
      UNIQUE: (list: any[]) => Array.from(new Set(list)),
      SORT: (list: any[]) => [...list].sort(),
      
      // Data Access (Full Async LOOKUP with Caching)
      LOOKUP: async (findValue: any, tableName: string, inColumn: string, returnColumn: string) => {
        try {
          const sVal = String(findValue || '').trim();
          const tName = String(tableName || '').trim();
          const iCol = String(inColumn || '').trim();
          const rCol = String(returnColumn || '').trim();

          if (!sVal || !tName || !iCol || !rCol) return null;

          // 1. Cache Check (10 second TTL)
          const cacheKey = `LOOKUP:${tName}:${iCol}:${sVal}:${rCol}`;
          const cached = lookupCache.current.get(cacheKey);
          if (cached && (Date.now() - cached.timestamp < 10000)) {
            return cached.value;
          }

          // 2. Local Context Check (Fastest)
          const tNameLower = tName.toLowerCase();
          let tableData = [];
          
          if (tNameLower === 'customers' || tNameLower === 'customer') {
            tableData = contextData['Customers'] || [];
          } else if (tNameLower === 'users' || tNameLower === 'user') {
            tableData = contextData['Users'] || [];
          } else {
            tableData = contextData[tName] || 
                        Object.values(contextData).find((t: any, idx) => 
                          Object.keys(contextData)[idx].toLowerCase() === tNameLower
                        ) || [];
          }

          if (Array.isArray(tableData) && tableData.length > 0) {
            const row = tableData.find((r: any) => String(r[iCol] || '').trim() === sVal);
            if (row) {
              const result = row[rCol] !== undefined ? (row[rCol] === null ? "" : row[rCol]) : null;
              lookupCache.current.set(cacheKey, { value: result, timestamp: Date.now() });
              return result;
            }
          }

          // 3. Supabase Fallback (Network)
          const data = await dbService.getTableData(tName, { [iCol]: sVal });
          const row = data && data.length > 0 ? data[0] : null;
          const result = row ? row[rCol] : null;
          
          lookupCache.current.set(cacheKey, { value: result, timestamp: Date.now() });
          return result;
        } catch (e) {
          console.error("LOOKUP Error:", e);
          return null;
        }
      },
      __SELECT: async (tableName: string, returnCol: string, conditionStr: string) => {
        const tableData = contextData[tableName] || contextData['Customers'] || [];
        const parsedCondition = conditionStr.replace(/\[([^\]]+)\]/g, `row["$1"]`).replace(/([^<>=!])=([^=])/g, '$1===$2');
        const condFunc = new Function('row', `try { return ${parsedCondition}; } catch(e) { return false; }`);
        return tableData.filter((r: any) => condFunc(r)).map((r: any) => r[returnCol]);
      },
      __FILTER: async (tableName: string, conditionStr: string) => {
        const tableData = contextData[tableName] || contextData['Customers'] || [];
        const parsedCondition = conditionStr.replace(/\[([^\]]+)\]/g, `row["$1"]`).replace(/([^<>=!])=([^=])/g, '$1===$2');
        const condFunc = new Function('row', `try { return ${parsedCondition}; } catch(e) { return false; }`);
        return tableData.filter((r: any) => condFunc(r)).map((r: any) => r.id);
      },
      __GET_COLUMN_LIST: (tableName: string, col: string) => {
        const tableData = contextData[tableName] || [];
        return tableData.map((r: any) => r[col]);
      },
      __GET_RELATED_VALUE: (tableName: string, col: string, currentData: Record<string, any>) => {
        const tNameLower = tableName.toLowerCase();
        let tableData = [];
        
        if (tNameLower === 'customers' || tNameLower === 'customer') {
          tableData = contextData['Customers'] || [];
        } else if (tNameLower === 'users' || tNameLower === 'user') {
          tableData = contextData['Users'] || [];
        } else {
          tableData = contextData[tableName] || 
                      Object.values(contextData).find((t: any, idx) => 
                        Object.keys(contextData)[idx].toLowerCase() === tNameLower
                      ) || [];
        }

        if (!Array.isArray(tableData) || !tableData.length) return null;

        let foreignKeyField = null;
        if (tNameLower === 'customers' || tNameLower === 'customer') {
          foreignKeyField = 'customerId';
        } else if (tNameLower === 'users' || tNameLower === 'user') {
          foreignKeyField = currentData['technicianId'] !== undefined ? 'technicianId' : 'userId';
        } else {
          const singularName = tNameLower.endsWith('s') ? tNameLower.slice(0, -1) : tNameLower;
          foreignKeyField = `${singularName}Id`;
        }

        if (currentData[foreignKeyField] !== undefined) {
          const foreignKeyValue = currentData[foreignKeyField];
          if (foreignKeyValue === null || foreignKeyValue === undefined || foreignKeyValue === '') return "";

          const row = tableData.find((r: any) => String(r.id) === String(foreignKeyValue));
          if (row && row[col] !== undefined) return row[col] === null ? "" : row[col];
          return "";
        }

        if (tableData.length > 0 && tableData[0][col] !== undefined) {
           return tableData[0][col] === null ? "" : tableData[0][col];
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
        if (!Array.isArray(list1) && !Array.isArray(list2)) {
          if (op === '+') return Number(list1 || 0) + Number(list2 || 0);
          if (op === '-') return Number(list1 || 0) - Number(list2 || 0);
        }
        const l1 = Array.isArray(list1) ? list1 : [list1];
        const l2 = Array.isArray(list2) ? list2 : [list2];
        if (op === '+') return [...l1, ...l2];
        if (op === '-') return l1.filter(x => !l2.includes(x));
        return l1;
      }
    };
    return funcs;
  }, [contextData, currentUser]);

  const evaluateFormula = React.useCallback(async (formula: string, data: Record<string, any>) => {
    try {
      if (!formula || formula.trim() === '') return null;
      
      let script = formula;
      
      // 1. Syntactic Sugar Replacements (AppSheet style)
      script = script.replace(/SELECT\s*\(\s*([a-zA-Z0-9_]+)\[([^\]]+)\]\s*,\s*(.+?)\s*\)/ig, `__SELECT("$1", "$2", "$3")`);
      script = script.replace(/FILTER\s*\(\s*"?([a-zA-Z0-9_]+)"?\s*,\s*(.+?)\s*\)/ig, `__FILTER("$1", "$2")`);
      script = script.replace(/\[([^\]]+)\]\.\[([^\]]+)\]/g, `__DEREF(data["$1"], "$2")`);
      script = script.replace(/([a-zA-Z0-9_]+)\[([^\]]+)\]/g, `__GET_RELATED_VALUE("$1", "$2", data)`);
      
      // List Math: List1 + List2 or List1 - List2
      script = script.replace(/([a-zA-Z0-9_]+\[[^\]]+\]|\[[^\]]+\])\s*([+-])\s*([a-zA-Z0-9_]+\[[^\]]+\]|\[[^\]]+\])/g, (match, p1, p2, p3) => {
        const parseArg = (arg: string) => {
          if (arg && arg.includes('[')) {
            const m = arg.match(/([a-zA-Z0-9_]+)?\[([^\]]+)\]/);
            if (m) {
              if (m[1]) return `__GET_RELATED_VALUE("${m[1]}", "${m[2]}", data)`;
              return `data["${m[2]}"]`;
            }
          }
          return arg;
        };
        return `__LIST_MATH(${parseArg(p1)}, "${p2}", ${parseArg(p3)})`;
      });

      script = script.replace(/\[([^\]]+)\]/g, `data["$1"]`);
      script = script.replace(/([^<>=!])=([^=])/g, '$1===$2');

      // 2. Async Injection: Wrap known async functions with await to support nested async calls
      const asyncFuncs = ['LOOKUP', 'IN', '__SELECT', '__FILTER', '__DEREF'];
      asyncFuncs.forEach(fn => {
        const regex = new RegExp(`\\b${fn}\\s*\\(`, 'g');
        script = script.replace(regex, `await ${fn}(`);
      });

      // 2. Data Normalization for critical fields (AppSheet Parity)
      const normalizedData = { ...data };
      
      // Explicit mapping for customer number variations to Hebrew key
      const customerNum = normalizedData.customer_number || normalizedData.customerNumber || normalizedData['מספר_לקוח'];
      if (customerNum !== undefined) {
        normalizedData['מספר_לקוח'] = customerNum;
        normalizedData['customer_number'] = customerNum;
        normalizedData['customerNumber'] = customerNum;
      }

      // 3. Execution Scope: Inject all library functions into the local scope
      const keys = Object.keys(formulaFunctions);
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      
      let evaluator;
      try {
        evaluator = new AsyncFunction(...keys, 'data', `
          try { 
            return await (${script}); 
          } catch(e) { 
            return null; 
          }
        `);
      } catch (syntaxError) {
        console.warn("Formula Syntax Error:", syntaxError.message, "Formula:", formula);
        return null;
      }
      
      const result = await evaluator(...Object.values(formulaFunctions), normalizedData);
      return result === undefined ? null : result;
    } catch (e) {
      console.error("Formula Parser Error:", e.message, "Formula:", formula);
      return null;
    }
  }, [formulaFunctions]);

  return { evaluateFormula, formulaFunctions };
}
