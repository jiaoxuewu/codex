(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const levels = [...document.querySelectorAll('.level')];
  let level = 1, active = false, round = 0, target = '', deadline = 0;
  let score = 0, correct = 0, wrong = 0, missed = 0, streak = 0;
  let raf = 0, advanceTimer = 0, transition = false;
  let preparing = false, preparationDeadline = 0, countdownNumber = 0;
  const keys = {};
  let soundEnabled = true;
  const speech = window.speechSynthesis;
  const Utterance = window.SpeechSynthesisUtterance;
  function sound(kind) {
    if (!soundEnabled || !speech || !Utterance) return;
    const phrases = {
      start: '开始练习', correct: '正确', wrong: '再试一次',
      missed: '时间到了', finish: `练习完成，得分${score}分`,
      stop: '练习结束', enabled: '语音已开启',
      ready3: '三', ready2: '二', ready1: '一'
    };
    if (!phrases[kind]) return;
    try {
      // 每次重新获取语音，兼容浏览器异步加载语音列表。
      const voices = speech.getVoices();
      const mainland = voices.find(voice => /^zh[-_]CN$/i.test(voice.lang));
      const mandarin = mainland || voices.find(voice => /^zh[-_](TW|SG)$/i.test(voice.lang));
      const utterance = new Utterance(phrases[kind]);
      utterance.lang = 'zh-CN';
      if (mandarin) utterance.voice = mandarin;
      utterance.rate = 1.15;
      utterance.pitch = 1;
      utterance.volume = 0.8;
      // 丢弃旧播报，快速模式下也不会排队积压。
      speech.cancel();
      speech.speak(utterance);
    } catch (_) { /* 语音不可用时仍可正常游玩。 */ }
  }
  $('sound').addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    $('sound').textContent = soundEnabled ? '♫ 普通话开' : '♪ 已静音';
    $('sound').setAttribute('aria-pressed', String(soundEnabled));
    if (soundEnabled) sound('enabled');
    else { try { speech?.cancel(); } catch (_) {} }
  });
  window.addEventListener('pagehide', () => { try { speech?.cancel(); } catch (_) {} });
  for (const row of ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']) {
    const container = document.createElement('div');
    container.className = 'key-row';
    for (const letter of row) {
      const key = document.createElement('button');
      key.className = 'key'; key.textContent = letter;
      key.setAttribute('aria-label', `输入字母 ${letter}`);
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
    sound(early ? 'stop' : 'finish');
    active = false; transition = false; preparing = false;
    cancelAnimationFrame(raf); clearTimeout(advanceTimer); clearKeys(); controls();
    $('status').textContent = early ? '练习已结束' : '挑战完成';
    $('hint').textContent = '本次练习总得分'; $('letter').textContent = score;
    $('letter').className = 'letter';
    $('feedback').textContent = `完成 ${correct + wrong + missed} 轮 · 正确 ${correct} 次 · 再来一局，找到更好的节奏`;
    $('start').innerHTML = '再练一局 <span>→</span>';
  }
  function settle(kind) {
    if (!active || transition || preparing) return;
    transition = true; cancelAnimationFrame(raf);
    sound(kind);
    if (kind === 'correct') { score += level * 10; correct++; streak++; }
    else { streak = 0; if (kind === 'wrong') wrong++; else missed++; }
    $('letter').className = `letter ${kind === 'correct' ? 'good' : 'bad'}`;
    $('feedback').textContent = kind === 'correct' ? `敲得漂亮！+${level * 10} 分` : kind === 'wrong' ? `没关系，下一个继续 · 正确字母是 ${target}` : '时间到了，下一个继续';
    stats();
    advanceTimer = setTimeout(() => { if (round >= 20) finish(); else nextRound(); }, 550);
  }
  function tick() {
    if (!active || transition || preparing) return;
    const left = Math.max(0, deadline - performance.now()); drawTime(left);
    if (left === 0) settle('missed'); else raf = requestAnimationFrame(tick);
  }
  function nextRound() {
    if (!active) return;
    transition = false; round++; clearKeys();
    target = String.fromCharCode(97 + Math.floor(Math.random() * 26));
    $('letter').textContent = target; $('letter').className = 'letter';
    $('hint').textContent = '敲下这个字母'; $('feedback').textContent = '保持专注，你可以的';
    $('round').textContent = `${String(round).padStart(2, '0')} / 20`;
    keys[target].classList.add('active');
    deadline = performance.now() + (4 - level) * 1000; tick();
  }
  function answer(letter) {
    if (!active || transition || preparing) return;
    if (performance.now() >= deadline) { drawTime(0); settle('missed'); return; }
    keys[letter].classList.add('pressed'); settle(letter === target ? 'correct' : 'wrong');
  }
  levels.forEach(button => button.addEventListener('click', () => {
    if (active) return;
    level = Number(button.dataset.level);
    levels.forEach(item => { const selected = item === button; item.classList.toggle('selected', selected); item.setAttribute('aria-pressed', String(selected)); });
    drawTime((4 - level) * 1000);
  }));
  function preparationTick() {
    if (!active || !preparing) return;
    const left = Math.max(0, preparationDeadline - performance.now());
    if (left === 0) {
      preparing = false;
      $('status').textContent = '练习进行中';
      sound('start');
      nextRound();
      return;
    }
    const number = Math.ceil(left / 1000);
    if (number !== countdownNumber) {
      countdownNumber = number;
      $('letter').textContent = number;
      $('feedback').textContent = `${number} 秒后开始，准备好你的手指`;
      sound(`ready${number}`);
    }
    raf = requestAnimationFrame(preparationTick);
  }
  $('start').addEventListener('click', () => {
    if (active) return;
    cancelAnimationFrame(raf); clearTimeout(advanceTimer);
    score = correct = wrong = missed = streak = round = 0;
    active = true; preparing = true; transition = false; countdownNumber = 0;
    stats(); controls(); clearKeys();
    $('status').textContent = '即将开始';
    $('round').textContent = '00 / 20';
    $('hint').textContent = '准备开始'; $('letter').className = 'letter';
    drawTime((4 - level) * 1000);
    preparationDeadline = performance.now() + 3000;
    $('start').blur(); preparationTick();
  });
  $('stop').addEventListener('click', () => finish(true));
  document.addEventListener('keydown', event => {
    if (!active || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); finish(true); return; }
    if (/^[a-z]$/i.test(event.key)) { event.preventDefault(); answer(event.key.toLowerCase()); }
  });
  // 切回标签页时立即核对实际截止时间，避免后台节流延长本轮。
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && active && !transition) {
      cancelAnimationFrame(raf);
      if (preparing) preparationTick(); else tick();
    }
  });
})();
