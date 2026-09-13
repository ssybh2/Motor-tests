(() => {
  'use strict';

  const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;
  const MAX_TABLE_FILES = 250;
  const MAX_TEXT_CHARS_PER_FILE = 40 * 1024 * 1024;
  const MAX_TERMS = 10;
  const G = 9.80665;

  const DET_HEADERS = [
    'TIME(ms)', 'PWM(us)', 'ax(G)', 'U(V)', 'I(A)', 'N(RPM)', 'F(KG)', 'T(N.M)',
    'Motor output power(W)', 'System input power(W)', 'Motor efficiency',
    'Propeller force efficiency(G/W)', 'System force efficiency(G/W)', 'ay(G)',
    'Infrared temperature(C)', 'X-Vibration(mm/s)'
  ];

  const PRESETS = [
    {
      id: 'custom', label: '自定义 / Custom', x: [], y: [],
      xMeta: { name: 'X', symbol: 'x', unit: '' }, yMeta: { name: 'Y', symbol: 'y', unit: '' },
      terms: [{ power: 2, coeff: 'a_2' }, { power: 1, coeff: 'a_1' }, { power: 0, coeff: 'C' }]
    },
    {
      id: 'rpm_thrust', label: 'RPM → 推力 / Thrust',
      x: [/^N\(RPM\)$/i, /^rpm$/i, /rpm/i], y: [/^F\(N\)$/i, /thrust/i, /^F\(KG\)$/i, /force/i],
      xMeta: { name: 'RPM', symbol: 'RPM', unit: 'rpm' }, yMeta: { name: 'Thrust', symbol: 'T', unit: 'N' },
      terms: [{ power: 2, coeff: 'K_{T2}' }, { power: 1, coeff: 'K_{T1}' }, { power: 0, coeff: 'C' }]
    },
    {
      id: 'rpm_torque', label: 'RPM → 扭矩 / Torque',
      x: [/^N\(RPM\)$/i, /^rpm$/i, /rpm/i], y: [/^T\(N\.M\)$/i, /torque/i, /moment/i],
      xMeta: { name: 'RPM', symbol: 'RPM', unit: 'rpm' }, yMeta: { name: 'Torque', symbol: 'Q', unit: 'N·m' },
      terms: [{ power: 2, coeff: 'K_{Q2}' }, { power: 1, coeff: 'K_{Q1}' }, { power: 0, coeff: 'C' }]
    },
    {
      id: 'rpm_power', label: 'RPM → 功率 / Power',
      x: [/^N\(RPM\)$/i, /^rpm$/i, /rpm/i], y: [/^Motor output power\(W\)$/i, /motor.*power/i, /power/i],
      xMeta: { name: 'RPM', symbol: 'RPM', unit: 'rpm' }, yMeta: { name: 'Power', symbol: 'P', unit: 'W' },
      terms: [{ power: 3, coeff: 'K_{P3}' }, { power: 2, coeff: 'K_{P2}' }, { power: 1, coeff: 'K_{P1}' }, { power: 0, coeff: 'C' }]
    },
    {
      id: 'pwm_rpm', label: 'PWM → RPM',
      x: [/^PWM\(us\)$/i, /pwm/i, /throttle/i, /command/i], y: [/^N\(RPM\)$/i, /^rpm$/i, /rpm/i],
      xMeta: { name: 'PWM', symbol: 'PWM', unit: 'μs' }, yMeta: { name: 'RPM', symbol: 'RPM', unit: 'rpm' },
      terms: [{ power: 2, coeff: 'a_2' }, { power: 1, coeff: 'a_1' }, { power: 0, coeff: 'C' }]
    },
    {
      id: 'pwm_thrust', label: 'PWM → 推力 / Thrust',
      x: [/^PWM\(us\)$/i, /pwm/i, /throttle/i, /command/i], y: [/^F\(N\)$/i, /thrust/i, /^F\(KG\)$/i, /force/i],
      xMeta: { name: 'PWM', symbol: 'PWM', unit: 'μs' }, yMeta: { name: 'Thrust', symbol: 'T', unit: 'N' },
      terms: [{ power: 2, coeff: 'K_{T2}' }, { power: 1, coeff: 'K_{T1}' }, { power: 0, coeff: 'C' }]
    },
    {
      id: 'omega_thrust', label: '角速度 ω → 推力 / Thrust',
      x: [/^omega\(rad\/s\)$/i, /rad\/s/i], y: [/^F\(N\)$/i, /thrust/i, /^F\(KG\)$/i, /force/i],
      xMeta: { name: 'Angular speed', symbol: '\\omega', unit: 'rad/s' }, yMeta: { name: 'Thrust', symbol: 'T', unit: 'N' },
      terms: [{ power: 2, coeff: 'k_T' }, { power: 1, coeff: 'k_{T1}' }, { power: 0, coeff: 'C' }]
    },
    {
      id: 'current_torque', label: '电流 → 扭矩 / Current → Torque',
      x: [/^I\(A\)$/i, /current/i, /amp/i], y: [/^T\(N\.M\)$/i, /torque/i, /moment/i],
      xMeta: { name: 'Current', symbol: 'I', unit: 'A' }, yMeta: { name: 'Torque', symbol: 'Q', unit: 'N·m' },
      terms: [{ power: 1, coeff: 'K_I' }, { power: 0, coeff: 'C' }]
    },
    {
      id: 'rpm_current', label: 'RPM → 电流 / Current',
      x: [/^N\(RPM\)$/i, /^rpm$/i, /rpm/i], y: [/^I\(A\)$/i, /current/i, /amp/i],
      xMeta: { name: 'RPM', symbol: 'RPM', unit: 'rpm' }, yMeta: { name: 'Current', symbol: 'I', unit: 'A' },
      terms: [{ power: 2, coeff: 'a_2' }, { power: 1, coeff: 'a_1' }, { power: 0, coeff: 'C' }]
    },
    {
      id: 'voltage_rpm', label: '电压 → RPM / Voltage → RPM',
      x: [/^U\(V\)$/i, /voltage/i, /volt/i], y: [/^N\(RPM\)$/i, /^rpm$/i, /rpm/i],
      xMeta: { name: 'Voltage', symbol: 'V', unit: 'V' }, yMeta: { name: 'RPM', symbol: 'RPM', unit: 'rpm' },
      terms: [{ power: 2, coeff: 'a_2' }, { power: 1, coeff: 'a_1' }, { power: 0, coeff: 'C' }]
    },
    {
      id: 'j_ct', label: '前进比 J → Cₜ',
      x: [/^j$/i, /advance.*ratio/i], y: [/^c[_ ]?t$/i, /thrust.*coeff/i],
      xMeta: { name: 'Advance ratio', symbol: 'J', unit: '' }, yMeta: { name: 'Thrust coefficient', symbol: 'C_T', unit: '' },
      terms: [{ power: 2, coeff: 'a_2' }, { power: 1, coeff: 'a_1' }, { power: 0, coeff: 'a_0' }]
    },
    {
      id: 'j_cp', label: '前进比 J → Cₚ',
      x: [/^j$/i, /advance.*ratio/i], y: [/^c[_ ]?p$/i, /power.*coeff/i],
      xMeta: { name: 'Advance ratio', symbol: 'J', unit: '' }, yMeta: { name: 'Power coefficient', symbol: 'C_P', unit: '' },
      terms: [{ power: 3, coeff: 'a_3' }, { power: 2, coeff: 'a_2' }, { power: 1, coeff: 'a_1' }, { power: 0, coeff: 'a_0' }]
    }
  ];

  const state = { datasets: [], jobs: [], results: new Map(), sourceLabel: '', counter: 0 };
  const el = {
    fileInput: document.getElementById('fileInput'), dropzone: document.getElementById('dropzone'), loadStatus: document.getElementById('loadStatus'),
    datasetArea: document.getElementById('datasetArea'), previewDatasetSelect: document.getElementById('previewDatasetSelect'), datasetSummary: document.getElementById('datasetSummary'),
    previewTable: document.getElementById('previewTable'), jobs: document.getElementById('jobs'), jobTemplate: document.getElementById('jobTemplate'), addJobBtn: document.getElementById('addJobBtn'),
    runAllBtn: document.getElementById('runAllBtn'), reportTitle: document.getElementById('reportTitle'), reportNotes: document.getElementById('reportNotes'),
    resultStatus: document.getElementById('resultStatus'), results: document.getElementById('results'), exportJsonBtn: document.getElementById('exportJsonBtn'), exportPdfBtn: document.getElementById('exportPdfBtn')
  };

  function uid(prefix = 'id') { state.counter += 1; return `${prefix}-${Date.now().toString(36)}-${state.counter}`; }
  function escapeHtml(v) { return String(v ?? '').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;'); }
  function setStatus(node, message, type = 'muted') { node.className = `status ${type}`; node.textContent = message; }
  function toNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    if (v === null || v === undefined) return NaN;
    const s = String(v).trim(); if (!s || /^nan$/i.test(s)) return NaN;
    const n = Number(s.replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, ''));
    return Number.isFinite(n) ? n : NaN;
  }
  function cleanHeader(h, i) { const s = String(h ?? '').replace(/^\uFEFF/, '').trim(); return s || `Column_${i + 1}`; }
  function uniqueHeaders(headers) {
    const seen = new Map();
    return headers.map((h, i) => { const base = cleanHeader(h, i); const n = seen.get(base) || 0; seen.set(base, n + 1); return n ? `${base}_${n + 1}` : base; });
  }
  function kindFromName(name) { if (/阶梯数据/.test(name)) return '阶梯数据'; if (/低频数据/.test(name)) return '低频数据'; if (/高频数据/.test(name)) return '高频数据'; return '表格数据'; }
  function decodeBytes(bytes) {
    const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(arr), encoding: 'UTF-8' }; }
    catch (_) { try { return { text: new TextDecoder('gb18030').decode(arr), encoding: 'GB18030' }; } catch (_) { return { text: new TextDecoder('utf-8').decode(arr), encoding: 'UTF-8 (replacement)' }; } }
  }
  function detectDelimiter(line) {
    const tabs=(line.match(/\t/g)||[]).length, commas=(line.match(/,/g)||[]).length, semis=(line.match(/;/g)||[]).length;
    if (tabs>=commas && tabs>=semis && tabs>0) return '\t'; if (commas>=semis && commas>0) return ','; if (semis>0) return ';'; return '';
  }
  function detHeaderIndex(lines) {
    let best=-1,bestScore=0; lines.forEach((line,i)=>{ if(i>40)return; const score=['TIME(ms)','PWM(us)','N(RPM)','F(KG)','T(N.M)','U(V)','I(A)'].reduce((s,k)=>s+(line.includes(k)?1:0),0); if(score>bestScore){bestScore=score;best=i;} });
    return bestScore>=3?best:-1;
  }
  function parseMetadata(lines, hi) {
    const meta={}; for(let i=0;i<Math.max(0,hi);i+=1){const cells=lines[i].split('\t').map(s=>s.trim()).filter(Boolean);for(let j=0;j+1<cells.length;j+=2){const k=cells[j],v=cells[j+1];if(k&&v&&k.length<80)meta[k]=v;}} return meta;
  }
  function rowsFromDelimited(lines, headers, delimiter, start) {
    const rows=[]; for(let i=start;i<lines.length;i+=1){if(!lines[i].trim())continue;const cells=lines[i].split(delimiter);if(cells.every(c=>!String(c).trim()))continue;const row={};headers.forEach((h,j)=>row[h]=(cells[j]??'').trim());rows.push(row);} return rows;
  }
  function addDerivedColumns(ds) {
    if(ds.headers.includes('N(RPM)')&&!ds.headers.includes('omega(rad/s)')){ds.headers.push('omega(rad/s)');ds.rows.forEach(r=>{const rpm=toNumber(r['N(RPM)']);r['omega(rad/s)']=Number.isFinite(rpm)?rpm*2*Math.PI/60:'';});}
    if(ds.headers.includes('F(KG)')&&!ds.headers.includes('F(N)')){ds.headers.push('F(N)');ds.rows.forEach(r=>{const kgf=toNumber(r['F(KG)']);r['F(N)']=Number.isFinite(kgf)?kgf*G:'';});}
    if(ds.headers.includes('U(V)')&&ds.headers.includes('I(A)')&&!ds.headers.includes('U×I(W)')){ds.headers.push('U×I(W)');ds.rows.forEach(r=>{const u=toNumber(r['U(V)']),i=toNumber(r['I(A)']);r['U×I(W)']=Number.isFinite(u)&&Number.isFinite(i)?u*i:'';});}
    return ds;
  }
  function parseDetTable(name,text,encoding){
    const lines=text.replace(/\r/g,'').split('\n'),hi=detHeaderIndex(lines);
    if(hi>=0){const headers=uniqueHeaders(lines[hi].split('\t')),rows=rowsFromDelimited(lines,headers,'\t',hi+1);if(!rows.length)return null;return addDerivedColumns({id:uid('dataset'),name,sourcePath:name,kind:kindFromName(name),headers,rows,encoding,metadata:parseMetadata(lines,hi),format:'DET text-XLS'});}
    const first=lines.find(l=>l.trim());if(!first)return null;const cells=first.split('\t'),ratio=cells.length?cells.filter(v=>Number.isFinite(toNumber(v))).length/cells.length:0;
    if(cells.length===DET_HEADERS.length&&ratio>=.65){const headers=[...DET_HEADERS],rows=rowsFromDelimited(lines,headers,'\t',0);return addDerivedColumns({id:uid('dataset'),name,sourcePath:name,kind:kindFromName(name),headers,rows,encoding,metadata:{},format:'DET text-XLS (headerless continuation)'});} return null;
  }
  function parseGenericTable(name,text,encoding){
    const first=text.replace(/\r/g,'').split('\n').find(l=>l.trim())||'',delimiter=detectDelimiter(first)||undefined;
    let parsed=Papa.parse(text,{header:true,skipEmptyLines:'greedy',delimiter,transformHeader:cleanHeader}),headers=uniqueHeaders(parsed.meta.fields||[]);
    const numericRatio=headers.length?headers.filter(h=>Number.isFinite(toNumber(h))).length/headers.length:0;
    if(headers.length<2||numericRatio>.6){const fallback=Papa.parse(text,{header:false,skipEmptyLines:'greedy',delimiter}),width=Math.max(0,...fallback.data.map(r=>Array.isArray(r)?r.length:0));headers=Array.from({length:width},(_,i)=>`Column_${i+1}`);parsed={data:fallback.data.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??'']))),errors:fallback.errors};}
    const rows=parsed.data.filter(r=>r&&typeof r==='object').map(raw=>{const values=Object.values(raw),out={};headers.forEach((h,i)=>out[h]=typeof(values[i]??'')==='string'?String(values[i]??'').trim():values[i]);return out;}).filter(r=>headers.some(h=>String(r[h]??'').trim()!==''));
    if(headers.length<2||!rows.length)throw new Error(`${name}: 未识别到有效表格 / no valid table detected`);
    return addDerivedColumns({id:uid('dataset'),name,sourcePath:name,kind:kindFromName(name),headers,rows,encoding,metadata:{},format:'Delimited text'});
  }
  function parseTabular(name,text,encoding){return parseDetTable(name,text,encoding)||parseGenericTable(name,text,encoding);}
  function mergeDatasets(datasets,name,kind='合并数据'){const headerSet=new Set(['__source_file']);datasets.forEach(ds=>ds.headers.forEach(h=>headerSet.add(h)));const headers=Array.from(headerSet),rows=[];datasets.forEach(ds=>ds.rows.forEach(row=>rows.push({__source_file:ds.name,...row})));return{id:uid('merged'),name,sourcePath:name,kind,headers,rows,merged:true,encoding:'mixed',metadata:{},format:'Merged tables'};}
  function buildDatasetList(discovered){const merged=[];['阶梯数据','低频数据','高频数据'].forEach(kind=>{const group=discovered.filter(d=>d.kind===kind&&d.rows.length);if(group.length>1)merged.push(mergeDatasets(group,`${kind} · 全部重复测试（合并）`,kind));});if(discovered.length>1)merged.push(mergeDatasets(discovered,`全部可用表格（合并，共 ${discovered.length} 个）`,'全部数据'));return[...merged,...discovered];}
  async function loadEntry(name,bytes){if(!bytes||bytes.length===0)return null;const{text,encoding}=decodeBytes(bytes);if(text.length>MAX_TEXT_CHARS_PER_FILE)throw new Error(`${name}: 文件过大，已跳过`);return parseTabular(name,text,encoding);}

  async function handleUpload(file){
    if(!file)return;if(file.size>MAX_UPLOAD_BYTES){setStatus(el.loadStatus,'文件超过 250 MB，请拆分测试包。','error');return;}setStatus(el.loadStatus,`正在读取 / Reading ${file.name} ...`);state.sourceLabel=file.name;
    try{
      const lower=file.name.toLowerCase(),discovered=[],warnings=[];
      if(lower.endsWith('.zip')){const zip=await JSZip.loadAsync(file),entries=Object.values(zip.files).filter(e=>!e.dir&&/\.(csv|tsv|txt|xls)$/i.test(e.name)).slice(0,MAX_TABLE_FILES);if(!entries.length)throw new Error('ZIP 中没有找到 XLS / CSV / TSV / TXT 数据文件。');for(const entry of entries){try{const ds=await loadEntry(entry.name,await entry.async('uint8array'));if(ds)discovered.push(ds);}catch(err){warnings.push(err.message);}}}
      else if(/\.(csv|tsv|txt|xls)$/i.test(lower)){const ds=await loadEntry(file.name,new Uint8Array(await file.arrayBuffer()));if(ds)discovered.push(ds);}else throw new Error('支持 ZIP、XLS（测试台文本格式）、CSV、TSV、TXT。');
      if(!discovered.length)throw new Error(warnings[0]||'没有发现含有效数据行的表格。');
      state.datasets=buildDatasetList(discovered);state.jobs=[];state.results.clear();renderDatasetControls();renderJobs();renderResults();
      const preferred=state.datasets.find(d=>d.kind==='阶梯数据'&&d.merged)||state.datasets.find(d=>d.kind==='阶梯数据')||state.datasets[0];el.previewDatasetSelect.value=preferred.id;renderPreview();addJob({datasetId:preferred.id,presetId:guessInitialPreset(preferred)});
      const totalRows=discovered.reduce((s,d)=>s+d.rows.length,0),detCount=discovered.filter(d=>d.format.startsWith('DET')).length,base=`已载入 ${discovered.length} 个有效表格，共 ${totalRows} 行；DET 文件 ${detCount} 个。`;
      setStatus(el.loadStatus,warnings.length?`${base} 另有 ${warnings.length} 个警告。`:base,warnings.length?'warning':'success');el.addJobBtn.disabled=false;updateRunButtons();
    }catch(err){console.error(err);setStatus(el.loadStatus,err.message||'读取数据失败。','error');}
  }

  function renderDatasetControls(){el.datasetArea.classList.remove('hidden');el.previewDatasetSelect.innerHTML=state.datasets.map(ds=>`<option value="${escapeHtml(ds.id)}">${escapeHtml(ds.name)}</option>`).join('');renderPreview();}
  function renderPreview(){const ds=state.datasets.find(d=>d.id===el.previewDatasetSelect.value)||state.datasets[0];if(!ds)return;const vh=ds.headers.slice(0,18);el.datasetSummary.textContent=`${ds.rows.length} 行 · ${ds.headers.length} 列 · ${ds.kind}${ds.encoding?` · ${ds.encoding}`:''}`;el.previewTable.innerHTML=`<thead><tr>${vh.map(h=>`<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${ds.rows.slice(0,10).map(r=>`<tr>${vh.map(h=>`<td>${escapeHtml(r[h])}</td>`).join('')}</tr>`).join('')}</tbody>`;}
  function findColumn(headers,patterns){for(const p of patterns){const f=headers.find(h=>p.test(h));if(f)return f;}return'';}
  function guessInitialPreset(ds){const h=ds.headers.join(' ');if(/N\(RPM\)|rpm/i.test(h)&&/F\(N\)|F\(KG\)|thrust|force/i.test(h))return'rpm_thrust';if(/N\(RPM\)|rpm/i.test(h)&&/T\(N\.M\)|torque/i.test(h))return'rpm_torque';if(/PWM\(us\)|pwm|throttle/i.test(h)&&/N\(RPM\)|rpm/i.test(h))return'pwm_rpm';return'custom';}

  function cloneTerms(terms){return terms.map(t=>({id:uid('term'),power:t.power,coeff:t.coeff,enabled:t.enabled!==false}));}
  function guessUnit(col){
    const s=String(col||'');if(/^N\(RPM\)$/i.test(s))return'rpm';if(/^omega\(rad\/s\)$/i.test(s))return'rad/s';if(/^F\(N\)$/i.test(s))return'N';if(/^F\(KG\)$/i.test(s))return'kgf';if(/^T\(N\.M\)$/i.test(s))return'N·m';if(/^PWM\(us\)$/i.test(s))return'μs';if(/^U\(V\)$/i.test(s))return'V';if(/^I\(A\)$/i.test(s))return'A';if(/power\(W\)|U×I\(W\)/i.test(s))return'W';if(/temperature\(C\)/i.test(s))return'°C';const m=s.match(/\(([^)]+)\)/);return m?m[1].replace(/N\.M/i,'N·m').replace(/RPM/i,'rpm').replace(/us/i,'μs'):'';
  }
  function guessName(col){const s=String(col||'');if(/^N\(RPM\)$/i.test(s))return'RPM';if(/^omega\(rad\/s\)$/i.test(s))return'Angular speed';if(/^F\(N\)|F\(KG\)$/i.test(s))return'Thrust';if(/^T\(N\.M\)$/i.test(s))return'Torque';if(/^PWM\(us\)$/i.test(s))return'PWM';if(/^U\(V\)$/i.test(s))return'Voltage';if(/^I\(A\)$/i.test(s))return'Current';if(/power/i.test(s)||/^U×I/i.test(s))return'Power';return s.replace(/\([^)]*\)/g,'').trim()||s;}
  function guessSymbol(col){const s=String(col||'');if(/^N\(RPM\)$/i.test(s))return'RPM';if(/^omega\(rad\/s\)$/i.test(s))return'\\omega';if(/^F\(N\)|F\(KG\)$/i.test(s))return'T';if(/^T\(N\.M\)$/i.test(s))return'Q';if(/^PWM\(us\)$/i.test(s))return'PWM';if(/^U\(V\)$/i.test(s))return'V';if(/^I\(A\)$/i.test(s))return'I';return'x';}
  function axisTitle(name,unit,col){const n=(name||col||'').trim();return unit?`${n} [${unit}]`:n;}
  function coefficientUnit(job,term){const y=job.yUnit.trim(),x=job.xUnit.trim(),p=Number(term.power);if(!y)return'—';if(Math.abs(p)<1e-12)return y;if(!x)return y;if(Math.abs(p-1)<1e-12)return`${y} / ${x}`;return`${y} / ${x}^${formatNumber(p,4)}`;}
  function safeTexSymbol(value,fallback='x'){
    const s=String(value||fallback).trim();if(!s)return fallback;if(s==='ω')return'\\omega';if(s==='Ω')return'\\Omega';if(/^\\[A-Za-z]+$/.test(s))return s;if(/^[A-Za-z]$/.test(s))return s;if(/^[A-Za-z0-9]+$/.test(s))return`\\mathrm{${s}}`;if(/^[A-Za-z0-9_{}\\]+$/.test(s))return s;return fallback;
  }
  function safeCoeffTex(value,fallback='a'){const s=String(value||fallback).trim();return /^[A-Za-z0-9_{}\\]+$/.test(s)?s:fallback;}
  function termLatex(job,term,coefficient=null){
    const x=safeTexSymbol(job.xSymbol,'x'),p=Number(term.power);let coeff;
    if(coefficient===null)coeff=safeCoeffTex(term.coeff,'a');else coeff=String(formatNumber(Math.abs(coefficient),10));
    if(Math.abs(p)<1e-12)return coeff;if(Math.abs(p-1)<1e-12)return`${coeff}\,${x}`;return`${coeff}\,${x}^{${formatNumber(p,6)}}`;
  }
  function formulaLatex(job,coefficients=null){
    const y=safeTexSymbol(job.ySymbol,'y'),active=job.terms.map((t,i)=>({t,i,c:coefficients?coefficients[i]:null})).filter(o=>o.t.enabled);
    if(!active.length)return`${y}=0`;
    if(!coefficients)return`${y} = ${active.map(o=>termLatex(job,o.t,null)).join(' + ')}`;
    let rhs='';active.forEach((o,idx)=>{const c=o.c||0,term=termLatex(job,o.t,c);if(idx===0)rhs=(c<0?'-':'')+term;else rhs+=c<0?` - ${term}`:` + ${term}`;});return`${y} = ${rhs||'0'}`;
  }
  function formulaPlain(job,coefficients=null){
    const y=job.ySymbol||'y',x=job.xSymbol||'x',active=job.terms.map((t,i)=>({t,i,c:coefficients?coefficients[i]:null})).filter(o=>o.t.enabled);if(!active.length)return`${y} = 0`;
    if(!coefficients)return`${y} = `+active.map(o=>`${o.t.coeff}${Number(o.t.power)===0?'':Number(o.t.power)===1?`·${x}`:`·${x}^${formatNumber(Number(o.t.power),6)}`}`).join(' + ');
    return`${y} = `+active.map((o,idx)=>{const c=o.c||0,mag=formatNumber(Math.abs(c),10),core=Number(o.t.power)===0?mag:Number(o.t.power)===1?`${mag}·${x}`:`${mag}·${x}^${formatNumber(Number(o.t.power),6)}`;return idx===0?(c<0?'-':'')+core:(c<0?' - ':' + ')+core;}).join('');
  }
  function renderLatex(node,latex,display=true){if(!node)return;try{if(window.katex)katex.render(latex,node,{throwOnError:false,displayMode:display});else node.textContent=latex;}catch(_){node.textContent=latex;}}

  function newJobFromPreset(ds,preset,overrides={}){
    const xCol=overrides.xCol||findColumn(ds.headers,preset.x)||ds.headers.find(h=>h!=='__source_file')||'',yCol=overrides.yCol||findColumn(ds.headers,preset.y)||ds.headers.find(h=>h!==xCol&&h!=='__source_file')||'';
    const xMeta={...preset.xMeta},yMeta={...preset.yMeta};
    if(preset.id==='custom'){xMeta.name=guessName(xCol);xMeta.symbol=guessSymbol(xCol);xMeta.unit=guessUnit(xCol);yMeta.name=guessName(yCol);yMeta.symbol=guessSymbol(yCol)==='x'?'y':guessSymbol(yCol);yMeta.unit=guessUnit(yCol);}
    return {id:uid('job'),name:overrides.name||preset.label,datasetId:ds.id,presetId:preset.id,xCol,yCol,xName:overrides.xName??xMeta.name,xSymbol:overrides.xSymbol??xMeta.symbol,xUnit:overrides.xUnit??xMeta.unit,yName:overrides.yName??yMeta.name,ySymbol:overrides.ySymbol??yMeta.symbol,yUnit:overrides.yUnit??yMeta.unit,terms:overrides.terms?overrides.terms.map(t=>({...t,id:uid('term')})):cloneTerms(preset.terms),minX:overrides.minX??'',maxX:overrides.maxX??''};
  }
  function addJob(overrides={}){if(!state.datasets.length)return;const ds=state.datasets.find(d=>d.id===overrides.datasetId)||state.datasets[0],preset=PRESETS.find(p=>p.id===(overrides.presetId||'custom'))||PRESETS[0];const job=newJobFromPreset(ds,preset,overrides);state.jobs.push(job);renderJobs();updateRunButtons();}

  function populateColumns(card,job){const ds=state.datasets.find(d=>d.id===job.datasetId)||state.datasets[0],opts=ds.headers.map(h=>`<option value="${escapeHtml(h)}">${escapeHtml(h)}</option>`).join('');const x=card.querySelector('.job-x'),y=card.querySelector('.job-y');x.innerHTML=opts;y.innerHTML=opts;if(ds.headers.includes(job.xCol))x.value=job.xCol;if(ds.headers.includes(job.yCol))y.value=job.yCol;}
  function renderTermRows(card,job){
    const list=card.querySelector('.term-list');list.innerHTML=job.terms.map((t,i)=>`<div class="term-row ${t.enabled?'':'is-off'}" data-term-id="${escapeHtml(t.id)}">
      <div class="term-toggle-wrap"><label class="term-toggle"><input class="term-enabled" type="checkbox" ${t.enabled?'checked':''}><span>${t.enabled?'拟合':'固定 0'}</span></label></div>
      <label class="field"><span>系数 / Coefficient</span><input class="term-coeff" value="${escapeHtml(t.coeff)}"></label>
      <div class="term-core term-core-${i}">—</div>
      <label class="field"><span>幂次 / Power</span><input class="term-power" type="number" step="any" value="${escapeHtml(t.power)}"></label>
      <button class="icon-btn delete-term" type="button" title="删除这一项">×</button>
      <div class="term-unit" style="grid-column:2/5">系数单位：${escapeHtml(coefficientUnit(job,t))}</div>
    </div>`).join('');
    job.terms.forEach((t,i)=>{const core=list.querySelector(`.term-core-${i}`);const x=safeTexSymbol(job.xSymbol,'x'),p=Number(t.power);renderLatex(core,Math.abs(p)<1e-12?'1':Math.abs(p-1)<1e-12?x:`${x}^{${formatNumber(p,6)}}`,false);});
  }
  function renderJobs(){
    if(!state.datasets.length){el.jobs.className='jobs empty-state';el.jobs.innerHTML='<div>载入数据后即可创建拟合任务。</div>';return;}if(!state.jobs.length){el.jobs.className='jobs empty-state';el.jobs.innerHTML='<div>点击“添加任务”开始配置。</div>';return;}
    el.jobs.className='jobs';el.jobs.innerHTML='';
    state.jobs.forEach(job=>{const frag=el.jobTemplate.content.cloneNode(true),card=frag.querySelector('.job-card');card.dataset.jobId=job.id;card.querySelector('.job-name').value=job.name;const dsSel=card.querySelector('.job-dataset');dsSel.innerHTML=state.datasets.map(d=>`<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`).join('');dsSel.value=job.datasetId;const pSel=card.querySelector('.job-preset');pSel.innerHTML=PRESETS.map(p=>`<option value="${p.id}">${escapeHtml(p.label)}</option>`).join('');pSel.value=job.presetId;populateColumns(card,job);
      [['x-name',job.xName],['x-symbol',job.xSymbol],['x-unit',job.xUnit],['y-name',job.yName],['y-symbol',job.ySymbol],['y-unit',job.yUnit]].forEach(([k,v])=>card.querySelector(`.job-${k}`).value=v);card.querySelector('.job-min-x').value=job.minX;card.querySelector('.job-max-x').value=job.maxX;renderTermRows(card,job);wireJobCard(card);el.jobs.appendChild(frag);refreshJobCard(el.jobs.querySelector(`[data-job-id="${CSS.escape(job.id)}"]`));});
  }
  function syncTerms(card,job){job.terms=Array.from(card.querySelectorAll('.term-row')).map(row=>{const old=job.terms.find(t=>t.id===row.dataset.termId)||{id:row.dataset.termId};return{...old,id:row.dataset.termId,enabled:row.querySelector('.term-enabled').checked,coeff:row.querySelector('.term-coeff').value.trim()||'a',power:Number(row.querySelector('.term-power').value)};});}
  function syncJob(card){const job=state.jobs.find(j=>j.id===card.dataset.jobId);if(!job)return null;job.name=card.querySelector('.job-name').value.trim()||'Fit';job.datasetId=card.querySelector('.job-dataset').value;job.presetId=card.querySelector('.job-preset').value;job.xCol=card.querySelector('.job-x').value;job.yCol=card.querySelector('.job-y').value;job.xName=card.querySelector('.job-x-name').value.trim();job.xSymbol=card.querySelector('.job-x-symbol').value.trim();job.xUnit=card.querySelector('.job-x-unit').value.trim();job.yName=card.querySelector('.job-y-name').value.trim();job.ySymbol=card.querySelector('.job-y-symbol').value.trim();job.yUnit=card.querySelector('.job-y-unit').value.trim();job.minX=card.querySelector('.job-min-x').value;job.maxX=card.querySelector('.job-max-x').value;syncTerms(card,job);return job;}
  function validateJob(job){const ds=state.datasets.find(d=>d.id===job.datasetId);if(!ds)throw new Error('数据集不存在');if(!job.xCol||!job.yCol||job.xCol===job.yCol)throw new Error('请选择不同的 X / Y 数据列');const active=job.terms.filter(t=>t.enabled);if(!active.length)throw new Error('至少启用一个模型项');if(active.some(t=>!Number.isFinite(Number(t.power))))throw new Error('幂次必须是数字');const powers=active.map(t=>Number(t.power));if(new Set(powers.map(p=>p.toPrecision(12))).size!==powers.length)throw new Error('启用的模型项不能有重复幂次');if(job.terms.length>MAX_TERMS)throw new Error(`最多 ${MAX_TERMS} 项`);return{ds,active};}
  function refreshJobCard(card){if(!card)return;const job=syncJob(card);if(!job)return;card.querySelector('.job-direction').textContent=`${axisTitle(job.yName,job.yUnit,job.yCol)}  vs  ${axisTitle(job.xName,job.xUnit,job.xCol)}`;card.querySelector('.job-x-preview').textContent=`横轴：${axisTitle(job.xName,job.xUnit,job.xCol)}`;card.querySelector('.job-y-preview').textContent=`纵轴：${axisTitle(job.yName,job.yUnit,job.yCol)}`;renderLatex(card.querySelector('.formula-preview'),formulaLatex(job),true);
    card.querySelectorAll('.term-row').forEach(row=>{const t=job.terms.find(x=>x.id===row.dataset.termId);if(!t)return;row.classList.toggle('is-off',!t.enabled);row.querySelector('.term-toggle span').textContent=t.enabled?'拟合':'固定 0';row.querySelector('.term-unit').textContent=`系数单位：${coefficientUnit(job,t)}`;const p=Number(t.power),x=safeTexSymbol(job.xSymbol,'x');renderLatex(row.querySelector('.term-core'),Math.abs(p)<1e-12?'1':Math.abs(p-1)<1e-12?x:`${x}^{${formatNumber(p,6)}}`,false);});
    const node=card.querySelector('.job-validity');try{const{ds,active}=validateJob(job);node.textContent=`${ds.rows.length} 行 · ${active.length} 个待估系数`;node.className='job-validity success-text';}catch(err){node.textContent=err.message;node.className='job-validity error-text';}}
  function resetAxisFromColumn(card,axis){const col=card.querySelector(`.job-${axis}`).value;card.querySelector(`.job-${axis}-name`).value=guessName(col);card.querySelector(`.job-${axis}-symbol`).value=guessSymbol(col)==='x'&&axis==='y'?'y':guessSymbol(col);card.querySelector(`.job-${axis}-unit`).value=guessUnit(col);}
  function applyPreset(card){const job=syncJob(card),ds=state.datasets.find(d=>d.id===job.datasetId),preset=PRESETS.find(p=>p.id===card.querySelector('.job-preset').value)||PRESETS[0];if(!ds)return;const x=findColumn(ds.headers,preset.x),y=findColumn(ds.headers,preset.y);if(x)card.querySelector('.job-x').value=x;if(y)card.querySelector('.job-y').value=y;card.querySelector('.job-name').value=preset.label;card.querySelector('.job-x-name').value=preset.xMeta.name;card.querySelector('.job-x-symbol').value=preset.xMeta.symbol;card.querySelector('.job-x-unit').value=preset.xMeta.unit||guessUnit(card.querySelector('.job-x').value);card.querySelector('.job-y-name').value=preset.yMeta.name;card.querySelector('.job-y-symbol').value=preset.yMeta.symbol;card.querySelector('.job-y-unit').value=preset.yMeta.unit||guessUnit(card.querySelector('.job-y').value);job.terms=cloneTerms(preset.terms);renderTermRows(card,job);wireTermEvents(card);syncJob(card);refreshJobCard(card);}
  function wireTermEvents(card){card.querySelectorAll('.term-row').forEach(row=>{row.querySelectorAll('input').forEach(n=>n.addEventListener('input',()=>refreshJobCard(card)));row.querySelector('.delete-term').addEventListener('click',()=>{const job=syncJob(card);if(job.terms.length<=1)return;job.terms=job.terms.filter(t=>t.id!==row.dataset.termId);renderTermRows(card,job);wireTermEvents(card);refreshJobCard(card);});});}
  function wireJobCard(card){
    card.querySelector('.job-dataset').addEventListener('change',()=>{const job=syncJob(card),ds=state.datasets.find(d=>d.id===job.datasetId);if(!ds)return;job.xCol=ds.headers.find(h=>h!=='__source_file')||'';job.yCol=ds.headers.find(h=>h!==job.xCol&&h!=='__source_file')||'';populateColumns(card,job);applyPreset(card);});
    card.querySelector('.job-preset').addEventListener('change',()=>applyPreset(card));
    card.querySelector('.job-x').addEventListener('change',()=>{resetAxisFromColumn(card,'x');refreshJobCard(card);});card.querySelector('.job-y').addEventListener('change',()=>{resetAxisFromColumn(card,'y');refreshJobCard(card);});
    card.querySelectorAll('.job-name,.job-x-name,.job-x-symbol,.job-x-unit,.job-y-name,.job-y-symbol,.job-y-unit,.job-min-x,.job-max-x').forEach(n=>n.addEventListener('input',()=>refreshJobCard(card)));
    card.querySelector('.add-term').addEventListener('click',()=>{const job=syncJob(card);if(job.terms.length>=MAX_TERMS)return;const powers=job.terms.map(t=>Number(t.power)).filter(Number.isFinite),next=powers.length?Math.max(...powers)+1:1;job.terms.push({id:uid('term'),power:next,coeff:`a_${formatNumber(next,3)}`,enabled:true});renderTermRows(card,job);wireTermEvents(card);refreshJobCard(card);});
    card.querySelector('.remove-job').addEventListener('click',()=>{state.jobs=state.jobs.filter(j=>j.id!==card.dataset.jobId);state.results.delete(card.dataset.jobId);renderJobs();renderResults();updateRunButtons();});
    card.querySelector('.duplicate-job').addEventListener('click',()=>{const j=syncJob(card);addJob({...j,id:undefined,name:`${j.name} copy`,terms:j.terms.map(t=>({...t}))});});
    card.querySelector('.run-one').addEventListener('click',()=>runOne(syncJob(card)));wireTermEvents(card);
  }

  function powValid(x,p){if(x===0&&p<0)return false;if(x<0&&Math.abs(p-Math.round(p))>1e-10)return false;return Number.isFinite(Math.pow(x,p));}
  function extractPoints(job){const{ds,active}=validateJob(job),powers=active.map(t=>Number(t.power)),pts=[];let skipped=0;const min=job.minX===''?null:Number(job.minX),max=job.maxX===''?null:Number(job.maxX);for(const row of ds.rows){const x=toNumber(row[job.xCol]),y=toNumber(row[job.yCol]);if(!Number.isFinite(x)||!Number.isFinite(y)||(min!==null&&x<min)||(max!==null&&x>max)||powers.some(p=>!powValid(x,p))){skipped++;continue;}pts.push([x,y]);}if(pts.length<=active.length)throw new Error(`有效数据 ${pts.length} 行，不足以拟合 ${active.length} 个系数`);return{ds,active,powers,pts,skipped};}
  function fitPowerBasis(xs,ys,powers){const n=xs.length,m=powers.length,A=Array.from({length:n},()=>Array(m).fill(0)),scales=Array(m).fill(1);for(let j=0;j<m;j++){let ss=0;for(let i=0;i<n;i++){const v=Math.pow(xs[i],powers[j]);A[i][j]=v;ss+=v*v;}scales[j]=Math.sqrt(ss/n)||1;for(let i=0;i<n;i++)A[i][j]/=scales[j];}const Q=Array.from({length:n},()=>Array(m).fill(0)),R=Array.from({length:m},()=>Array(m).fill(0));for(let j=0;j<m;j++){let v=A.map(r=>r[j]);for(let pass=0;pass<2;pass++)for(let k=0;k<j;k++){let dot=0;for(let i=0;i<n;i++)dot+=Q[i][k]*v[i];R[k][j]+=dot;for(let i=0;i<n;i++)v[i]-=dot*Q[i][k];}const norm=Math.hypot(...v);if(norm<1e-12)throw new Error('模型项近似线性相关，请减少模型项或调整数据范围');R[j][j]=norm;for(let i=0;i<n;i++)Q[i][j]=v[i]/norm;}const qty=Array(m).fill(0);for(let j=0;j<m;j++)for(let i=0;i<n;i++)qty[j]+=Q[i][j]*ys[i];const beta=Array(m).fill(0);for(let i=m-1;i>=0;i--){let s=qty[i];for(let j=i+1;j<m;j++)s-=R[i][j]*beta[j];beta[i]=s/R[i][i];}return beta.map((b,j)=>b/scales[j]);}
  function predictValue(x,terms,coeffs){return terms.reduce((s,t,i)=>s+(t.enabled?coeffs[i]*Math.pow(x,Number(t.power)):0),0);}
  function calcMetrics(ys,yhat,p){const n=ys.length,mean=ys.reduce((a,b)=>a+b,0)/n;let sse=0,sst=0,sae=0,max=0;for(let i=0;i<n;i++){const e=ys[i]-yhat[i];sse+=e*e;sae+=Math.abs(e);max=Math.max(max,Math.abs(e));sst+=(ys[i]-mean)**2;}const r2=sst>0?1-sse/sst:(sse===0?1:NaN);return{n,r2,adjR2:Number.isFinite(r2)&&n>p+1?1-(1-r2)*(n-1)/(n-p-1):NaN,rmse:Math.sqrt(sse/n),mae:sae/n,maxAbsError:max,sse};}
  function runJob(job){const{ds,active,powers,pts,skipped}=extractPoints(job),xs=pts.map(p=>p[0]),ys=pts.map(p=>p[1]),activeCoeffs=fitPowerBasis(xs,ys,powers);let k=0;const coeffs=job.terms.map(t=>t.enabled?activeCoeffs[k++]:0),yhat=xs.map(x=>predictValue(x,job.terms,coeffs)),residuals=ys.map((y,i)=>y-yhat[i]);return{ok:true,jobId:job.id,name:job.name,datasetName:ds.name,xCol:job.xCol,yCol:job.yCol,xName:job.xName,xSymbol:job.xSymbol,xUnit:job.xUnit,yName:job.yName,ySymbol:job.ySymbol,yUnit:job.yUnit,terms:job.terms.map(t=>({...t})),coefficients:coeffs,xs,ys,yhat,residuals,skipped,metrics:calcMetrics(ys,yhat,active.length)};}
  function runOne(job){try{state.results.set(job.id,runJob(job));setStatus(el.resultStatus,`完成 / Done: ${job.name}`,'success');}catch(err){state.results.set(job.id,{ok:false,jobId:job.id,name:job.name,error:err.message});setStatus(el.resultStatus,`${job.name}: ${err.message}`,'error');}renderResults();updateRunButtons();}
  function runAll(){document.querySelectorAll('.job-card').forEach(syncJob);let ok=0;for(const job of state.jobs){try{state.results.set(job.id,runJob(job));ok++;}catch(err){state.results.set(job.id,{ok:false,jobId:job.id,name:job.name,error:err.message});}}renderResults();setStatus(el.resultStatus,`完成 ${ok}/${state.jobs.length} 个拟合任务。`,ok?'success':'error');updateRunButtons();}
  function formatNumber(v,d=8){if(!Number.isFinite(v))return'—';const a=Math.abs(v);if((a!==0&&a<1e-4)||a>=1e6)return v.toExponential(Math.min(d,10));return Number(v.toFixed(d)).toString();}

  function resultCardHtml(r){if(!r.ok)return`<article class="result-card"><div class="result-error"><strong>${escapeHtml(r.name)}</strong><div>${escapeHtml(r.error)}</div></div></article>`;const m=r.metrics,jobLike=r;return`<article class="result-card"><div class="result-head"><div><h3>${escapeHtml(r.name)}</h3><div class="result-sub">${escapeHtml(r.datasetName)} · ${escapeHtml(axisTitle(r.yName,r.yUnit,r.yCol))} vs ${escapeHtml(axisTitle(r.xName,r.xUnit,r.xCol))} · N=${m.n}</div></div></div><div class="result-formula" id="formula-${escapeHtml(r.jobId)}"></div><div class="metric-grid">${[['R²',m.r2],['Adj R²',m.adjR2],['RMSE',m.rmse],['MAE',m.mae],['Max |e|',m.maxAbsError],['Skipped',r.skipped]].map(([k,v])=>`<div class="metric"><span>${escapeHtml(k)}</span><strong>${escapeHtml(typeof v==='number'?formatNumber(v,7):v)}</strong></div>`).join('')}</div><div class="coeff-wrap"><table class="coeff-table"><thead><tr><th>项 / Term</th><th>状态</th><th>系数 / Coefficient</th><th>单位 / Unit</th></tr></thead><tbody>${r.terms.map((t,i)=>`<tr class="${t.enabled?'':'fixed-zero'}"><td>${escapeHtml(t.coeff)} · ${escapeHtml(r.xSymbol||'x')}^${escapeHtml(formatNumber(Number(t.power),5))}</td><td>${t.enabled?'拟合':'固定 0'}</td><td>${escapeHtml(formatNumber(r.coefficients[i],11))}</td><td>${escapeHtml(coefficientUnit(jobLike,t))}</td></tr>`).join('')}</tbody></table></div><div class="charts"><div class="plot fit-plot" id="fit-${escapeHtml(r.jobId)}"></div><div class="plot residual-plot" id="residual-${escapeHtml(r.jobId)}"></div></div></article>`;}
  function buildCurve(r,count=240){const min=Math.min(...r.xs),max=Math.max(...r.xs);if(min===max)return{x:[min],y:[predictValue(min,r.terms,r.coefficients)]};const x=[],y=[];for(let i=0;i<count;i++){const xv=min+(max-min)*i/(count-1),yv=predictValue(xv,r.terms,r.coefficients);if(Number.isFinite(yv)){x.push(xv);y.push(yv);}}return{x,y};}
  function plotResult(r){const c=buildCurve(r),xTitle=axisTitle(r.xName,r.xUnit,r.xCol),yTitle=axisTitle(r.yName,r.yUnit,r.yCol),layout={margin:{l:68,r:22,t:45,b:62},paper_bgcolor:'#fff',plot_bgcolor:'#fff',font:{family:'Inter,system-ui,sans-serif',size:12},showlegend:true,legend:{orientation:'h',x:0,y:1.13},xaxis:{title:xTitle,gridcolor:'#e8edf3'},yaxis:{title:yTitle,gridcolor:'#e8edf3'}};Plotly.newPlot(`fit-${r.jobId}`,[{x:r.xs,y:r.ys,mode:'markers',type:'scatter',name:'Measured',marker:{size:6,opacity:.65}},{x:c.x,y:c.y,mode:'lines',type:'scatter',name:'Fit',line:{width:3}}],{...layout,title:{text:`${yTitle} vs ${xTitle}`,x:.02,xanchor:'left',font:{size:14}}},{responsive:true,displaylogo:false});Plotly.newPlot(`residual-${r.jobId}`,[{x:r.xs,y:r.residuals,mode:'markers',type:'scatter',name:'Residual',marker:{size:6,opacity:.7}}],{...layout,title:{text:'Residuals',x:.02,xanchor:'left',font:{size:14}},yaxis:{title:`Residual [${r.yUnit||'Y'}]`,gridcolor:'#e8edf3',zerolinecolor:'#94a3b8',zerolinewidth:1.5},shapes:[{type:'line',x0:Math.min(...r.xs),x1:Math.max(...r.xs),y0:0,y1:0,line:{width:1,dash:'dash'}}]},{responsive:true,displaylogo:false});}
  function renderResults(){const ordered=state.jobs.map(j=>state.results.get(j.id)).filter(Boolean);if(!ordered.length){el.results.innerHTML='';el.exportJsonBtn.disabled=true;el.exportPdfBtn.disabled=true;return;}el.results.innerHTML=ordered.map(resultCardHtml).join('');ordered.filter(r=>r.ok).forEach(r=>{renderLatex(document.getElementById(`formula-${r.jobId}`),formulaLatex(r,r.coefficients),true);plotResult(r);});const success=ordered.some(r=>r.ok);el.exportJsonBtn.disabled=!success;el.exportPdfBtn.disabled=!success;}
  function updateRunButtons(){el.runAllBtn.disabled=!state.datasets.length||!state.jobs.length;const success=[...state.results.values()].some(r=>r.ok);el.exportJsonBtn.disabled=!success;el.exportPdfBtn.disabled=!success;}
  function slugify(t){return String(t||'fit-report').trim().replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'')||'fit-report';}
  function downloadBlob(content,type,filename){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function exportJson(){const fits=state.jobs.map(j=>state.results.get(j.id)).filter(r=>r?.ok).map(r=>({name:r.name,dataset:r.datasetName,x:{column:r.xCol,name:r.xName,symbol:r.xSymbol,unit:r.xUnit},y:{column:r.yCol,name:r.yName,symbol:r.ySymbol,unit:r.yUnit},terms:r.terms.map((t,i)=>({...t,coefficient:r.coefficients[i],unit:coefficientUnit(r,t)})),equation:formulaPlain(r,r.coefficients),metrics:r.metrics,skippedRows:r.skipped}));downloadBlob(JSON.stringify({generatedAt:new Date().toISOString(),source:state.sourceLabel,title:el.reportTitle.value.trim(),notes:el.reportNotes.value.trim(),fits},null,2),'application/json',`${slugify(el.reportTitle.value)}.json`);}
  function katexHtml(latex){try{return window.katex?katex.renderToString(latex,{throwOnError:false,displayMode:true}):escapeHtml(latex);}catch(_){return escapeHtml(latex);}}
  function reportPageHtml(r,fitImage,residualImage){return`<div style="font-family:Inter,'PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#172033;background:white;width:794px;padding:34px 38px;box-sizing:border-box;"><div style="font-size:11px;letter-spacing:.12em;color:#667085;font-weight:700;">UAV PROPULSION FIT LAB</div><h1 style="font-size:25px;margin:7px 0 2px;">${escapeHtml(r.name)}</h1><div style="font-size:11px;color:#667085;margin-bottom:12px;">${escapeHtml(r.datasetName)} · ${escapeHtml(axisTitle(r.yName,r.yUnit,r.yCol))} vs ${escapeHtml(axisTitle(r.xName,r.xUnit,r.xCol))} · N=${r.metrics.n}</div><div style="padding:11px;border:1px solid #e4e9ef;border-radius:8px;text-align:center;">${katexHtml(formulaLatex(r,r.coefficients))}</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px;margin:12px 0;">${[['R²',formatNumber(r.metrics.r2,7)],['Adj R²',formatNumber(r.metrics.adjR2,7)],['RMSE',formatNumber(r.metrics.rmse,7)],['MAE',formatNumber(r.metrics.mae,7)],['Max |e|',formatNumber(r.metrics.maxAbsError,7)],['Skipped',r.skipped]].map(([k,v])=>`<div style="border:1px solid #d8e0ea;border-radius:7px;padding:7px;"><div style="font-size:9px;color:#667085;font-weight:700;">${k}</div><div style="font-size:12px;font-weight:700;">${v}</div></div>`).join('')}</div><table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:10px"><thead><tr><th style="padding:5px;border-bottom:1px solid #bcc9d8">Term</th><th style="padding:5px;border-bottom:1px solid #bcc9d8">Coefficient</th><th style="padding:5px;border-bottom:1px solid #bcc9d8">Unit</th></tr></thead><tbody>${r.terms.map((t,i)=>`<tr><td style="padding:5px;border-bottom:1px solid #e8edf3;">${escapeHtml(t.coeff)} · x^${formatNumber(Number(t.power),5)}${t.enabled?'':' (fixed 0)'}</td><td style="padding:5px;border-bottom:1px solid #e8edf3;">${formatNumber(r.coefficients[i],11)}</td><td style="padding:5px;border-bottom:1px solid #e8edf3;">${escapeHtml(coefficientUnit(r,t))}</td></tr>`).join('')}</tbody></table><img src="${fitImage}" style="display:block;width:100%;border:1px solid #e5eaf0;border-radius:8px;"/><img src="${residualImage}" style="display:block;width:100%;margin-top:10px;border:1px solid #e5eaf0;border-radius:8px;"/></div>`;}
  async function elementToPdfPage(doc,html,isFirst){const host=document.createElement('div');host.style.position='fixed';host.style.left='-10000px';host.style.top='0';host.innerHTML=html;document.body.appendChild(host);try{const canvas=await html2canvas(host.firstElementChild,{scale:2,backgroundColor:'#fff',useCORS:true,logging:false}),img=canvas.toDataURL('image/jpeg',.94),pw=doc.internal.pageSize.getWidth(),ph=doc.internal.pageSize.getHeight(),margin=8,ratio=Math.min((pw-margin*2)/canvas.width,(ph-margin*2)/canvas.height),w=canvas.width*ratio,h=canvas.height*ratio;if(!isFirst)doc.addPage();doc.addImage(img,'JPEG',(pw-w)/2,margin,w,h,undefined,'FAST');}finally{host.remove();}}
  async function exportPdf(){if(typeof html2canvas!=='function'||!window.jspdf?.jsPDF){setStatus(el.resultStatus,'PDF 依赖未加载，请刷新页面。','error');return;}const success=state.jobs.map(j=>state.results.get(j.id)).filter(r=>r?.ok);if(!success.length)return;el.exportPdfBtn.disabled=true;setStatus(el.resultStatus,`正在生成 PDF（${success.length} 个拟合）...`);try{const{jsPDF}=window.jspdf,doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4',compress:true}),cover=`<div style="font-family:Inter,'PingFang SC','Microsoft YaHei',Arial,sans-serif;color:#172033;background:white;width:794px;min-height:620px;padding:58px 54px;box-sizing:border-box;"><div style="font-size:12px;letter-spacing:.15em;color:#146fb3;font-weight:800;">MOTOR TESTS</div><h1 style="font-size:38px;line-height:1.1;margin:16px 0 12px;">${escapeHtml(el.reportTitle.value.trim()||'UAV Propulsion Fit Report')}</h1><p style="font-size:16px;color:#667085;margin:0 0 40px;">无人机动力系统拟合报告 / UAV propulsion fitting report</p><div style="border-top:1px solid #d8e0ea;padding-top:18px;font-size:13px;line-height:1.8;"><div><strong>Source:</strong> ${escapeHtml(state.sourceLabel||'—')}</div><div><strong>Generated:</strong> ${escapeHtml(new Date().toLocaleString())}</div><div><strong>Successful fits:</strong> ${success.length}</div><div><strong>Notes:</strong> ${escapeHtml(el.reportNotes.value.trim()||'—')}</div></div></div>`;await elementToPdfPage(doc,cover,true);for(const r of success){const fit=await Plotly.toImage(`fit-${r.jobId}`,{format:'png',width:1000,height:560,scale:1}),res=await Plotly.toImage(`residual-${r.jobId}`,{format:'png',width:1000,height:430,scale:1});await elementToPdfPage(doc,reportPageHtml(r,fit,res),false);}doc.save(`${slugify(el.reportTitle.value)}.pdf`);setStatus(el.resultStatus,`PDF 已生成：${success.length} 个拟合结果。`,'success');}catch(err){console.error(err);setStatus(el.resultStatus,`PDF 生成失败：${err.message}`,'error');}finally{el.exportPdfBtn.disabled=false;}}

  el.fileInput.addEventListener('change',e=>handleUpload(e.target.files?.[0]));el.previewDatasetSelect.addEventListener('change',renderPreview);el.addJobBtn.addEventListener('click',()=>addJob());el.runAllBtn.addEventListener('click',runAll);el.exportJsonBtn.addEventListener('click',exportJson);el.exportPdfBtn.addEventListener('click',exportPdf);
  ['dragenter','dragover'].forEach(t=>el.dropzone.addEventListener(t,e=>{e.preventDefault();el.dropzone.classList.add('is-dragging');}));['dragleave','drop'].forEach(t=>el.dropzone.addEventListener(t,e=>{e.preventDefault();el.dropzone.classList.remove('is-dragging');}));el.dropzone.addEventListener('drop',e=>handleUpload(e.dataTransfer?.files?.[0]));
  if(!window.JSZip||!window.Papa||!window.Plotly||!window.jspdf||!window.katex||typeof html2canvas!=='function')setStatus(el.loadStatus,'部分前端依赖未加载，请检查网络后刷新。 / Some dependencies failed to load.','error');
})();
