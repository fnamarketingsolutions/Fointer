const csvCell = (value) => {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
};

export const downloadCsv = (filename, columns, rows) => {
  const header = columns.map((column) => csvCell(column.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((column) => csvCell(column.value(row))).join(",")
  );
  const blob = new Blob([`\uFEFF${[header, ...lines].join("\r\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const csvDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
};
