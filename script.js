/* ============================================================
   ホールデータ研究所 AI — メインスクリプト
   Vanilla JS / LocalStorage / ルールベース分析
   ============================================================ */

// ============================================================
// 定数
// ============================================================
const FREE_STORE_LIMIT  = 3;
const FREE_RECORD_LIMIT = 100;
const WEEKDAYS = ['日','月','火','水','木','金','土'];

const GRADE_LABELS = {
  S: 'かなり強めの傾向',
  A: '強めの傾向',
  B: '平均的な傾向',
  C: '弱めの傾向',
  D: 'データ不足 / 回収傾向'
};

// ============================================================
// LocalStorage 操作
// ============================================================
const DB = {
  /* ---- 店舗 ---- */
  getStores() {
    return JSON.parse(localStorage.getItem('hdr_stores') || '[]');
  },
  saveStores(arr) {
    localStorage.setItem('hdr_stores', JSON.stringify(arr));
  },
  addStore(name) {
    const stores = this.getStores();
    if (stores.length >= FREE_STORE_LIMIT)
      return { error: `無料版は${FREE_STORE_LIMIT}店舗まで登録できます。Premiumで無制限になります。` };
    if (stores.find(s => s.name === name))
      return { error: 'その店舗名はすでに登録されています' };
    const store = { id: uid(), name, createdAt: new Date().toISOString() };
    stores.push(store);
    this.saveStores(stores);
    return { store };
  },
  deleteStore(id) {
    this.saveStores(this.getStores().filter(s => s.id !== id));
    this.saveRecords(this.getRecords().filter(r => r.storeId !== id));
  },

  /* ---- データレコード ---- */
  getRecords() {
    return JSON.parse(localStorage.getItem('hdr_records') || '[]');
  },
  saveRecords(arr) {
    localStorage.setItem('hdr_records', JSON.stringify(arr));
  },
  addRecord(data) {
    const records = this.getRecords();
    if (records.length >= FREE_RECORD_LIMIT)
      return { error: `無料版は${FREE_RECORD_LIMIT}件まで保存できます。Premiumで無制限になります。` };
    const record = { id: uid(), ...data, createdAt: new Date().toISOString() };
    records.push(record);
    this.saveRecords(records);
    return { record };
  },
  deleteRecord(id) {
    this.saveRecords(this.getRecords().filter(r => r.id !== id));
  },
  getRecordsByStore(storeId) {
    return this.getRecords().filter(r => r.storeId === storeId);
  }
};

// ============================================================
// ユーティリティ
// ============================================================
let _uid = 0;
function uid() {
  let id = Date.now();
  if (id <= _uid) id = _uid + 1;
  _uid = id;
  return String(id);
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function getWeekday(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return WEEKDAYS[d.getDay()];
}

function formatDiff(v) {
  if (v == null || isNaN(v)) return '-';
  const n = Math.round(Number(v));
  return (n >= 0 ? '+' : '') + n.toLocaleString('ja-JP');
}

function avg(arr) {
  const valid = arr.filter(v => v != null && !isNaN(v));
  return valid.length ? valid.reduce((s, v) => s + Number(v), 0) / valid.length : null;
}

function showToast(msg, type = '') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3000);
}

function showModal(html) {
  document.getElementById('modal-content').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function toggleMoreMenu() {
  document.getElementById('more-menu').classList.toggle('hidden');
}

// ============================================================
// ルーター
// ============================================================
function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const el = document.getElementById(`page-${page}`);
  if (el) el.classList.add('active');

  const btn = document.querySelector(`.nav-btn[data-page="${page}"]`);
  if (btn) btn.classList.add('active');

  document.getElementById('more-menu').classList.add('hidden');

  switch (page) {
    case 'home':     initHome();     break;
    case 'stores':   initStores();   break;
    case 'input':    initInput();    break;
    case 'analysis': initAnalysis(); break;
    case 'calendar': initCalendar(); break;
  }

  window.scrollTo(0, 0);
}

