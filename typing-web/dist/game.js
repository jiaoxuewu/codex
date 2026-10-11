(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const levels = [...document.querySelectorAll('.level')];
  let level = 1, active = false, round = 0, target = '', deadline = 0;
  let score = 0, correct = 0, wrong = 0, missed = 0, streak = 0;
  let raf = 0, advanceTimer = 0, transition = false;
  const keys = {};
  for (const row of ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']) {
    const container = document.createElement('div');
    container.className = 'key-row';
    for (const letter of row) {
      const key = document.createElement('button');
      key.className = 'key'; key.textContent = letter.toUpperCase();
      key.setAttribute('aria-label', `输入字母 ${letter.toUpperCase()}`);
      key.addEventListener('click', () => answer(letter));
      keys[letter] = key; container.appendChild(key);
    }
    $('keyboard').appendChild(container);
  }
  function stats() {
    const played = correct + wrong + missed;
    for (const [id, value] of Object.entries({score, correct, wrong, missed, streak})) $(id).textContent = value;
    $('accuracy').textContent = played ? `${Math.round(correct / played * 100)}%` : '—';
  }
  function clearKeys() { Object.values(keys).forEach(key => key.classList.remove('active', 'pressed')); }
  function controls() {
    levels.forEach(button => button.disabled = active);
    $('start').disabled = active; $('stop').disabled = !active;
  }
  function drawTime(left) {
    $('time').innerHTML = `${(left / 1000).toFixed(1)}<span> 秒</span>`;
    $('timebar').style.width = `${left / ((4 - level) * 1000) * 100}%`;
    $('timebar').classList.toggle('urgent', left < 700);
  }
  function finish(early = false) {
    active = false; transition = false;
    cancelAnimationFrame(raf); clearTimeout(advanceTimer); clearKeys(); controls();
    $('status').textContent = early ? '练习已结束' : '挑战完成';
    $('hint').textContent = '本次练习总得分'; $('letter').textContent = score;
    $('letter').className = 'letter';
    $('feedback').textContent = `完成 ${correct + wrong + missed} 轮 · 正确 ${correct} 次 · 再来一局，找到更好的节奏`;
    $('start').innerHTML = '再练一局 <span>→</span>';
  }
  function settle(kind) {
    if (!active || transition) return;
    transition = true; cancelAnimationFrame(raf);
    if (kind === 'correct') { score += level * 10; correct++; streak++; }
    else { streak = 0; if (kind === 'wrong') wrong++; else missed++; }
    $('letter').className = `letter ${kind === 'correct' ? 'good' : 'bad'}`;
    $('feedback').textContent = kind === 'correct' ? `敲得漂亮！+${level * 10} 分` : kind === 'wrong' ? `没关系，下一个继续 · 正确字母是 ${target.toUpperCase()}` : '时间到了，下一个继续';
    stats();
    advanceTimer = setTimeout(() => { if (round >= 20) finish(); else nextRound(); }, 550);
  }
  function tick() {
    if (!active || transition) return;
    const left = Math.max(0, deadline - performance.now()); drawTime(left);
    if (left === 0) settle('missed'); else raf = requestAnimationFrame(tick);
  }
  function nextRound() {
    if (!active) return;
    transition = false; round++; clearKeys();
    target = String.fromCharCode(97 + Math.floor(Math.random() * 26));
    $('letter').textContent = target.toUpperCase(); $('letter').className = 'letter';
    $('hint').textContent = '敲下这个字母'; $('feedback').textContent = '保持专注，你可以的';
    $('round').textContent = `${String(round).padStart(2, '0')} / 20`;
    keys[target].classList.add('active');
    deadline = performance.now() + (4 - level) * 1000; tick();
  }
  function answer(letter) {
    if (!active || transition) return;
    if (performance.now() >= deadline) { drawTime(0); settle('missed'); return; }
    keys[letter].classList.add('pressed'); settle(letter === target ? 'correct' : 'wrong');
  }
  levels.forEach(button => button.addEventListener('click', () => {
    if (active) return;
    level = Number(button.dataset.level);
    levels.forEach(item => { const selected = item === button; item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected)); });
    drawTime((4 - level) * 1000);
  }));
  $('start').addEventListener('click', () => {
    cancelAnimationFrame(raf); clearTimeout(advanceTimer);
    score = correct = wrong = missed = streak = round = 0;
    active = true; stats(); controls(); $('status').textContent = '练习进行中';
    $('start').blur(); nextRound();
  });
  $('stop').addEventListener('click', () => finish(true));
  document.addEventListener('keydown', event => {
    if (!active || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); finish(true); return; }
    if (/^[a-z]$/i.test(event.key)) { event.preventDefault(); answer(event.key.toLowerCase()); }
  });
  // 切回标签页时立即核对实际截止时间，避免后台节流延长本轮。
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && active && !transition) { cancelAnimationFrame(raf); tick(); }
  });
})();
