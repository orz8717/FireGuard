
import { useEffect, useRef } from 'react';
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
  const processedIds = useRef(new Set<string>());

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
                const rowId = (event === 'DELETE') 
                  ? (payload.old?.ROWID || payload.old?.id) 
                  : (payload.new?.ROWID || payload.new?.id);

                if (!rowId) {
                  console.warn(`[BotRealtime] Received ${event} on ${tableName} but no ROWID/id found.`);
                  return;
                }

                console.log(`[BotRealtime] ${event} detected in ${tableName} (ID: ${rowId}). Evaluating bots...`);

                let fullRecord = null;
                if (event !== 'DELETE') {
                  // Fetch full record to ensure we have all columns (including JSONB fields)
                  const { data, error: fetchError } = await getSupabaseAdmin()
                    .from(tableName)
                    .select('*')
                    .eq('ROWID', rowId)
                    .maybeSingle();

                  if (fetchError || !data) {
                    console.error(`[BotRealtime] Failed to fetch full record for ${rowId} in ${tableName}:`, fetchError);
                    return;
                  }
                  fullRecord = data;
                } else {
                  fullRecord = payload.old; // Use old data for DELETE
                }

                  // Determine logicalEvent once per payload (as requested for precise separation)
                  let logicalEvent: 'ADDS' | 'UPDATES' | 'DELETES' | null = null;

                  if (event === 'INSERT') {
                    logicalEvent = 'ADDS';
                  } else if (event === 'UPDATE') {
                    // Fetch row data from Supabase (including created_at and updated_at)
                    const createdAt = fullRecord?.created_at ? new Date(fullRecord.created_at).getTime() : 0;
                    const updatedAt = fullRecord?.updated_at ? new Date(fullRecord.updated_at).getTime() : 0;
                    
                    // Determine the "Logical" Event:
                    // If created_at and updated_at are the same (or within 10 seconds), define the event as ADDS.
                    // This handles UPSERTs that are logically new records.
                    const isNewRecord = Math.abs(updatedAt - createdAt) < 10000; 

                    if (isNewRecord && !processedIds.current.has(rowId)) {
                      logicalEvent = 'ADDS';
                    } else {
                      logicalEvent = 'UPDATES';
                    }
                  } else if (event === 'DELETE') {
                    logicalEvent = 'DELETES';
                  }

                  if (logicalEvent) {
                    console.log(`[Automation] Logical Event determined: ${logicalEvent} for record: ${rowId}`);
                  }

                  // Prevent Duplicates: Use a useRef Set to track ROWIDs that have already triggered an ADDS event
                  if (logicalEvent === 'ADDS') {
                    if (processedIds.current.has(rowId)) {
                      console.log(`[BotRealtime] Skipping duplicate ADDS trigger for ${rowId}`);
                      return;
                    }
                    processedIds.current.add(rowId);
                  }

                // 4. Trigger Bots via dbService to ensure consistent logic
                // We pass the logicalEvent (ADDS/UPDATES) to triggerBots so it can correctly match bots
                console.log(`[BotRealtime] Triggering bots for table ${tableName} with logicalEvent: ${logicalEvent}`);
                await dbService.triggerBots(tableName, rowId, logicalEvent);
              }
            )
            .subscribe();

          activeChannels.push(channel);
        });
      } catch (err) {
        console.error('[BotRealtime] Initialization error:', err);
      }
    };

    initRealtime();

    return () => {
      console.log('[BotRealtime] Cleaning up subscriptions...');
      activeChannels.forEach(ch => supabase.removeChannel(ch));
    };
  }, []);
};