// ============================================================
// ホームページ
// ============================================================
function initHome() {
  const stores  = DB.getStores();
  const records = DB.getRecords();
  const machines = [...new Set(records.map(r => r.machineName))];

  document.getElementById('home-store-count').textContent  = stores.length;
  document.getElementById('home-record-count').textContent = records.length;
  document.getElementById('home-machine-count').textContent = machines.length;

  const container = document.getElementById('home-top-stores');
  if (!stores.length) {
    container.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center;font-size:13px;">店舗を登録してデータを入力してください</div>';
    return;
  }

  const sorted = stores
    .map(s => ({ s, grade: calcGrade(DB.getRecordsByStore(s.id)), count: DB.getRecordsByStore(s.id).length }))
    .sort((a, b) => gradeNum(a.grade) - gradeNum(b.grade));

  container.innerHTML = sorted.map(({ s, grade, count }) => `
    <div class="store-highlight-item" onclick="goToAnalysis('${s.id}')">
      <div class="highlight-grade g${grade.toLowerCase()}">${grade}</div>
      <div style="flex:1">
        <div style="font-weight:600">${esc(s.name)}</div>
        <div style="font-size:12px;color:var(--text3)">${count}件のデータ</div>
      </div>
      <div style="color:var(--text3)">›</div>
    </div>
  `).join('');
}

function gradeNum(g) { return { S:0,A:1,B:2,C:3,D:4 }[g] ?? 5; }

function goToAnalysis(storeId) {
  navigateTo('analysis');
  const sel = document.getElementById('analysis-store-select');
  sel.value = storeId;
  loadAnalysis();
}

// ============================================================
// 店舗一覧
// ============================================================
function initStores() { renderStores(); }

