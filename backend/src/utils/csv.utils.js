/**
 * Utility to convert an array of objects to a CSV string.
 * Handles proper escaping of quotes, commas, and newlines.
 * 
 * @param {Array<Object>} data - Array of objects to convert
 * @param {Array<string>} fields - Specific fields to include (optional)
 * @returns {string} - CSV formatted string
 */
export const jsonToCsv = (data, fields) => {
    if (!data || data.length === 0) return '';

    // Determine headings
    const headings = fields || Object.keys(data[0]);

    const escape = (val) => {
        if (val === null || val === undefined) return '';
        let str = String(val);
        // Replace " with ""
        str = str.replace(/"/g, '""');
        // Wrap in quotes if contains " , or \n
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            str = `"${str}"`;
        }
        return str;
    };

    const lines = [
        headings.join(','),
        ...data.map(row =>
            headings.map(field => escape(row[field])).join(',')
        )
    ];

    return lines.join('\n');
};
