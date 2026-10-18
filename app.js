/**
 * NeuroFlow — Neuro-Inclusive Mobile Prototype Application Logic
 * Targets: ADHD, Anxiety, Dyslexia
 */

(function () {
  'use strict';

  // --- Initial State ---
  const state = {
    currentScreen: 'home', // 'login', 'home', 'tasks', 'focus', 'calendar', 'profile'
    activeTaskTab: 'today', // 'today', 'upcoming', 'completed'
    selectedTask: null,
    lastDeletedTask: null,
    
    // Focus Timer State
    timer: {
      interval: null,
      totalSeconds: 25 * 60,
      remainingSeconds: 24 * 60 + 32,
      isRunning: false,
      isVisualMode: false, // false: digital, true: depleting circle
      currentTaskName: 'DBMS Assignment',
      steps: [
        'Write the introduction',
        'Outline ER Diagram',
        'Draft query 1-3',
        'Review syntax & comments'
      ],
      currentStepIndex: 0
    },

    // Preferences & Accessibility
    preferences: {
      fontScale: 'normal',
      fontFamily: 'Atkinson Hyperlegible',
      theme: 'light',
      bionicReading: false,
      focusDuration: 25,
      breakDuration: 5,
      reminderStyle: 'gentle'
    },

    // Audio State
    audio: {
      ctx: null,
      noiseNode: null,
      filterNode: null,
      gainNode: null,
      activeSound: 'none'
    },

    // Task Model
    tasks: [
      {
        id: 't1',
        title: 'Read research paper',
        course: 'HCI',
        duration: '20m',
        due: '4:00 PM',
        tab: 'today',
        completed: false,
        priority: 'Normal',
        steps: ['Read abstract and introduction', 'Highlight 2 key arguments', 'Note questions for seminar']
      },
      {
        id: 't2',
        title: 'DBMS Assignment',
        course: 'DBMS',
        duration: '25m',
        due: '6:00 PM',
        tab: 'today',
        completed: false,
        priority: 'Normal',
        steps: ['Read question brief', 'Find reference schema', 'Draft ER Diagram', 'Review normalization']
      },
      {
        id: 't3',
        title: 'Submit project draft',
        course: 'Algorithms',
        duration: '15m',
        due: '8:00 PM',
        tab: 'today',
        completed: false,
        priority: 'Normal',
        steps: ['Format PDF cover page', 'Check git repo link', 'Click submit on portal']
      },
      {
        id: 't4',
        title: 'Read Chapter 4: Indexing',
        course: 'DBMS',
        duration: '35m',
        due: 'Tomorrow, 5:00 PM',
        tab: 'upcoming',
        completed: false,
        priority: 'Normal',
        steps: ['B-Tree concepts', 'Review practice quiz']
      },
      {
        id: 't5',
        title: 'Register for Semester Seminar',
        course: 'Personal',
        duration: '10m',
        due: 'Yesterday',
        tab: 'completed',
        completed: true,
        priority: 'Normal',
        steps: ['Open portal link', 'Submit registration']
      }
    ]
  };

  // --- Clock updater ---
  function updateLiveClock() {
    const clockEl = document.getElementById('liveClock');
    if (!clockEl) return;
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    clockEl.textContent = `${hours}:${minutes}`;
  }
  setInterval(updateLiveClock, 30000);
  updateLiveClock();

  // --- Bionic Reading Transformer ---
  function formatBionicText(text) {
    if (!state.preferences.bionicReading) return text;
    return text.split(' ').map(word => {
      if (word.length <= 1) return word;
      const mid = Math.ceil(word.length / 2);
      const boldPart = word.slice(0, mid);
      const rest = word.slice(mid);
      return `<span class="bionic-bold">${boldPart}</span>${rest}`;
    }).join(' ');
  }

  // --- Navigation Engine ---
  window.navigateTo = function (screenId) {
    state.currentScreen = screenId;
    const screens = document.querySelectorAll('.app-screen');
    screens.forEach(s => s.classList.remove('active'));

    const target = document.getElementById(`screen-${screenId}`);
    if (target) {
      target.classList.add('active');
    }

    const scrollContainer = document.getElementById('scrollContainer');
    if (scrollContainer) scrollContainer.scrollTop = 0;

    // Bottom Navigation visibility and state
    const bottomNav = document.getElementById('bottomNavBar');
    const overwhelmFloat = document.getElementById('overwhelmFloatBtn');

    if (screenId === 'login' || screenId === 'focus') {
      bottomNav.style.display = 'none';
      if (overwhelmFloat) overwhelmFloat.style.display = 'none';
    } else {
      bottomNav.style.display = 'flex';
      if (overwhelmFloat) overwhelmFloat.style.display = 'flex';

      const navTabs = document.querySelectorAll('.nav-tab-item');
      navTabs.forEach(tab => {
        if (tab.getAttribute('data-screen') === screenId) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
    }

    // Refresh contents
    if (screenId === 'home') renderHomeTasks();
    if (screenId === 'tasks') renderMainTasks();
  };

  // --- Task Rendering (Home Screen) ---
  function renderHomeTasks() {
    const container = document.getElementById('homeTaskList');
    if (!container) return;
    container.innerHTML = '';

    const todayTasks = state.tasks.filter(t => t.tab === 'today');
    const completedCount = todayTasks.filter(t => t.completed).length;
    const totalCount = todayTasks.length;

    // Sync Progress Bar
    const fractionEl = document.getElementById('homeProgressFraction');
    const segmentsContainer = document.getElementById('homeProgressSegments');
    const todayCountEl = document.getElementById('todayTaskCount');

    if (fractionEl) fractionEl.textContent = `${completedCount} / ${totalCount}`;
    if (todayCountEl) todayCountEl.textContent = `${totalCount} tasks`;

    if (segmentsContainer) {
      segmentsContainer.innerHTML = '';
      for (let i = 0; i < totalCount; i++) {
        const seg = document.createElement('div');
        seg.className = `progress-segment ${i < completedCount ? 'filled' : ''}`;
        segmentsContainer.appendChild(seg);
      }
    }

    todayTasks.forEach(task => {
      const row = document.createElement('div');
      row.className = `task-row ${task.completed ? 'completed' : ''}`;
      row.onclick = (e) => {
        if (!e.target.closest('.custom-checkbox') && !e.target.closest('.task-action-remove')) {
          window.openTaskDetail(task.id);
        }
      };

      const courseBadgeClass = task.course.toLowerCase().includes('class') ? 'badge-class' :
                               task.course.toLowerCase().includes('dbms') ? 'badge-assign' : 'badge-personal';

      row.innerHTML = `
        <div class="custom-checkbox ${task.completed ? 'checked' : ''}" onclick="window.toggleTaskComplete('${task.id}', event)" title="Mark completed" role="checkbox" aria-checked="${task.completed}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div class="task-info">
          <span class="task-title-text">${formatBionicText(task.title)}</span>
          <div class="task-meta-row">
            <span class="badge-tag ${courseBadgeClass}">${task.course}</span>
            <span>·</span>
            <span class="task-time-pill">Due ${task.due}</span>
            <span>·</span>
            <span class="task-time-pill">${task.duration}</span>
          </div>
        </div>
      `;
      container.appendChild(row);
    });
  }

  // --- Task Rendering (Tasks Screen) ---
  window.switchTaskTab = function (tab) {
    state.activeTaskTab = tab;
    const tabBtns = document.querySelectorAll('.segment-tab-btn');
    tabBtns.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tab);
    });
    renderMainTasks();
  };

  function renderMainTasks() {
    const container = document.getElementById('mainTaskList');
    const headerEl = document.getElementById('tasksSectionHeader');
    if (!container) return;
    container.innerHTML = '';

    const filtered = state.tasks.filter(t => t.tab === state.activeTaskTab);
    if (headerEl) {
      headerEl.textContent = `${state.activeTaskTab.toUpperCase()} (${filtered.length} tasks)`;
    }

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 32px 16px; color: var(--text-muted);">
          <div style="font-size: 28px; margin-bottom: 6px;">🌱</div>
          <div style="font-weight: 700; font-size: 15px;">No tasks in this list</div>
          <div style="font-size: 13px; margin-top: 4px;">Take a well-deserved rest or add a new task when ready.</div>
        </div>
      `;
      return;
    }

    filtered.forEach(task => {
      const row = document.createElement('div');
      row.className = `task-row ${task.completed ? 'completed' : ''}`;
      row.onclick = (e) => {
        if (!e.target.closest('.custom-checkbox') && !e.target.closest('.task-action-remove')) {
          window.openTaskDetail(task.id);
        }
      };

      const courseBadgeClass = task.course.toLowerCase().includes('class') ? 'badge-class' :
                               task.course.toLowerCase().includes('dbms') ? 'badge-assign' : 'badge-personal';

      row.innerHTML = `
        <div class="custom-checkbox ${task.completed ? 'checked' : ''}" onclick="window.toggleTaskComplete('${task.id}', event)" title="Toggle status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <div class="task-info">
          <span class="task-title-text">${formatBionicText(task.title)}</span>
          <div class="task-meta-row">
            <span class="badge-tag ${courseBadgeClass}">${task.course}</span>
            <span>·</span>
            <span>Due ${task.due}</span>
            <span>·</span>
            <span>${task.duration}</span>
          </div>
        </div>
        <button class="task-action-remove" onclick="window.deleteTaskSafely('${task.id}', event)" title="Delete task">Remove</button>
      `;
      container.appendChild(row);
    });
  }

  // --- Task Completion Toggle ---
  window.toggleTaskComplete = function (taskId, event) {
    if (event) event.stopPropagation();
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.completed = !task.completed;
    if (task.completed) {
      window.showToast(`Completed: ${task.title} 🎉`);
    }

    renderHomeTasks();
    renderMainTasks();
  };

  // --- Safe Task Deletion with Undo ---
  window.deleteTaskSafely = function (taskId, event) {
    if (event) event.stopPropagation();
    const index = state.tasks.findIndex(t => t.id === taskId);
    if (index === -1) return;

    state.lastDeletedTask = { task: state.tasks[index], index };
    state.tasks.splice(index, 1);

    renderHomeTasks();
    renderMainTasks();

    window.showToast('Task removed', true);
  };

  window.undoLastAction = function () {
    if (state.lastDeletedTask) {
      state.tasks.splice(state.lastDeletedTask.index, 0, state.lastDeletedTask.task);
      state.lastDeletedTask = null;
      renderHomeTasks();
      renderMainTasks();
      window.showToast('Restored task!');
    }
  };

  // --- Task Detail Modal & Breakdown ---
  window.openTaskDetail = function (taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    state.selectedTask = task;

    document.getElementById('detailTitle').textContent = task.title;
    document.getElementById('detailPriorityBadge').textContent = `${task.priority} Priority`;
    document.getElementById('detailMeta').textContent = `Course: ${task.course} · Due: ${task.due} · Duration: ${task.duration}`;

    const checklistContainer = document.getElementById('detailChecklist');
    checklistContainer.innerHTML = '';

    task.steps.forEach((step, idx) => {
      const stepRow = document.createElement('div');
      stepRow.className = 'task-row';
      stepRow.style.padding = '8px 10px';
      stepRow.innerHTML = `
        <div class="custom-checkbox" onclick="this.classList.toggle('checked');">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg>
        </div>
        <span style="font-size: 14px; font-weight: 500;">${step}</span>
      `;
      checklistContainer.appendChild(stepRow);
    });

    // Reset smaller steps box
    document.getElementById('smallerStepsContainer').style.display = 'none';
    window.openModal('taskDetailModal');
  };

  window.breakDownActiveTask = function () {
    const smallerContainer = document.getElementById('smallerStepsContainer');
    const smallerList = document.getElementById('smallerStepsList');
    if (!smallerContainer || !smallerList) return;

    smallerContainer.style.display = 'block';
    smallerList.innerHTML = `
      <div class="task-row" style="padding: 8px 10px;">
        <div class="custom-checkbox" onclick="this.classList.toggle('checked');"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        <span style="font-size: 13px; font-weight: 600;">1. Open the assignment brief on LMS (~2 min)</span>
      </div>
      <div class="task-row" style="padding: 8px 10px;">
        <div class="custom-checkbox" onclick="this.classList.toggle('checked');"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        <span style="font-size: 13px; font-weight: 600;">2. Highlight the first required SQL query (~3 min)</span>
      </div>
      <div class="task-row" style="padding: 8px 10px;">
        <div class="custom-checkbox" onclick="this.classList.toggle('checked');"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        <span style="font-size: 13px; font-weight: 600;">3. Write syntax draft in your local editor (~10 min)</span>
      </div>
    `;

    window.showToast('AI broke task into 3 startable steps! 🪄');
  };

  window.startFocusFromDetail = function () {
    window.closeModal('taskDetailModal');
    if (state.selectedTask) {
      window.launchFocusMode(state.selectedTask.title, state.selectedTask.steps[0] || 'First step');
    } else {
      window.navigateTo('focus');
    }
  };

  // --- Add Task Form Submission ---
  window.submitNewTask = function () {
    const titleInput = document.getElementById('newTaskTitle');
    const courseSelect = document.getElementById('newTaskCourse');
    const timeInput = document.getElementById('newTaskTime');
    const estimateSelect = document.getElementById('newTaskEstimate');

    if (!titleInput.value.trim()) return;

    const newTask = {
      id: 't' + Date.now(),
      title: titleInput.value.trim(),
      course: courseSelect.value,
      duration: estimateSelect.value,
      due: timeInput.value ? formatTimeString(timeInput.value) : 'Today',
      tab: 'today',
      completed: false,
      priority: 'Normal',
      steps: ['First micro-action', 'Main work session', 'Final verification']
    };

    state.tasks.unshift(newTask);
    titleInput.value = '';
    window.closeModal('addTaskModal');
    renderHomeTasks();
    renderMainTasks();
    window.showToast('Task added to Today!');
  };

  function formatTimeString(timeStr) {
    const [h, m] = timeStr.split(':');
    let hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${m} ${ampm}`;
  }

  // --- Add Event Form Submission ---
  window.submitNewEvent = function () {
    const titleInput = document.getElementById('newEventTitle');
    if (!titleInput.value.trim()) return;

    titleInput.value = '';
    window.closeModal('addEventModal');
    window.showToast('Event saved to your schedule!');
  };

  // --- Focus Mode Timer Engine ---
  window.launchFocusMode = function (taskName, stepName) {
    state.timer.currentTaskName = taskName || 'DBMS Assignment';
    if (stepName) state.timer.steps[state.timer.currentStepIndex] = stepName;

    document.getElementById('focusTaskName').textContent = state.timer.currentTaskName;
    document.getElementById('focusStepTitle').textContent = state.timer.steps[state.timer.currentStepIndex];

    state.timer.remainingSeconds = state.preferences.focusDuration * 60;
    state.timer.totalSeconds = state.timer.remainingSeconds;
    updateTimerVisuals();

    window.navigateTo('focus');
    window.startTimer();
  };

  window.exitFocusMode = function () {
    window.pauseTimer();
    window.navigateTo('home');
  };

  window.startTimer = function () {
    if (state.timer.isRunning) return;
    state.timer.isRunning = true;
    document.getElementById('pauseBtnLabel').textContent = 'PAUSE';

    state.timer.interval = setInterval(() => {
      if (state.timer.remainingSeconds > 0) {
        state.timer.remainingSeconds--;
        updateTimerVisuals();
      } else {
        window.pauseTimer();
        window.showToast('Focus session complete! Take a gentle 5-min break 🌱');
      }
    }, 1000);
  };

  window.pauseTimer = function () {
    state.timer.isRunning = false;
    clearInterval(state.timer.interval);
    document.getElementById('pauseBtnLabel').textContent = 'RESUME';
  };

  window.togglePauseTimer = function () {
    if (state.timer.isRunning) {
      window.pauseTimer();
    } else {
      window.startTimer();
    }
  };

  function updateTimerVisuals() {
    const mins = Math.floor(state.timer.remainingSeconds / 60);
    const secs = state.timer.remainingSeconds % 60;
    const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;

    const digitsEl = document.getElementById('timerDigits');
    const visualDigitsEl = document.getElementById('visualTimerDigits');
    if (digitsEl) digitsEl.textContent = timeStr;
    if (visualDigitsEl) visualDigitsEl.textContent = timeStr;

    // Visual circular progress
    const circle = document.getElementById('timerCircleProgress');
    if (circle) {
      const circumference = 2 * Math.PI * 68; // r=68 -> 427.26
      const fraction = state.timer.remainingSeconds / state.timer.totalSeconds;
      const offset = circumference * (1 - fraction);
      circle.style.strokeDashoffset = offset;
    }
  }

  window.toggleTimerVisualMode = function () {
    state.timer.isVisualMode = !state.timer.isVisualMode;
    const digitalBox = document.getElementById('digitalTimerBox');
    const visualBox = document.getElementById('visualTimerBox');

    if (state.timer.isVisualMode) {
      digitalBox.style.display = 'none';
      visualBox.style.display = 'flex';
      window.showToast('Switched to Visual Ring Timer (Time Timer Mode)');
    } else {
      digitalBox.style.display = 'block';
      visualBox.style.display = 'none';
      window.showToast('Switched to Digital Countdown');
    }
    updateTimerVisuals();
  };

  window.completeFocusStep = function () {
    state.timer.currentStepIndex = (state.timer.currentStepIndex + 1) % state.timer.steps.length;
    const nextStep = state.timer.steps[state.timer.currentStepIndex];
    document.getElementById('focusStepTitle').textContent = nextStep;

    const dashes = document.querySelectorAll('#focusStepDashes .step-dash');
    dashes.forEach((dash, idx) => {
      dash.className = 'step-dash';
      if (idx < state.timer.currentStepIndex) dash.classList.add('completed');
      else if (idx === state.timer.currentStepIndex) dash.classList.add('active');
    });

    const stepCountEl = document.getElementById('focusStepCountText');
    if (stepCountEl) {
      stepCountEl.textContent = `Step ${state.timer.currentStepIndex + 1} of ${state.timer.steps.length}`;
    }

    window.showToast(`Step completed! Now: ${nextStep} 🎯`);
  };

  // --- "I'm Stuck?" Handlers ---
  window.makeStepSmallerAction = function () {
    window.closeModal('stuckModal');
    const current = state.timer.steps[state.timer.currentStepIndex];
    document.getElementById('focusStepTitle').textContent = `Micro-step: Just read first sentence of "${current}"`;
    window.showToast('Step simplified to a 2-minute micro-action!');
  };

  window.takeShortBreakAction = function () {
    window.closeModal('stuckModal');
    window.pauseTimer();
    window.showToast('Timer paused for 2 minutes. Look away from screen & breathe.');
  };

  window.skipStepAction = function () {
    window.closeModal('stuckModal');
    window.completeFocusStep();
  };

  // --- Overwhelm / Freeze Reset Flow ---
  window.completeOverwhelmStep = function () {
    window.closeModal('overwhelmModal');
    window.showToast('You took a gentle pause. That is progress 🌱');
  };

  // --- Calendar Date Selection ---
  window.selectCalendarDay = function (dayNum) {
    const pills = document.querySelectorAll('.calendar-day-pill');
    pills.forEach(p => {
      const num = p.querySelector('.day-pill-num').textContent;
      p.classList.toggle('active', num == dayNum);
    });
    window.showToast(`Showing schedule for Sep ${dayNum}, 2026`);
  };

  // --- Profile & Accessibility Controls ---
  window.setFontScale = function (scale, btn) {
    state.preferences.fontScale = scale;
    const btns = btn.parentElement.querySelectorAll('.pref-pill-btn');
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    const frame = document.getElementById('appFrame');
    if (scale === 'small') frame.style.fontSize = '14px';
    else if (scale === 'large') frame.style.fontSize = '18px';
    else frame.style.fontSize = '16px';
  };

  window.setFontFamily = function (family, btn) {
    state.preferences.fontFamily = family;
    const btns = btn.parentElement.querySelectorAll('.pref-pill-btn');
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.documentElement.style.setProperty('--font-family', `'${family}', sans-serif`);
    window.showToast(`Applied ${family} font`);
  };

  window.setTheme = function (theme, btn) {
    state.preferences.theme = theme;
    const btns = btn.parentElement.querySelectorAll('.pref-pill-btn');
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.documentElement.setAttribute('data-theme', theme);
    window.showToast(`Theme switched to ${theme.replace('-', ' ')}`);
  };

  window.toggleBionicReading = function (checked) {
    state.preferences.bionicReading = checked;
    document.body.classList.toggle('bionic-reading', checked);
    renderHomeTasks();
    renderMainTasks();
    window.showToast(checked ? 'Bionic reading active: Initial letters bolded' : 'Bionic reading disabled');
  };

  window.adjustDuration = function (type, change) {
    if (type === 'focus') {
      state.preferences.focusDuration = Math.max(5, Math.min(60, state.preferences.focusDuration + change));
      document.getElementById('focusDurationValue').textContent = `${state.preferences.focusDuration} min`;
    } else {
      state.preferences.breakDuration = Math.max(1, Math.min(20, state.preferences.breakDuration + change));
      document.getElementById('breakDurationValue').textContent = `${state.preferences.breakDuration} min`;
    }
  };

  window.setReminderStyle = function (style, btn) {
    state.preferences.reminderStyle = style;
    const btns = btn.parentElement.querySelectorAll('.pref-pill-btn');
    btns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  };

  window.savePreferences = function () {
    window.showToast('Accessibility preferences saved successfully!');
  };

  // --- Password Reveal Toggle ---
  const togglePassBtn = document.getElementById('togglePasswordBtn');
  const passInput = document.getElementById('loginPassword');
  if (togglePassBtn && passInput) {
    togglePassBtn.addEventListener('click', () => {
      const isPass = passInput.getAttribute('type') === 'password';
      passInput.setAttribute('type', isPass ? 'text' : 'password');
      togglePassBtn.setAttribute('aria-label', isPass ? 'Hide password' : 'Show password');
    });
  }

  // --- Ambient Sound Synthesis (Web Audio API) ---
  window.setAmbientSound = function (type, btn) {
    state.audio.activeSound = type;
    const btns = document.querySelectorAll('#ambientModal .pref-pill-btn');
    btns.forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const soundLabel = document.getElementById('ambientSoundLabel');

    if (type === 'none') {
      stopAmbientSound();
      if (soundLabel) soundLabel.textContent = 'Ambient sound';
      window.showToast('Ambient audio muted');
      return;
    }

    playAmbientSound(type);
    if (soundLabel) {
      soundLabel.textContent = type === 'rain' ? '🌧️ Rain' : type === 'brown' ? '🌊 Brown Noise' : '🍃 Stream';
    }
    window.showToast(`Playing soothing ${type} noise`);
  };

  function playAmbientSound(type) {
    try {
      if (!state.audio.ctx) {
        state.audio.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (state.audio.ctx.state === 'suspended') {
        state.audio.ctx.resume();
      }

      stopAmbientSound();

      // Buffer Noise Generation (Brown / White Noise)
      const bufferSize = state.audio.ctx.sampleRate * 2;
      const noiseBuffer = state.audio.ctx.createBuffer(1, bufferSize, state.audio.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        if (type === 'brown' || type === 'stream') {
          // Brown noise algorithm (integrated random walk)
          output[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = output[i];
          output[i] *= 3.5;
        } else {
          // Rain pinkish filtered noise
          output[i] = white * 0.15;
        }
      }

      state.audio.noiseNode = state.audio.ctx.createBufferSource();
      state.audio.noiseNode.buffer = noiseBuffer;
      state.audio.noiseNode.loop = true;

      // Filter
      state.audio.filterNode = state.audio.ctx.createBiquadFilter();
      state.audio.filterNode.type = type === 'stream' ? 'bandpass' : 'lowpass';
      state.audio.filterNode.frequency.value = type === 'brown' ? 400 : type === 'stream' ? 800 : 1200;

      // Gain (Soft gentle volume)
      state.audio.gainNode = state.audio.ctx.createGain();
      state.audio.gainNode.gain.setValueAtTime(0.08, state.audio.ctx.currentTime);

      state.audio.noiseNode.connect(state.audio.filterNode);
      state.audio.filterNode.connect(state.audio.gainNode);
      state.audio.gainNode.connect(state.audio.ctx.destination);

      state.audio.noiseNode.start();
    } catch (e) {
      console.warn('Web Audio playback error:', e);
    }
  }

  function stopAmbientSound() {
    if (state.audio.noiseNode) {
      try {
        state.audio.noiseNode.stop();
        state.audio.noiseNode.disconnect();
      } catch (e) {}
      state.audio.noiseNode = null;
    }
  }

  // --- Modal Helpers ---
  window.openModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  };

  window.closeModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  };

  // --- Toast Notification Helper ---
  let toastTimeout = null;
  window.showToast = function (message, showUndo = false) {
    const toast = document.getElementById('toastBar');
    const msgEl = document.getElementById('toastMessage');
    const undoBtn = document.getElementById('toastUndoBtn');
    if (!toast) return;

    if (msgEl) msgEl.textContent = message;
    if (undoBtn) undoBtn.style.display = showUndo ? 'block' : 'none';

    toast.classList.add('active');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('active');
    }, 4500);
  };

  // --- Onboarding / Init ---
  document.addEventListener('DOMContentLoaded', () => {
    // Quick accessibility button on login navigates to profile
    const a11yBtn = document.getElementById('loginA11yBtn');
    if (a11yBtn) {
      a11yBtn.onclick = () => window.navigateTo('profile');
    }

    // Default start screen
    window.navigateTo('home');
  });

})();
