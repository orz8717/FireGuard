
import { useEffect } from 'react';
import { supabase, getSupabaseAdmin } from '../src/lib/supabase';
import { dbService } from '../services/dbService';

/**
 * useBotRealtime Hook
 * 
 * Strictly isolated background listener for Supabase automation bots.
 * Subscribes to INSERT events on tables defined in active bots and triggers
 * the automation logic (GAS Webhook) automatically.
 */

const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx9Aprjm7RISvTet4j6xip62QlaUPeEnAy5cWDj6JKexwmifRyqDQ0PjuDP0Y3cB9Cg/exec';

export const useBotRealtime = () => {
  useEffect(() => {
    let activeChannels: any[] = [];

    const initRealtime = async () => {
      try {
        // 1. Fetch all active bots and normalize them
        const botsData = await dbService.getBots();
        const activeBots = botsData.filter((b: any) => b.is_active).map((b: any) => {
          const eventConfig = b.action_config?.event || { 
            type: b.event_type, 
            targetTable: b.table_name, 
            conditionFormula: b.condition_formula, 
            bypassSecurity: false,
            dataChangeType: b.event_type,
            scheduleType: b.schedule_type
          };
          return { ...b, eventConfig };
        });

        // 2. Filter bots that are configured for Realtime (FOR_EACH_ROW)
        const realtimeBots = activeBots.filter((bot: any) => 
          bot.eventConfig.scheduleType === 'FOR_EACH_ROW' || bot.schedule_type === 'FOR_EACH_ROW'
        );

        if (realtimeBots.length === 0) {
          console.log('[BotRealtime] No bots configured for FOR_EACH_ROW listening.');
          return;
        }

        // 3. Group bots by table to optimize subscriptions
        const tableMap: Record<string, any[]> = {};
        realtimeBots.forEach((bot: any) => {
          const table = bot.eventConfig.targetTable || bot.table_name;
          if (!table) return;
          if (!tableMap[table]) tableMap[table] = [];
          tableMap[table].push(bot);
        });

        // 4. Create a channel for each table (Listening to all changes)
        Object.entries(tableMap).forEach(([tableName, bots]) => {
          console.log(`[BotRealtime] Subscribing to INSERT & UPDATE events on table: ${tableName}`);
          
          const channel = supabase
            .channel(`bot-realtime-${tableName}`)
            .on(
              'postgres_changes',
              { event: '*', schema: 'public', table: tableName },
              async (payload) => {
                const event = payload.eventType; // 'INSERT', 'UPDATE', 'DELETE'
                if (event === 'DELETE') return;

                const newRow = payload.new;
                const rowId = newRow.ROWID || newRow.id;

                if (!rowId) {
                  console.warn(`[BotRealtime] Received ${event} on ${tableName} but no ROWID/id found.`);
                  return;
                }

                console.log(`[BotRealtime] ${event} detected in ${tableName} (ID: ${rowId}). Evaluating bots...`);

                // Fetch full record to ensure we have all columns (including JSONB fields)
                const { data: fullRecord, error: fetchError } = await getSupabaseAdmin()
                  .from(tableName)
                  .select('*')
                  .eq('ROWID', rowId)
                  .maybeSingle();

                if (fetchError || !fullRecord) {
                  console.error(`[BotRealtime] Failed to fetch full record for ${rowId} in ${tableName}:`, fetchError);
                  return;
                }

                // Execute each relevant bot based on event matching logic
                for (const bot of bots) {
                  const botEventType = bot.eventConfig.dataChangeType || bot.event_type;
                  
                  // Map Supabase events to Bot Event Types
                  const payloadEventMap: Record<string, string> = {
                    'INSERT': 'ADDS',
                    'UPDATE': 'UPDATES',
                    'DELETE': 'DELETES'
                  };
                  const mappedEvent = payloadEventMap[event] || event;

                  // Flexible Event Matching Logic (as requested)
                  // Trigger if:
                  // 1. Bot is set to 'ALL'
                  // 2. Bot event type matches exactly
                  // 3. Bot is set to 'ADDS' but we got an 'UPDATE' (Offline sync handling)
                  const shouldTrigger = (
                    botEventType === 'ALL' || 
                    botEventType === mappedEvent || 
                    (mappedEvent === 'UPDATES' && botEventType === 'ADDS')
                  );

                  if (shouldTrigger) {
                    await executeBotAutomation(bot, fullRecord);
                  }
                }
              }
            )
            .subscribe();

          activeChannels.push(channel);
        });
      } catch (err) {
        console.error('[BotRealtime] Initialization error:', err);
      }
    };

    const executeBotAutomation = async (bot: any, rowData: any) => {
      try {
        const actionConfig = bot.action_config || {};
        let steps = actionConfig.steps;
        
        // Defensive Step Handling
        if (steps === null || steps === undefined) {
          steps = [];
        } else if (!Array.isArray(steps)) {
          // If it's a single object, wrap it in an array
          steps = [steps];
        }

        if (steps.length === 0) {
          console.warn(`[BotRealtime] Bot "${bot.name}" (ID: ${bot.id}) triggered but has no valid steps.`);
          return;
        }

        const linkedChildTables = actionConfig.linked_child_tables || [];

        for (const step of steps) {
          if (!step) continue;
          
          if (step.type === 'RUN_TASK' && step.task?.type === 'EMAIL') {
            console.log(`[BotRealtime] Executing Bot: ${bot.name}, Step: ${step.name || 'Unnamed Step'}`);

            // 1. Fetch Child Data from linked tables
            const childData: Record<string, any[]> = {};
            if (linkedChildTables.length > 0) {
              const parentId = rowData.id || rowData.ROWID || rowData.inspectionSerialNumber;
              for (const childTable of linkedChildTables) {
                const { data: children } = await getSupabaseAdmin()
                  .from(childTable)
                  .select('*')
                  .or(`parent_id.eq."${parentId}",ROWID.eq."${parentId}"`);
                childData[childTable] = children || [];
              }
            }

            // 2. Flatten Data (Mirroring TriggersPage.tsx logic)
            const combinedData: Record<string, string> = {};
            const formatValue = (val: any) => (val === null || val === undefined) ? "" : String(val);
            const cleanKey = (k: string) => k.replace(/[\[\]<>]/g, '');

            // Flatten Parent
            Object.entries(rowData).forEach(([key, value]) => {
              if (key === 'temp_child_data' || key.startsWith('_')) return;
              combinedData[cleanKey(key)] = formatValue(value);
            });

            // Flatten Children (Linked Tables + temp_child_data)
            const allChildren: any[] = [];
            Object.values(childData).forEach(records => {
              if (Array.isArray(records)) allChildren.push(...records);
            });

            if (rowData.temp_child_data) {
              const tcd = typeof rowData.temp_child_data === 'string' ? JSON.parse(rowData.temp_child_data) : rowData.temp_child_data;
              Object.values(tcd).forEach((config: any) => {
                if (config.records && Array.isArray(config.records)) {
                  allChildren.push(...config.records);
                }
              });
            }

            allChildren.forEach((child, index) => {
              const displayIndex = index + 1;
              Object.entries(child).forEach(([cKey, cValue]) => {
                if (cKey === 'temp_child_data' || cKey.startsWith('_')) return;
                combinedData[`${cleanKey(cKey)}_${displayIndex}`] = formatValue(cValue);
              });

              // Grandchildren
              if (child.temp_child_data) {
                const gcd = typeof child.temp_child_data === 'string' ? JSON.parse(child.temp_child_data) : child.temp_child_data;
                Object.values(gcd).forEach((gConfig: any) => {
                  if (gConfig.records && Array.isArray(gConfig.records)) {
                    gConfig.records.forEach((gRecord: any) => {
                      Object.entries(gRecord).forEach(([gKey, gValue]) => {
                        if (gKey === 'temp_child_data' || gKey.startsWith('_')) return;
                        combinedData[`${cleanKey(gKey)}_${displayIndex}`] = formatValue(gValue);
                      });
                    });
                  }
                });
              }
            });

            // 3. Replace Placeholders
            const replacePlaceholders = (str: string | undefined) => {
              if (!str) return str;
              let result = str;
              Object.entries(combinedData).forEach(([key, value]) => {
                const regex = new RegExp(`<<${key}>>`, 'g');
                result = result.replace(regex, value);
              });
              return result;
            };

            const processedTask = {
              ...step.task,
              to: replacePlaceholders(step.task.to),
              subject: replacePlaceholders(step.task.subject),
              body: replacePlaceholders(step.task.body)
            };

            // 4. Prepare Payload & Send to GAS
            const payload = {
              templateId: step.task.googleDocTemplateId || step.task.templateId || bot.template_id,
              task: processedTask,
              combinedData: combinedData,
              rowData: rowData,
              childData: childData
            };

            console.log(`[BotRealtime] Dispatching payload for ${bot.name} to GAS...`);
            
            fetch(GAS_WEB_APP_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'text/plain' },
              body: JSON.stringify(payload)
            }).catch(err => console.error(`[BotRealtime] Error sending to GAS:`, err));
          }
        }
      } catch (err) {
        console.error(`[BotRealtime] Error executing bot ${bot.name}:`, err);
      }
    };

    initRealtime();

    return () => {
      console.log('[BotRealtime] Cleaning up subscriptions...');
      activeChannels.forEach(ch => supabase.removeChannel(ch));
    };
  }, []);
};
