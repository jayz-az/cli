/**
 * Smart output formatter for jayz
 * - JSON: unchanged (pretty-printed)
 * - Table: prioritizes Name and Resource Group (fallback to id).
 * - Adds subscriptionId and state when present.
 */
function isArrayLike(x) { return Array.isArray(x); }

function toArrayRows(data){
  if(isArrayLike(data)) return data;
  if(data && isArrayLike(data.value)) return data.value;
  if(data && typeof data==='object'){
    for(const k of Object.keys(data)){
      if(Array.isArray(data[k])) return data[k];
    }
  }
  return null;
}

function extractResourceGroup(id){
  if(!id || typeof id!=='string') return;
  const m=id.match(/\/resourceGroups\/([^\/]+)/i);
  return m ? decodeURIComponent(m[1]) : undefined;
}

function extractSubscriptionId(item){
  if (item && typeof item.subscriptionId === 'string') return item.subscriptionId;
  const id = item && (item.id || (item.properties && item.properties.id));
  if (typeof id === 'string') {
    const m = id.match(/\/subscriptions\/([0-9a-fA-F-]{8,})/);
    if (m && m[1]) return m[1];
  }
  return undefined;
}

function extractName(item){
  if(!item||typeof item!=='object') return;
  if(typeof item.name==='string') return item.name;
  if(item.properties&&typeof item.properties.name==='string') return item.properties.name;
  const id=item.id||(item.properties&&item.properties.id);
  if(typeof id==='string'){
    const tail=id.match(/\/providers\/[^\/]+\/[^\/]+\/([^?\s#]+)/i)||id.match(/\/([^\/]+)$/);
    if(tail&&tail[1]) return decodeURIComponent(tail[1]);
  }
  if(typeof item.displayName==='string') return item.displayName;
  if(typeof item.userPrincipalName==='string') return item.userPrincipalName;
  if(typeof item.appId==='string') return item.appId;
  return undefined;
}

function extractLocation(item){ if(!item||typeof item!=='object') return; return item.location||(item.properties&&item.properties.location); }
function extractType(item){ if(!item||typeof item!=='object') return; return item.type||(item.properties&&item.properties.type); }

function toDisplayRow(item){
  const id=item&&(item.id||(item.properties&&item.properties.id));
  const name=extractName(item);
  const resourceGroup=extractResourceGroup(id)||item.resourceGroup||item.resourceGroupName;
  const location=extractLocation(item);
  const type=extractType(item);
  const subscriptionId = extractSubscriptionId(item);
  const state = item && (item.state || (item.properties && item.properties.state));

  const row={};
  if(name) row.name=name;
  if(subscriptionId) row.subscriptionId = subscriptionId;
  if(resourceGroup) row.resourceGroup=resourceGroup;
  if(state) row.state = state;
  if(location) row.location=location;
  if(type) row.type=type;

  if(!row.name && !row.resourceGroup){
    row.id=id||item.id||'';
  }
  return row;
}

function computeColumns(rows){
  const preferred=['name','subscriptionId','resourceGroup','state','location','type','id'];
  const present=new Set();
  rows.forEach(r=>Object.keys(r).forEach(k=>present.add(k)));
  const cols=preferred.filter(k=>present.has(k));
  if(cols.length===0) return ['id'];
  return cols;
}

function formatCell(val,max=60){
  if(val==null) return '';
  if(typeof val==='object'){
    try{ val=JSON.stringify(val);}catch(_){ val=String(val);}
  }
  val=String(val);
  if(val.length>max) return val.slice(0,max-1)+'…';
  return val;
}

function pad(str,len){ const s=String(str); const needed=len-s.length; return s+(needed>0?' '.repeat(needed):''); }

function printTableFromRows(rows){
  if(!rows||rows.length===0){ console.log('(no results)'); return; }
  const cols=computeColumns(rows);
  const widths={};
  cols.forEach(c=>widths[c]=c.length);
  rows.forEach(r=>{
    cols.forEach(c=>{
      const w=formatCell(r[c]).length;
      if(w>widths[c]) widths[c]=Math.min(w,60);
    });
  });
  const header=cols.map(c=>pad(c,widths[c])).join('  ');
  const sep=cols.map(c=>'-'.repeat(Math.max(3,widths[c]))).join('  ');
  console.log(header);
  console.log(sep);
  rows.forEach(r=>{
    const line=cols.map(c=>pad(formatCell(r[c]),widths[c])).join('  ');
    console.log(line);
  });
}

function printOutput(data,output='json'){
  if(output!=='table'){
    console.log(JSON.stringify(data,null,2)); return;
  }
  const arr=toArrayRows(data);
  if(!arr){ console.log(JSON.stringify(data,null,2)); return; }
  const rows=arr.map(toDisplayRow);
  printTableFromRows(rows);
}

module.exports={printOutput};
