function printOutput(data, output) {
  if (!output || output === 'json') {
    console.log(JSON.stringify(data, null, 2));
    return;
  }
  if (output === 'table') {
    const tableData = toTabular(data);
    console.table(tableData);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

function toTabular(data) {
  if (data && Array.isArray(data.value)) return data.value;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    return Object.keys(data).map((k) => ({ key: k, value: data[k] }));
  }
  return [{ value: data }];
}

module.exports = { printOutput };
