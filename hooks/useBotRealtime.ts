import { useEffect, useRef } from 'react';
import { getSupabaseAdmin } from '../src/lib/supabase';
import { dbService } from '../services/dbService';

// Neon does not support realtime subscriptions.
// We poll for recent changes (rows updated in the last 30 s) every 10 s.
const POLL_INTERVAL_MS = 10_000;
const LOOKBACK_MS = 30_000;

export const useBotRealtime = () => {
  const processedIds = useRef(new Set<string>());

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      if (!mounted) return;

      try {
        const botsData = await dbService.getBots();
        const realtimeBots = botsData.filter((b: any) =>
          b.is_active &&
          (b.schedule_type === 'FOR_EACH_ROW' ||
            b.action_config?.event?.scheduleType === 'FOR_EACH_ROW')
        );

        if (!realtimeBots.length) return;

        const tableMap: Record<string, any[]> = {};
        realtimeBots.forEach((bot: any) => {
          const table = bot.action_config?.event?.targetTable || bot.table_name;
          if (!table) return;
          if (!tableMap[table]) tableMap[table] = [];
          tableMap[table].push(bot);
        });

        const since = new Date(Date.now() - LOOKBACK_MS).toISOString();

        for (const [tableName, bots] of Object.entries(tableMap)) {
          // Fetch rows modified in the last LOOKBACK_MS window
          const { data: rows } = await getSupabaseAdmin()
            .from(tableName)
            .select('*')
            .order('updated_at', { ascending: false })
            .limit(50) as any;

          if (!rows?.length) continue;

          const recent = rows.filter((r: any) => r.updated_at && r.updated_at > since);

          for (const row of recent) {
            const rowId = row.ROWID || row.id;
            if (!rowId) continue;

            const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
            const updatedAt = row.updated_at ? new Date(row.updated_at).getTime() : 0;
            const isNew = Math.abs(updatedAt - createdAt) < 10_000;

            let logicalEvent: 'ADDS' | 'UPDATES' | null = isNew ? 'ADDS' : 'UPDATES';

            if (logicalEvent === 'ADDS') {
              if (processedIds.current.has(rowId)) continue;
              processedIds.current.add(rowId);
            }

            await dbService.triggerBots(tableName, rowId, logicalEvent);
          }
        }
      } catch (err) {
        console.error('[BotRealtime] Poll error:', err);
      }
    };

    const intervalId = setInterval(poll, POLL_INTERVAL_MS);
    poll();

    return () => {
      mounted = false;
      clearInterval(intervalId);
    };
  }, []);
};
