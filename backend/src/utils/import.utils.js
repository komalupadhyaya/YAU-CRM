export function getVal(row, keys) {
    for (const key of keys) {
        for (const col of Object.keys(row)) {
            if (col.trim().toLowerCase() === key.toLowerCase()) {
                const v = row[col];
                return v !== undefined && v !== null ? String(v).trim() : '';
            }
        }
    }
    return '';
}
