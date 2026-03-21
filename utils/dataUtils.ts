
/**
 * Recursively bundles child records into a single JSON structure for atomic saving.
 * Matches children to parents using ROWID and nests them under 'temp_child_data'.
 */
export const nestChildRecords = (
  recordsMap: Record<string, any[]>, 
  parentRowId: string,
  visited: Set<string> = new Set(),
  flatBundled: Record<string, any> = {},
  newParentId?: string
): Record<string, any> => {
  if (!parentRowId || visited.has(String(parentRowId))) {
    return flatBundled; // Prevent infinite recursion
  }
  
  const currentVisited = new Set(visited);
  currentVisited.add(String(parentRowId));

  // The ID that children should use to link to this parent
  const effectiveParentId = newParentId || parentRowId;

  Object.entries(recordsMap).forEach(([tableName, records]) => {
    // Ensure records is an array to avoid "is not iterable" or "filter is not a function" errors
    if (!Array.isArray(records)) return;

    // FIX TYPO: Ensure the correct table name is used for the JSON key
    let sanitizedTableName = tableName;
    if (sanitizedTableName === 'כיבויים_הצי_שנתי' || sanitizedTableName === 'הצי_שנתי') {
      sanitizedTableName = 'כיבויים_חצי_שנתי';
    }

    // Filter records belonging to THIS parent
    const myChildren = records.filter(r => 
      (r.parent_id && String(r.parent_id) === String(parentRowId))
    );

    if (myChildren.length > 0) {
      if (!flatBundled[sanitizedTableName]) {
        flatBundled[sanitizedTableName] = {
          fk_column: 'parent_id',
          records: []
        };
      }

      myChildren.forEach(child => {
        // Clean the child record - explicitly strip temp_child_data to prevent recursive nesting
        const cleanChild = { ...child };
        
        // Update the parent_id to the effective ID (finalized serial/UUID)
        cleanChild.parent_id = effectiveParentId;
        
        delete cleanChild.temp_child_data;
        delete cleanChild._is_pending;
        delete cleanChild._target_table;

        // Add clean child to the flat array
        flatBundled[sanitizedTableName].records.push(cleanChild);

        // The child's own ID is its 'id' or 'ROWID'
        let childOwnId = child.id;
        if (child.ROWID && String(child.ROWID) !== String(parentRowId)) {
          childOwnId = child.ROWID;
        }
        
        // Recursively process grandchildren into the SAME flat object
        nestChildRecords(recordsMap, childOwnId, currentVisited, flatBundled);
      });
    }
  });

  return flatBundled;
};
