
/**
 * Recursively bundles child records into a nested JSON structure for atomic saving.
 * Matches children to parents using UUID (id) and nests them under 'temp_child_data'.
 * Rule: Grandparent -> Parent -> Grandchild nesting required for 3-level hierarchies.
 */
export const nestChildRecords = (
  recordsMap: Record<string, any[]>, 
  parentUuid: string, // New UUID to assign to children
  matchUuid?: string, // Optional UUID to match against (e.g. temp ID)
  visited: Set<string> = new Set(),
  parentRowId?: string // New ROWID to assign to children
): any[] => {
  const effectiveMatchUuid = matchUuid || parentUuid;
  if (!effectiveMatchUuid || visited.has(String(effectiveMatchUuid))) {
    return [];
  }
  
  const currentVisited = new Set(visited);
  currentVisited.add(String(effectiveMatchUuid));

  const bundledChildren: any[] = [];

  Object.entries(recordsMap).forEach(([tableName, records]) => {
    if (!Array.isArray(records)) return;

    // FIX TYPO: Ensure the correct table name is used for the JSON key
    let sanitizedTableName = tableName;
    if (sanitizedTableName === 'כיבויים_הצי_שנתי' || sanitizedTableName === 'הצי_שנתי') {
      sanitizedTableName = 'כיבויים_חצי_שנתי';
    }

    // Filter records belonging to THIS parent
    const myChildren = records.filter(r => 
      (r.parent_id && String(r.parent_id).toLowerCase() === String(effectiveMatchUuid).toLowerCase()) ||
      (r.parent_row_id && String(r.parent_row_id).toLowerCase() === String(effectiveMatchUuid).toLowerCase())
    );

    if (myChildren.length > 0) {
      const tableConfig = {
        table: sanitizedTableName,
        fk_column: 'parent_id',
        records: myChildren.map(child => {
          // Clean the child record
          const cleanChild = { ...child };
          
          // Rule: Always use the id (UUID) for linking via parent_id
          // Assign the NEW parentUuid
          cleanChild.parent_id = parentUuid;
          
          // If we have a ROWID for the parent, assign it to parent_row_id
          if (parentRowId) {
            cleanChild.parent_row_id = parentRowId;
          }
          
          delete cleanChild._is_pending;
          delete cleanChild._target_table;

          // Recursively process grandchildren into THIS child's temp_child_data
          // For grandchildren, we use child.id for both matching and assigning (as they are children of this child)
          // Also pass the child's ROWID as the new parentRowId for grandchildren
          const grandchildren = nestChildRecords(recordsMap, child.id, undefined, currentVisited, child.ROWID);
          if (grandchildren.length > 0) {
            cleanChild.temp_child_data = grandchildren;
          } else {
            delete cleanChild.temp_child_data;
          }

          return cleanChild;
        })
      };
      bundledChildren.push(tableConfig);
    }
  });

  return bundledChildren;
};