function renderStores() {
  const stores  = DB.getStores();
  const records = DB.getRecords();
  const list  = document.getElementById('stores-list');
  const empty = document.getElementById('stores-empty');

  document.getElementById('store-limit-notice').textContent = `無料版：${stores.length} / ${FREE_STORE_LIMIT} 店舗`;

  if (!stores.length) {
    list.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  list.innerHTML = stores.map(s => {
    const cnt   = records.filter(r => r.storeId === s.id).length;
    const grade = calcGrade(DB.getRecordsByStore(s.id));
    return `
      <div class="store-card">
        <div class="store-icon">🏪</div>
        <div class="store-info">
          <div class="store-name">${esc(s.name)}</div>
          <div class="store-stats">${cnt}件 ／ 注目度: <strong>${grade}</strong></div>
        </div>
        <div class="store-actions">
          <button class="btn btn-sm btn-secondary" onclick="goToAnalysis('${s.id}')">分析</button>
          <button class="btn btn-sm btn-danger" onclick="confirmDeleteStore('${s.id}','${esc(s.name)}')">削除</button>
        </div>
      </div>
    `;
  }).join('');
}

function showAddStoreModal() {
  if (DB.getStores().length >= FREE_STORE_LIMIT) {
    showModal(`
      <div class="modal-title">店舗上限に達しました</div>
      <p style="color:var(--text2);font-size:14px;margin-bottom:16px">
        無料版は${FREE_STORE_LIMIT}店舗まで登録できます。<br>
        Premiumにアップグレードすると無制限に登録できます。
      </p>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="closeModal()">閉じる</button>
        <button class="btn btn-primary" onclick="navigateTo('premium');closeModal()">Premiumを見る</button>
      </div>
    `);
    return;
  }
  showModal(`
    <div class="modal-title">店舗を追加</div>
    <div class="form-group">
      <label>店舗名 *</label>
      <input type="text" id="new-store-name" placeholder="例：キング塩尻" style="margin-top:0">
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">キャンセル</button>
      <button class="btn btn-primary" onclick="doAddStore()">追加</button>
    </div>
  `);
  setTimeout(() => document.getElementById('new-store-name')?.focus(), 100);
}

function doAddStore() {
  const name = document.getElementById('new-store-name').value.trim();
  if (!name) { showToast('店舗名を入力してください', 'err'); return; }
  const res = DB.addStore(name);
  if (res.error) { showToast(res.error, 'err'); return; }
  closeModal();
  showToast(`「${name}」を追加しました`, 'ok');
  renderStores();
  initHome();
}

function confirmDeleteStore(id, name) {
  showModal(`
    <div class="modal-title">店舗を削除</div>
    <p style="color:var(--text2);font-size:14px;margin-bottom:16px">
      「${esc(name)}」を削除しますか？<br>
      <strong style="color:var(--red2)">この店舗のデータも全て削除されます。</strong>
    </p>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">キャンセル</button>
      <button class="btn btn-danger" onclick="doDeleteStore('${id}','${esc(name)}')">削除する</button>
    </div>
  `);
}

function doDeleteStore(id, name) {
  DB.deleteStore(id);
  closeModal();
  showToast(`「${name}」を削除しました`);
  renderStores();
  initHome();
}

// ============================================================
// データ入力
// ============================================================
function initInput() {
  const stores = DB.getStores();
  const sel    = document.getElementById('form-store');
  sel.innerHTML = '<option value="">選択してください</option>' +
    stores.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');

  const dateEl = document.getElementById('form-date');
  if (!dateEl.value) {
    dateEl.value = new Date().toISOString().slice(0, 10);
    updateWeekday();
  }

  const machines = [...new Set(DB.getRecords().map(r => r.machineName))];
  document.getElementById('machine-suggestions').innerHTML =
    machines.map(m => `<option value="${esc(m)}">`).join('');

  renderRecentRecords();
}

function updateWeekday() {
  const date = document.getElementById('form-date').value;
  document.getElementById('form-weekday').value = date ? getWeekday(date) + '曜日' : '';
}

function handleDataSubmit(e) {
  e.preventDefault();
  const storeId     = document.getElementById('form-store').value;
  const date        = document.getElementById('form-date').value;
  const machineName = document.getElementById('form-machine').value.trim();
  const machineType = document.querySelector('input[name="machine-type"]:checked').value;

  if (!storeId || !date || !machineName) {
    showToast('必須項目（店舗・日付・機種名）を入力してください', 'err');
    return;
  }

  const totalDiff = parseFloat(document.getElementById('form-total-diff').value);
  const avgDiff   = parseFloat(document.getElementById('form-avg-diff').value);
  const machineCount = parseInt(document.getElementById('form-count').value);
  const winRate   = parseFloat(document.getElementById('form-winrate').value);

  const data = {
    storeId,
    date,
    dayOfWeek:   getWeekday(date),
    machineName,
    machineType,
    machineCount: isNaN(machineCount) ? null : machineCount,
    totalDiff:   isNaN(totalDiff)   ? null : totalDiff,
    avgDiff:     isNaN(avgDiff)     ? null : avgDiff,
    winRate:     isNaN(winRate)     ? null : winRate,
    operationMemo: document.getElementById('form-operation-memo').value.trim(),
    eventMemo:     document.getElementById('form-event-memo').value.trim(),
    freeMemo:      document.getElementById('form-free-memo').value.trim()
  };

  const res = DB.addRecord(data);
  if (res.error) { showToast(res.error, 'err'); return; }

  showToast('データを保存しました', 'ok');
  ['form-machine','form-count','form-total-diff','form-avg-diff','form-winrate',
   'form-operation-memo','form-event-memo','form-free-memo'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  renderRecentRecords();
  initHome();
}

function renderRecentRecords() {
  const records = DB.getRecords();
  const stores  = DB.getStores();
  const storeMap = Object.fromEntries(stores.map(s => [s.id, s.name]));
  const recent  = [...records]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 10);

  const container = document.getElementById('recent-records');
  if (!recent.length) {
    container.innerHTML = '<div style="color:var(--text3);padding:20px;text-align:center;font-size:13px">まだデータがありません</div>';
    return;
  }

  container.innerHTML = recent.map(r => {
    const d    = r.avgDiff;
    const cls  = d == null ? '' : d > 0 ? 'pos' : d < 0 ? 'neg' : '';
    return `
      <div class="recent-item">
        <div class="recent-date">${r.date ? r.date.slice(5) : '-'}</div>
        <div class="recent-info">
          <div class="recent-machine">${esc(r.machineName)}</div>
          <div class="recent-store">${esc(storeMap[r.storeId] ?? '?')}</div>
        </div>
        <div class="recent-diff ${cls}">${d != null ? formatDiff(d) : '-'}</div>
        <button class="del-btn" onclick="deleteRecord('${r.id}')">✕</button>
      </div>
    `;
  }).join('');
}

function deleteRecord(id) {
  DB.deleteRecord(id);
  renderRecentRecords();
  initHome();
  showToast('削除しました');
}

// CSV インポートモーダル
function showCsvModal() {
  const storeOptions = DB.getStores()
    .map(s => `<option value="${s.id}">${esc(s.name)}</option>`)
    .join('');

  showModal(`
    <div class="modal-title">CSV貼り付けインポート</div>
    <div class="csv-hint">
      1行目はヘッダー（スキップ）。以下の順番でカンマ区切り：<br>
      <code>日付,機種名,種別,台数,総差枚,平均差枚,勝率,稼働メモ,イベントメモ,自由メモ</code><br>
      種別は「スロット」または「パチンコ」
    </div>
    <div class="form-group">
      <label>店舗</label>
      <select id="csv-store">${storeOptions}</select>
    </div>
    <textarea class="csv-textarea" id="csv-input" placeholder="2024-01-01,アイムジャグラー,スロット,50,5000,100,45,,,"></textarea>
    <div class="modal-actions">
      <button class="btn btn-secondary" onclick="closeModal()">キャンセル</button>
      <button class="btn btn-primary" onclick="doCsvImport()">インポート</button>
    </div>
  `);
}

function doCsvImport() {
  const storeId = document.getElementById('csv-store').value;
  const text    = document.getElementById('csv-input').value.trim();
  if (!storeId) { showToast('店舗を選択してください', 'err'); return; }
  if (!text)    { showToast('CSVデータを入力してください', 'err'); return; }

  const lines = text.split('\n').filter(l => l.trim());
  const start = lines[0].includes('日付') || lines[0].toLowerCase().includes('date') ? 1 : 0;
  let imported = 0, errors = 0;

  for (let i = start; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const date = cols[0]?.trim();
    const name = cols[1]?.trim();
    if (!date || !name) { errors++; continue; }

    const type = (cols[2]?.trim() === 'パチンコ') ? 'pachinko' : 'slot';
    const res  = DB.addRecord({
      storeId,
      date,
      dayOfWeek:     getWeekday(date),
      machineName:   name,
      machineType:   type,
      machineCount:  parseInt(cols[3]) || null,
      totalDiff:     parseFloat(cols[4]) || null,
      avgDiff:       parseFloat(cols[5]) || null,
      winRate:       parseFloat(cols[6]) || null,
      operationMemo: cols[7]?.trim() || '',
      eventMemo:     cols[8]?.trim() || '',
      freeMemo:      cols[9]?.trim() || ''
    });
    if (res.error) { errors++; break; }
    imported++;
  }

  closeModal();
  if (imported) {
    showToast(`${imported}件インポートしました${errors ? `（${errors}件エラー）` : ''}`, 'ok');
    renderRecentRecords();
    initHome();
  } else {
    showToast('インポートに失敗しました', 'err');
  }
}

// ============================================================
// 分析エンジン
// ============================================================
function calcGrade(records) {
  const valid = records.filter(r => r.avgDiff != null);
  if (valid.length < 3) return 'D';

  const a30 = periodAvg(valid, 30);
  const a7  = periodAvg(valid, 7);
  const all = avg(valid.map(r => r.avgDiff));
  const main = a30 ?? all;

  if (main == null) return 'D';
  if (main > 800)  return a7 != null && a7 < main * 0.6 ? 'A' : 'S';
  if (main > 200)  return 'A';
  if (main > -300) return 'B';
  if (main > -800) return 'C';
  return 'D';
}

function periodAvg(records, days) {
  const cutoff = new Date(Date.now() - days * 86400000);
  const filtered = records.filter(r => r.avgDiff != null && new Date(r.date + 'T00:00:00') >= cutoff);
  return avg(filtered.map(r => r.avgDiff));
}

function getConfidence(count) {
  if (count >= 20) return { label: '信頼度：高', cls: 'conf-high' };
  if (count >= 5)  return { label: '信頼度：中', cls: 'conf-mid' };
  return { label: '信頼度：低', cls: 'conf-low' };
}

function weekdayStats(records) {
  const map = Object.fromEntries(WEEKDAYS.map(d => [d, { sum: 0, cnt: 0 }]));
  records.filter(r => r.avgDiff != null).forEach(r => {
    const wd = r.dayOfWeek || getWeekday(r.date);
    if (map[wd]) { map[wd].sum += r.avgDiff; map[wd].cnt++; }
  });
  return WEEKDAYS.map(d => ({
    day: d,
    avg: map[d].cnt ? map[d].sum / map[d].cnt : null,
    cnt: map[d].cnt
  }));
}

function dateSuffixStats(records) {
  const groups = {
    '0のつく日': d => d % 10 === 0,
    '1のつく日': d => d % 10 === 1,
    '2のつく日': d => d % 10 === 2,
    '3のつく日': d => d % 10 === 3,
    '5のつく日': d => d % 10 === 5,
    '7のつく日': d => d % 10 === 7,
    'ゾロ目':   d => d === 11 || d === 22
  };
  return Object.entries(groups).map(([label, fn]) => {
    const matched = records.filter(r => r.avgDiff != null && r.date && fn(new Date(r.date + 'T00:00:00').getDate()));
    return { label, avg: avg(matched.map(r => r.avgDiff)), cnt: matched.length };
  });
}

function machineRanking(records) {
  const map = {};
  records.filter(r => r.avgDiff != null).forEach(r => {
    if (!map[r.machineName]) map[r.machineName] = { sum: 0, cnt: 0, type: r.machineType };
    map[r.machineName].sum += r.avgDiff;
    map[r.machineName].cnt++;
  });
  return Object.entries(map)
    .map(([name, v]) => ({ name, avg: v.sum / v.cnt, cnt: v.cnt, type: v.type }))
    .sort((a, b) => b.avg - a.avg);
}

function getTrend(records) {
  const valid = records.filter(r => r.avgDiff != null && r.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (valid.length < 4) return null;
  const half   = Math.floor(valid.length / 2);
  const first  = avg(valid.slice(0, half).map(r => r.avgDiff));
  const second = avg(valid.slice(half).map(r => r.avgDiff));
  if (first == null || second == null) return null;
  const pct = first !== 0 ? ((second - first) / Math.abs(first)) * 100 : 0;
  if (pct > 20)  return { label: '上昇傾向 ↑', cls: 'pos' };
  if (pct < -20) return { label: '下降傾向 ↓', cls: 'neg' };
  return { label: '横ばい →', cls: '' };
}

// ============================================================
// ルールベースAIコメント生成
// ============================================================
function generateComment(storeName, records) {
  const valid = records.filter(r => r.avgDiff != null);
  if (!valid.length) return 'データがまだ登録されていません。データを入力すると分析コメントが表示されます。';
  if (valid.length < 3) return 'データが少ないため詳細な傾向分析ができません。データを増やすことで精度が高まります。';

  const lines = [];
  const a30  = periodAvg(valid, 30);
  const a7   = periodAvg(valid, 7);
  const aAll = avg(valid.map(r => r.avgDiff));
  const main = a30 ?? aAll;

  // 全体傾向
  if (main > 800)
    lines.push(`この店舗は過去データの平均が約${Math.round(main).toLocaleString('ja-JP')}枚と、比較的プラス寄りの数値が記録されています。`);
  else if (main > 200)
    lines.push(`過去データの平均は約${Math.round(main).toLocaleString('ja-JP')}枚で、全体的にプラス傾向の日が多く見られます。`);
  else if (main > -300)
    lines.push(`過去データの平均は約${Math.round(main).toLocaleString('ja-JP')}枚と、ほぼ横ばいの水準です。`);
  else
    lines.push(`過去データの平均は約${Math.round(main).toLocaleString('ja-JP')}枚と、回収寄りの数値が続いています。`);

  // 直近傾向
  if (a7 != null && main != null) {
    const diff = a7 - main;
    if (diff > 200)
      lines.push(`直近7日は30日平均より約${Math.round(diff).toLocaleString('ja-JP')}枚高く、上昇傾向が見られます。`);
    else if (diff < -200)
      lines.push(`直近7日は30日平均より約${Math.round(Math.abs(diff)).toLocaleString('ja-JP')}枚低く、やや回収寄りに推移しています。`);
  }

  // 曜日傾向
  const wdStats = weekdayStats(valid);
  const bestWd  = [...wdStats].filter(d => d.cnt >= 2).sort((a, b) => b.avg - a.avg)[0];
  if (bestWd)
    lines.push(`曜日別では${bestWd.day}曜日（${bestWd.cnt}回）の平均が${formatDiff(Math.round(bestWd.avg))}枚と最も高い傾向があります。`);

  // 日付末尾傾向
  const sufStats = dateSuffixStats(valid);
  const bestSuf  = sufStats.filter(s => s.cnt >= 2 && s.avg != null).sort((a, b) => b.avg - a.avg)[0];
  if (bestSuf)
    lines.push(`日付では「${bestSuf.label}」（${bestSuf.cnt}件）が平均${formatDiff(Math.round(bestSuf.avg))}枚と高めの数値です。`);

  // 機種傾向
  const ranking = machineRanking(valid);
  if (ranking.length >= 2 && ranking[0].cnt >= 2)
    lines.push(`機種別では「${ranking[0].name}」が平均${formatDiff(Math.round(ranking[0].avg))}枚でトップです。`);

  if (ranking.length >= 2) {
    const slots     = valid.filter(r => r.machineType === 'slot');
    const pachinkos = valid.filter(r => r.machineType === 'pachinko');
    const sa = avg(slots.map(r => r.avgDiff));
    const pa = avg(pachinkos.map(r => r.avgDiff));
    if (sa != null && pa != null && Math.abs(sa - pa) > 100) {
      if (sa > pa)
        lines.push(`スロット（平均${formatDiff(Math.round(sa))}枚）の方がパチンコより高い傾向が見られます。`);
      else
        lines.push(`パチンコ（平均${formatDiff(Math.round(pa))}玉）の方がスロットより高い傾向が見られます。`);
    }
  }

  // サンプル数警告
  if (valid.length < 10)
    lines.push(`現在のサンプル数は${valid.length}件と少ないため信頼度は低めです。データを蓄積するとより精度が高まります。`);

  return lines.join('<br><br>');
}

// ============================================================
// 分析ページ
// ============================================================
let _selectedStore = '';

function initAnalysis() {
  const stores = DB.getStores();
  const sel    = document.getElementById('analysis-store-select');
  sel.innerHTML = '<option value="">店舗を選択してください</option>' +
    stores.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');

  if (_selectedStore) {
    sel.value = _selectedStore;
    loadAnalysis();
  }
}

function loadAnalysis() {
  const sel     = document.getElementById('analysis-store-select');
  const storeId = sel.value;
  const content = document.getElementById('analysis-content');
  const empty   = document.getElementById('analysis-empty');

  if (!storeId) {
    content.classList.add('hidden');
    empty.classList.remove('hidden');
    return;
  }

  _selectedStore = storeId;
  const store   = DB.getStores().find(s => s.id === storeId);
  const records = DB.getRecordsByStore(storeId);
  const valid   = records.filter(r => r.avgDiff != null);

  content.classList.remove('hidden');
  empty.classList.add('hidden');

  // 注目度
  const grade = calcGrade(records);
  const gradeEl = document.getElementById('analysis-attention-level');
  gradeEl.textContent  = grade;
  gradeEl.className    = `attention-level g${grade.toLowerCase()}`;
  document.getElementById('analysis-attention-label').textContent = GRADE_LABELS[grade] ?? '';

  const conf = getConfidence(valid.length);
  const confEl = document.getElementById('analysis-confidence');
  confEl.textContent = conf.label;
  confEl.className   = `confidence-badge ${conf.cls}`;

  // 平均値
  const a7  = periodAvg(valid, 7);
  const a30 = periodAvg(valid, 30);

  const avg7El = document.getElementById('analysis-avg7');
  avg7El.textContent = a7 != null ? formatDiff(Math.round(a7)) : 'データなし';
  avg7El.className   = `mini-value${a7 == null ? '' : a7 > 0 ? ' pos' : a7 < 0 ? ' neg' : ''}`;

  const avg30El = document.getElementById('analysis-avg30');
  avg30El.textContent = a30 != null ? formatDiff(Math.round(a30)) : 'データなし';
  avg30El.className   = `mini-value${a30 == null ? '' : a30 > 0 ? ' pos' : a30 < 0 ? ' neg' : ''}`;

  document.getElementById('analysis-record-count').textContent = `${valid.length}件`;

  const trend = getTrend(valid);
  const trendEl = document.getElementById('analysis-trend');
  if (trend) {
    trendEl.textContent = trend.label;
    trendEl.className   = `mini-value ${trend.cls}`;
  } else {
    trendEl.textContent = 'データ不足';
    trendEl.className   = 'mini-value';
  }

  // AIコメント
  document.getElementById('analysis-comment').innerHTML =
    generateComment(store?.name ?? '', records);

  // 曜日グラフ
  renderWeekdayChart(valid);

  // 日付末尾
  renderSuffixChart(valid);

  // 機種ランキング
  renderMachineRanking(valid);
}

function renderWeekdayChart(valid) {
  const stats = weekdayStats(valid);
  const container = document.getElementById('analysis-weekday');
  if (stats.every(s => s.cnt === 0)) {
    container.innerHTML = '<div class="no-data">データ不足</div>';
    return;
  }
  const maxAbs = Math.max(...stats.filter(s => s.avg != null).map(s => Math.abs(s.avg)), 1);
  container.innerHTML = stats.map(s => {
    if (s.cnt === 0) return `
      <div class="wd-row">
        <div class="wd-label">${s.day}</div>
        <div class="wd-track"><span class="wd-none">データなし</span></div>
        <div class="wd-val">-</div>
      </div>`;
    const pct = Math.min(100, (Math.abs(s.avg) / maxAbs) * 100);
    const pos = s.avg >= 0;
    return `
      <div class="wd-row">
        <div class="wd-label">${s.day}</div>
        <div class="wd-track">
          <div class="wd-bar ${pos ? 'pos' : 'neg'}" style="width:${pct}%"></div>
        </div>
        <div class="wd-val ${pos ? 'col-pos' : 'col-neg'}">${formatDiff(Math.round(s.avg))}<br>
          <span style="font-size:10px;color:var(--text3)">${s.cnt}件</span></div>
      </div>`;
  }).join('');
}

function renderSuffixChart(valid) {
  const stats = dateSuffixStats(valid);
  const container = document.getElementById('analysis-date-suffix');
  container.innerHTML = stats.map(s => {
    if (s.cnt === 0) return `
      <div class="suffix-item">
        <div class="suffix-label">${s.label}</div>
        <div class="suffix-value" style="color:var(--text3)">-</div>
        <div class="suffix-count">データなし</div>
      </div>`;
    return `
      <div class="suffix-item">
        <div class="suffix-label">${s.label}</div>
        <div class="suffix-value ${s.avg >= 0 ? 'col-pos' : 'col-neg'}">${formatDiff(Math.round(s.avg))}</div>
        <div class="suffix-count">${s.cnt}件</div>
      </div>`;
  }).join('');
}

function renderMachineRanking(valid) {
  const ranking   = machineRanking(valid);
  const container = document.getElementById('analysis-machine-ranking');
  if (!ranking.length) { container.innerHTML = '<div class="no-data">データなし</div>'; return; }
  container.innerHTML = ranking.slice(0, 10).map((m, i) => {
    const rCls  = i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : '';
    const tLbl  = m.type === 'pachinko' ? 'P' : 'S';
    const color = m.avg >= 0 ? 'col-pos' : 'col-neg';
    return `
      <div class="machine-item">
        <div class="machine-rank ${rCls}">${i + 1}</div>
        <div class="machine-name">${esc(m.name)}</div>
        <div class="type-badge">${tLbl}</div>
        <div class="machine-avg ${color}">${formatDiff(Math.round(m.avg))}</div>
        <div class="machine-cnt">${m.cnt}件</div>
      </div>`;
  }).join('');
}

// ============================================================
// カレンダーページ
// ============================================================
let calYear  = new Date().getFullYear();
let calMonth = new Date().getMonth();
let calStore = '';

function initCalendar() {
  const stores = DB.getStores();
  const sel    = document.getElementById('calendar-store-select');
  sel.innerHTML = '<option value="">店舗を選択してください</option>' +
    stores.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  if (calStore) sel.value = calStore;
  updateCalLabel();
  loadCalendar();
}

function updateCalLabel() {
  document.getElementById('calendar-month-label').textContent = `${calYear}年${calMonth + 1}月`;
}

function changeMonth(d) {
  calMonth += d;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  if (calMonth < 0)  { calMonth = 11; calYear--; }
  updateCalLabel();
  loadCalendar();
}

function loadCalendar() {
  const sel   = document.getElementById('calendar-store-select');
  calStore    = sel.value;
  const grid  = document.getElementById('calendar-grid');
  const today = new Date();

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay  = new Date(calYear, calMonth + 1, 0);
  const startDow = firstDay.getDay();

  const records = calStore ? DB.getRecordsByStore(calStore) : [];
  const byDate  = {};
  records.forEach(r => { if (!byDate[r.date]) byDate[r.date] = []; byDate[r.date].push(r); });

  const dayClasses = ['sun','','','','','','sat'];
  let html = ['日','月','火','水','木','金','土']
    .map((d, i) => `<div class="cal-hdr ${i===0?'sun':i===6?'sat':''}">${d}</div>`).join('');

  for (let i = 0; i < startDow; i++) html += '<div class="cal-day empty"></div>';

  for (let day = 1; day <= lastDay.getDate(); day++) {
    const ds   = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dow  = new Date(calYear, calMonth, day).getDay();
    const isToday = today.getFullYear()===calYear && today.getMonth()===calMonth && today.getDate()===day;
    const recs = byDate[ds] ?? [];

    let grade = '';
    if (calStore && recs.length) {
      const a = avg(recs.filter(r => r.avgDiff != null).map(r => r.avgDiff));
      if (a != null) {
        if (a > 800)        grade = 'S';
        else if (a > 200)   grade = 'A';
        else if (a > -300)  grade = 'B';
        else if (a > -800)  grade = 'C';
        else                grade = 'D';
      }
    }

    html += `
      <div class="cal-day ${dayClasses[dow]} ${grade ? `gd-${grade.toLowerCase()}` : ''} ${isToday ? 'today' : ''}">
        <div class="cd-date">${day}</div>
        ${grade ? `<div class="cd-grade" style="color:var(--grade-${grade.toLowerCase()})">${grade}</div>` : ''}
      </div>`;
  }

  grid.innerHTML = html;
}

// ============================================================
// アプリ初期化
// ============================================================
function init() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
      .catch(e => console.log('SW:', e));
  }

  document.getElementById('form-date').addEventListener('change', updateWeekday);

  navigateTo('home');
}

document.addEventListener('DOMContentLoaded', init);
