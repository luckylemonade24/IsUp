// scripts/render.js
const fs = require('fs');
const [,, listPath, reasonsPath, indexPath, outPath] = process.argv;
if (!outPath) { console.error('usage: render.js <list> <reasons> <index.html> <out>'); process.exit(1); }

const list = JSON.parse(fs.readFileSync(listPath, 'utf8'));
let reasons = {};
try { reasons = JSON.parse(fs.readFileSync(reasonsPath, 'utf8')); } catch (e) {}
let html = fs.readFileSync(indexPath, 'utf8');

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const OVERALL = {
  operational: ['All systems Operational', 'green'],
  someDown: ['Some systems down', 'orange'],
  allDown: ['All systems down', 'red'],
  pausedOverall: ['Some systems paused', 'gray']
};
const STATUS = {
  success: ['Up', 'green'],
  danger: ['Down', 'red'],
  notchecked: ['None', 'gray'],
  paused: ['Paused', 'gray']
};
const UPTIME_CLS = { excellent: 'green', good: 'green', fair: 'orange', poor: 'red' };
const STATE_CHAR = { excellent: '1', good: '2', fair: '3', poor: '4' };

// ---- 整体状态（单行） ----
const c = (list.statistics && list.statistics.counts) || {};
const total = c.total || 0, down = c.down || 0, up = c.up || 0;
const ovKey = up === total ? 'operational'
           : down === total ? 'allDown'
           : down === 0 ? 'pausedOverall'
           : 'someDown';
const [ovText, ovCls] = OVERALL[ovKey];
const ovSpan = ovText.replace(/\s(\S+)$/, ` <span class="${ovCls}">$1</span>`);
const overallHtml =
  `<div class="overall-status">` +
  `<div class="dot dot-lg ${ovCls}"><div class="core"></div><div class="ring"></div></div>` +
  `<span id="overallText">${ovSpan}</span>` +
  `</div>`;

// ---- 每个 monitor（单行；紧凑 data-bars） ----
const rowsHtml = (list.data || []).map(m => {
  const st = STATUS[m.statusClass] || STATUS.paused;
  const ratio = m['90dRatio'] || {};
  const uptimeCls = UPTIME_CLS[ratio.label] || '';
  const mid = m.id || m.monitorId || '';
  const errCode = mid ? reasons[mid] : null;
  const name = errCode ? `${esc(m.name)}<span class="err">${esc(errCode)}</span>` : esc(m.name);

  let barsAttr = '';
  const daily = m.dailyRatios || [];
  if (daily.length > 0) {
    const lastDate = daily[daily.length - 1].date.replace(/-/g, '');
    const seq = daily.map(d => {
      const sc = STATE_CHAR[d.label] || '0';
      const r = String(d.ratio == null ? '' : d.ratio).replace('%', '');
      return sc + ':' + r;
    }).join(',');
    barsAttr = ` data-bars="${lastDate}|${seq}"`;
  }

  return `<div class="monitor-row" data-status="${esc(m.statusClass || '')}"${barsAttr}>` +
    `<span class="monitor-name">${name}</span>` +
    `<span class="monitor-uptime ${uptimeCls}">${esc(ratio.ratio != null ? ratio.ratio : '—')}%</span>` +
    `<div class="daily-bars"></div>` +
    `<div class="monitor-status ${st[1]}">` +
      `<div class="dot dot-sm ${st[1]}"><div class="core"></div><div class="ring"></div></div>` +
      `<span class="status-text">${esc(st[0])}</span>` +
    `</div></div>`;
}).join('') || '<div class="placeholder info">No monitors found</div>';

// ---- 替换 overall-card ----
html = html.replace(
  /<div class="overall-card card">[\s\S]*?(?=<div class="services-title")/,
  `<div class="overall-card card">${overallHtml}</div>`
);

// ---- 替换 monitorCard 内容 ----
html = html.replace(
  /(<div class="card" id="monitorCard">)[\s\S]*?(?=<\/div><div class="footer")/,
  `$1${rowsHtml}`
);

// ---- 替换 script：单行数组 join，零换行 ----
const newScript = '<script>' + [
  '(function(){',
  'var root=document.documentElement,card=document.getElementById("monitorCard");',
  'if(!card)return;',
  'var SM={"1":"green","2":"lightgreen","3":"orange","4":"red","0":""};',
  'var rb=Array.prototype.slice.call(card.querySelectorAll(".monitor-row")).map(function(row){',
    'var be=row.querySelector(".daily-bars"),bd=row.getAttribute("data-bars");',
    'if(!be||!bd)return null;',
    'var sep=bd.indexOf("|");if(sep<0)return null;',
    'var ld=bd.slice(0,sep),seqStr=bd.slice(sep+1);',
    'var y=+ld.slice(0,4),mo=+ld.slice(4,6)-1,dy=+ld.slice(6,8),last=new Date(y,mo,dy);',
    'var parts=seqStr.split(","),n=parts.length,bars=[];',
    'for(var i=0;i<n;i++){',
      'var p=parts[i].split(":"),sc=p[0]||"0",ratio=p[1]||"";',
      'var d=new Date(last);d.setDate(d.getDate()-(n-1-i));',
      'var b=document.createElement("div");',
      'b.className="daily-bar "+(SM[sc]||"");',
      'var yyyy=d.getFullYear(),mm=String(d.getMonth()+1),dd=String(d.getDate());',
      'if(mm.length<2)mm="0"+mm;if(dd.length<2)dd="0"+dd;',
      'b.setAttribute("data-date",yyyy+"-"+mm+"-"+dd);',
      'b.setAttribute("data-ratio",ratio+"%");',
      'bars.push(b);',
    '}',
    'return{barsEl:be,bars:bars};',
  '}).filter(Boolean);',
  'function layout(){',
    'var y=parseFloat(getComputedStyle(root).fontSize)||16;',
    'var w=Math.min(90,Math.max(30,(card.clientWidth-30*y)/(0.3125*y)|0));',
    'rb.forEach(function(o){',
      'o.barsEl.innerHTML="";',
      'var s=o.bars.slice(-w);',
      's.forEach(function(b,i){',
        'o.barsEl.appendChild(b);',
        'if(w<40&&i<s.length-1){var g=document.createElement("span");g.className="gap";o.barsEl.appendChild(g);}',
      '});',
    '});',
  '}',
  'layout();',
  'var rt;window.addEventListener("resize",function(){clearTimeout(rt);rt=setTimeout(layout,200);});',
  '})();',
  '</scr' + 'ipt>'
].join('');

html = html.replace(/<script>[\s\S]*?<\/script>/, newScript);

fs.writeFileSync(outPath, html);

// ---- 体积自检：插入前后的换行数对比 ----
const nl = (html.match(/\n/g) || []).length;
console.log('✅ 渲染完成: ' + (list.data || []).length + ' 个 monitor, 输出 ' + html.length + ' 字节, 换行数 ' + nl + ' → ' + outPath);