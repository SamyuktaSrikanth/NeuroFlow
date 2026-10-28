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
    
    // Calendar Navigation State
    calendar: {
      year: 2026,
      month: 9, // 1-indexed (9 = September)
      selectedDay: 23,
      pickerYear: 2026,
      pickerMonth: 9,
      isOpen: false,
      eventsByDate: {}
    },

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
      fontSizePx: 16,
      fontFamily: 'Atkinson Hyperlegible',
      theme: 'light',
      bionicReading: false,
      reduceMotion: false,
      reduceClutter: false,
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

  // --- Bionic Reading Transformer & Universal DOM Engine ---
  function formatBionicWord(w) {
    if (!/[a-zA-Z]/.test(w)) return w;
    const len = w.length;
    let boldCount = 1;
    if (len <= 3) boldCount = 1;
    else if (len <= 5) boldCount = 2;
    else if (len <= 7) boldCount = 3;
    else if (len <= 9) boldCount = 4;
    else boldCount = Math.ceil(len * 0.45);

    const bold = w.slice(0, boldCount);
    const rest = w.slice(boldCount);
    return `<span class="bionic-bold">${bold}</span>${rest}`;
  }

  function formatBionicText(text) {
    if (!text || typeof text !== 'string') return text;
    // Strip existing bionic spans if present to ensure clean idempotency
    const clean = text.replace(/<span class="bionic-bold">([^<]+)<\/span>/g, '$1');
    const tokens = clean.split(/([a-zA-Z0-9'’]+)/);
    return tokens.map(t => {
      if (!/[a-zA-Z]/.test(t)) {
        return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      }
      return formatBionicWord(t);
    }).join('');
  }

  const BIONIC_EXCLUDE_TAGS = new Set([
    'SCRIPT', 'STYLE', 'INPUT', 'TEXTAREA', 'SELECT', 'SVG', 'PATH', 'POLYGON', 'CIRCLE', 'LINE', 'RECT', 'CODE', 'PRE'
  ]);

  function collectTextNodes(root) {
    const nodes = [];
    function walk(node) {
      if (!node) return;
      if (node.nodeType === Node.TEXT_NODE) {
        const text = node.textContent;
        if (text && /[a-zA-Z]/.test(text)) {
          const parent = node.parentElement;
          if (parent &&
              !BIONIC_EXCLUDE_TAGS.has(parent.tagName) &&
              !parent.closest('.bionic-wrapper') &&
              !parent.closest('.bionic-bold') &&
              !parent.closest('.icon-btn-ghost') &&
              !parent.closest('.stepper-btn') &&
              !parent.closest('.custom-checkbox')) {
            nodes.push(node);
          }
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (BIONIC_EXCLUDE_TAGS.has(node.tagName)) return;
        if (node.classList.contains('bionic-wrapper') || node.classList.contains('bionic-bold')) return;
        if (node.classList.contains('icon-btn-ghost') || node.classList.contains('stepper-btn') || node.classList.contains('custom-checkbox')) return;
        const children = node.childNodes;
        for (let i = 0; i < children.length; i++) {
          walk(children[i]);
        }
      }
    }
    walk(root);
    return nodes;
  }

  let isBionicRunning = false;

  function applyBionicReading(root) {
    if (!state.preferences.bionicReading) return;
    if (isBionicRunning) return;
    isBionicRunning = true;
    try {
      if (!root) root = document.getElementById('appFrame') || document.body;
      const textNodes = collectTextNodes(root);
      textNodes.forEach(node => {
        const text = node.textContent;
        const parent = node.parentNode;
        if (!parent) return;
        const span = document.createElement('span');
        span.className = 'bionic-wrapper';
        span.setAttribute('data-bionic-original', text);
        span.innerHTML = formatBionicText(text);
        parent.replaceChild(span, node);
      });
    } finally {
      isBionicRunning = false;
    }
  }

  function removeBionicReading(root) {
    if (isBionicRunning) return;
    isBionicRunning = true;
    try {
      if (!root) root = document.getElementById('appFrame') || document.body;
      const wrappers = root.querySelectorAll('.bionic-wrapper');
      wrappers.forEach(wrap => {
        const orig = wrap.getAttribute('data-bionic-original');
        const text = (orig !== null && orig !== undefined) ? orig : wrap.textContent;
        const textNode = document.createTextNode(text);
        if (wrap.parentNode) {
          wrap.parentNode.replaceChild(textNode, wrap);
        }
      });

      const boldSpans = root.querySelectorAll('.bionic-bold');
      boldSpans.forEach(b => {
        const textNode = document.createTextNode(b.textContent);
        if (b.parentNode) {
          b.parentNode.replaceChild(textNode, b);
        }
      });

      if (root.normalize) {
        root.normalize();
      }
    } finally {
      isBionicRunning = false;
    }
  }

  let bionicObserver = null;
  function initBionicObserver() {
    if (typeof MutationObserver === 'undefined') return;
    if (bionicObserver) return;
    bionicObserver = new MutationObserver((mutations) => {
      if (!state.preferences.bionicReading || isBionicRunning) return;
      for (const m of mutations) {
        if (m.type === 'childList') {
          for (const added of m.addedNodes) {
            if (added.nodeType === Node.ELEMENT_NODE) {
              if (!added.classList.contains('bionic-wrapper') && !added.classList.contains('bionic-bold')) {
                applyBionicReading(added);
              }
            } else if (added.nodeType === Node.TEXT_NODE) {
              if (added.parentElement && !added.parentElement.closest('.bionic-wrapper')) {
                applyBionicReading(added.parentElement);
              }
            }
          }
        }
      }
    });

    const target = document.getElementById('appFrame') || document.body;
    if (target) {
      bionicObserver.observe(target, { childList: true, subtree: true });
    }
    if (document.body && target !== document.body) {
      bionicObserver.observe(document.body, { childList: true, subtree: true });
    }
  }

  function updateNextStepCard() {
    const titleEl = document.getElementById('nextStepTitle');
    const descEl = document.getElementById('nextStepActionDesc');
    const rawTitle = 'DBMS Assignment';
    const rawDesc = 'Step 2 of 4: Outline ER Diagram (~15 min)';
    if (titleEl) {
      titleEl.textContent = rawTitle;
    }
    if (descEl) {
      descEl.textContent = rawDesc;
    }
    if (state.preferences.bionicReading) {
      const card = document.querySelector('.next-step-card');
      if (card) applyBionicReading(card);
    }
  }

  function updateFocusDisplay() {
    const taskNameEl = document.getElementById('focusTaskName');
    const stepTitleEl = document.getElementById('focusStepTitle');
    if (taskNameEl && state.timer.currentTaskName) {
      taskNameEl.textContent = state.timer.currentTaskName;
    }
    if (stepTitleEl && state.timer.steps && state.timer.steps[state.timer.currentStepIndex]) {
      stepTitleEl.textContent = state.timer.steps[state.timer.currentStepIndex];
    }
    if (state.preferences.bionicReading) {
      const focusScreen = document.getElementById('screen-focus');
      if (focusScreen) applyBionicReading(focusScreen);
    }
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

    if (screenId === 'login' || screenId === 'signup' || screenId === 'focus') {
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
    if (screenId === 'home') {
      renderHomeTasks();
      updateNextStepCard();
    }
    if (screenId === 'tasks') renderMainTasks();
    if (screenId === 'profile' && typeof syncProfileUI === 'function') syncProfileUI();

    if (state.preferences.bionicReading) {
      setTimeout(() => applyBionicReading(document.getElementById('appFrame') || document.body), 0);
    }
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
          <span class="task-title-text">${task.title}</span>
          <div class="task-meta-row">
            <span class="badge-tag ${courseBadgeClass}">${task.course}</span>
            <span class="task-meta-dot">·</span>
            <span class="task-time-pill">Due ${task.due}</span>
            <span class="task-meta-dot">·</span>
            <span class="task-time-pill">${task.duration}</span>
          </div>
        </div>
      `;
      container.appendChild(row);
    });

    if (state.preferences.bionicReading) {
      applyBionicReading(container);
    }
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
          <div style="font-size: 28px; margin-bottom: 6px;"><span class="clutter-emoji">🌱</span></div>
          <div style="font-weight: 700; font-size: 15px;">No tasks in this list</div>
          <div style="font-size: 13px; margin-top: 4px;">Take a well-deserved rest or add a new task when ready.</div>
        </div>
      `;
      if (state.preferences.bionicReading) {
        applyBionicReading(container);
        if (headerEl) applyBionicReading(headerEl);
      }
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
          <span class="task-title-text">${task.title}</span>
          <div class="task-meta-row">
            <span class="badge-tag ${courseBadgeClass}">${task.course}</span>
            <span class="task-meta-dot">·</span>
            <span class="task-time-pill">Due ${task.due}</span>
            <span class="task-meta-dot">·</span>
            <span class="task-time-pill">${task.duration}</span>
          </div>
        </div>
        <button class="task-action-remove" onclick="window.deleteTaskSafely('${task.id}', event)" title="Delete task">Remove</button>
      `;
      container.appendChild(row);
    });

    if (state.preferences.bionicReading) {
      applyBionicReading(container);
      if (headerEl) applyBionicReading(headerEl);
    }
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

    if (state.preferences.bionicReading) {
      applyBionicReading(smallerList);
    }

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
    const dateInput = document.getElementById('newEventDate');
    const timeInput = document.getElementById('newEventTime');
    const catInput = document.getElementById('newEventCategory');
    if (!titleInput || !titleInput.value.trim()) return;

    const eventTitle = titleInput.value.trim();
    const eventDate = dateInput && dateInput.value ? dateInput.value : '2026-09-23';
    const eventTime = timeInput && timeInput.value ? formatTimeString(timeInput.value) : '10:00 AM';
    const eventCategory = catInput && catInput.value ? catInput.value : 'Class';

    if (!state.calendar.eventsByDate[eventDate]) {
      state.calendar.eventsByDate[eventDate] = [];
    }
    state.calendar.eventsByDate[eventDate].push({
      title: eventTitle,
      date: eventDate,
      time: eventTime,
      category: eventCategory
    });

    titleInput.value = '';
    window.closeModal('addEventModal');
    window.showToast('Event saved to your schedule!');
    if (typeof updateCalendarTimeline === 'function') {
      updateCalendarTimeline(state.calendar.year, state.calendar.month, state.calendar.selectedDay);
    }
  };

  // --- Focus Mode Timer Engine ---
  window.launchFocusMode = function (taskName, stepName) {
    state.timer.currentTaskName = taskName || 'DBMS Assignment';
    if (stepName) state.timer.steps[state.timer.currentStepIndex] = stepName;

    const taskNameEl = document.getElementById('focusTaskName');
    const stepTitleEl = document.getElementById('focusStepTitle');
    if (taskNameEl) taskNameEl.textContent = state.timer.currentTaskName;
    if (stepTitleEl) stepTitleEl.textContent = state.timer.steps[state.timer.currentStepIndex];

    state.timer.remainingSeconds = state.preferences.focusDuration * 60;
    state.timer.totalSeconds = state.timer.remainingSeconds;
    updateTimerVisuals();

    window.navigateTo('focus');
    if (state.preferences.bionicReading) {
      const focusScreen = document.getElementById('screen-focus');
      if (focusScreen) applyBionicReading(focusScreen);
    }
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
    const stepEl = document.getElementById('focusStepTitle');
    if (stepEl) {
      stepEl.textContent = nextStep;
      if (state.preferences.bionicReading) {
        applyBionicReading(stepEl);
      }
    }

    const dashes = document.querySelectorAll('#focusStepDashes .step-dash');
    dashes.forEach((dash, idx) => {
      dash.className = 'step-dash';
      if (idx < state.timer.currentStepIndex) dash.classList.add('completed');
      else if (idx === state.timer.currentStepIndex) dash.classList.add('active');
    });

    const stepCountEl = document.getElementById('focusStepCountText');
    if (stepCountEl) {
      stepCountEl.textContent = `Step ${state.timer.currentStepIndex + 1} of ${state.timer.steps.length}`;
      if (state.preferences.bionicReading) {
        applyBionicReading(stepCountEl);
      }
    }

    window.showToast(`Step completed! Now: ${nextStep} 🎯`);
  };

  // --- "I'm Stuck?" Handlers ---
  window.makeStepSmallerAction = function () {
    window.closeModal('stuckModal');
    const current = state.timer.steps[state.timer.currentStepIndex];
    const stepEl = document.getElementById('focusStepTitle');
    if (stepEl) {
      stepEl.textContent = `Micro-step: Just read first sentence of "${current}"`;
      if (state.preferences.bionicReading) {
        applyBionicReading(stepEl);
      }
    }
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
    window.showToast('You took a gentle pause. That is progress.');
  };

  // --- Calendar Date, Month & Year Engine ---
  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  function getDaysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
  }

  // --- Calendar Datepicker Popover Dropdown (Matches User Screenshot) ---
  window.toggleCalendarDropdown = function () {
    const dropdown = document.getElementById('calendarDatePickerDropdown');
    const trigger = document.getElementById('calendarDropdownTrigger');
    if (!dropdown) return;

    state.calendar.isOpen = !state.calendar.isOpen;
    if (state.calendar.isOpen) {
      state.calendar.pickerYear = state.calendar.year;
      state.calendar.pickerMonth = state.calendar.month;
      window.renderCalendarPicker();
      dropdown.style.display = 'block';
      if (trigger) {
        trigger.classList.add('open');
        trigger.setAttribute('aria-expanded', 'true');
      }
    } else {
      dropdown.style.display = 'none';
      if (trigger) {
        trigger.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    }
  };

  window.closeCalendarDropdown = function () {
    const dropdown = document.getElementById('calendarDatePickerDropdown');
    const trigger = document.getElementById('calendarDropdownTrigger');
    if (!dropdown) return;

    state.calendar.isOpen = false;
    dropdown.style.display = 'none';
    if (trigger) {
      trigger.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }
  };

  window.navigatePickerMonth = function (delta) {
    let y = state.calendar.pickerYear;
    let m = state.calendar.pickerMonth + delta;

    if (m < 1) {
      y--;
      m = 12;
    } else if (m > 12) {
      y++;
      m = 1;
    }

    state.calendar.pickerYear = y;
    state.calendar.pickerMonth = m;
    window.renderCalendarPicker();
  };

  window.renderCalendarPicker = function () {
    const titleEl = document.getElementById('pickerMonthTitle');
    const gridEl = document.getElementById('pickerDaysGrid');
    if (!titleEl || !gridEl) return;

    const pYear = state.calendar.pickerYear;
    const pMonth = state.calendar.pickerMonth;

    titleEl.textContent = `${MONTH_NAMES[pMonth - 1]} ${pYear}`;

    // 0 = Sunday, 1 = Monday, ... 6 = Saturday (Matches S M T W T F S in image)
    const firstDayIndex = new Date(pYear, pMonth - 1, 1).getDay();
    const daysInCurrentMonth = getDaysInMonth(pYear, pMonth);
    const prevMonthNum = pMonth - 1 < 1 ? 12 : pMonth - 1;
    const prevYearNum = pMonth - 1 < 1 ? pYear - 1 : pYear;
    const daysInPrevMonth = getDaysInMonth(prevYearNum, prevMonthNum);

    let html = '';

    // 1. Leading days from previous month (grayed out like 30, 31 in image)
    const prevLeadingCount = firstDayIndex;
    const startPrevDay = daysInPrevMonth - prevLeadingCount + 1;
    for (let d = startPrevDay; d <= daysInPrevMonth; d++) {
      html += `
        <button type="button" class="picker-day-cell other-month" onclick="window.selectPickerDate(${prevYearNum}, ${prevMonthNum}, ${d})" title="${MONTH_NAMES[prevMonthNum - 1]} ${d}, ${prevYearNum}">
          ${d}
        </button>
      `;
    }

    // 2. Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const isSelected = pYear === state.calendar.year && pMonth === state.calendar.month && d === state.calendar.selectedDay;
      const isToday = pYear === 2026 && pMonth === 9 && d === 23;
      const activeClass = isSelected ? 'active' : (isToday ? 'today' : '');

      html += `
        <button type="button" class="picker-day-cell ${activeClass}" onclick="window.selectPickerDate(${pYear}, ${pMonth}, ${d})" title="${MONTH_NAMES[pMonth - 1]} ${d}, ${pYear}">
          ${d}
        </button>
      `;
    }

    // 3. Trailing days from next month (grayed out like 1, 2, 3 in image)
    const totalFilledCells = prevLeadingCount + daysInCurrentMonth;
    const totalCells = totalFilledCells > 35 ? 42 : 35;
    const nextTrailingCount = totalCells - totalFilledCells;
    const nextMonthNum = pMonth + 1 > 12 ? 1 : pMonth + 1;
    const nextYearNum = pMonth + 1 > 12 ? pYear + 1 : pYear;

    for (let d = 1; d <= nextTrailingCount; d++) {
      html += `
        <button type="button" class="picker-day-cell other-month" onclick="window.selectPickerDate(${nextYearNum}, ${nextMonthNum}, ${d})" title="${MONTH_NAMES[nextMonthNum - 1]} ${d}, ${nextYearNum}">
          ${d}
        </button>
      `;
    }

    gridEl.innerHTML = html;
  };

  window.selectPickerDate = function (year, month, day) {
    state.calendar.year = year;
    state.calendar.month = month;
    state.calendar.selectedDay = day;
    state.calendar.pickerYear = year;
    state.calendar.pickerMonth = month;

    // Update heading text
    const headingEl = document.getElementById('calendarHeading');
    if (headingEl) {
      headingEl.textContent = `${MONTH_NAMES[month - 1]} ${year}`;
    }

    // Close dropdown
    window.closeCalendarDropdown();

    // Re-render rolling 5-day strip and timeline
    renderCalendarRollingStrip(year, month, day);
    updateCalendarTimeline(year, month, day);

    const monthShort = MONTH_NAMES[month - 1].slice(0, 3);
    window.showToast(`Selected ${monthShort} ${day}, ${year}`);
  };

  // --- Dynamic Rolling 5-Day Strip ---
  function renderCalendarRollingStrip(year, month, selectedDay) {
    const stripEl = document.getElementById('calendarRollingStrip');
    if (!stripEl) return;

    const daysCount = getDaysInMonth(year, month);
    if (selectedDay > daysCount) {
      selectedDay = daysCount;
      state.calendar.selectedDay = selectedDay;
    }

    let startDay;
    if (year === 2026 && month === 9 && selectedDay === 23) {
      startDay = 21; // Match design specs: [21, 22, 23, 24, 25]
    } else {
      startDay = Math.max(1, Math.min(daysCount - 4, selectedDay - 2));
    }

    let pillsHtml = '';
    for (let i = 0; i < 5; i++) {
      const d = startDay + i;
      if (d > daysCount) break;

      const dateObj = new Date(year, month - 1, d);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
      const isActive = d === selectedDay;

      pillsHtml += `
        <div class="calendar-day-pill ${isActive ? 'active' : ''}" onclick="window.selectCalendarDay(${d})" aria-label="${dayName} ${MONTH_NAMES[month - 1]} ${d}">
          <div class="day-pill-name">${dayName}</div>
          <div class="day-pill-num">${d}</div>
        </div>
      `;
    }
    stripEl.innerHTML = pillsHtml;
    if (state.preferences.bionicReading) {
      applyBionicReading(stripEl);
    }
  }

  function getBadgeClass(cat) {
    switch ((cat || '').toLowerCase()) {
      case 'class': return 'badge-class';
      case 'assignment': return 'badge-assign';
      case 'exam': return 'badge-exam';
      case 'rest': return 'badge-break';
      default: return 'badge-personal';
    }
  }

  function updateCalendarTimeline(year, month, day) {
    const eyebrowEl = document.getElementById('calendarTimelineEyebrow');
    const timelineListEl = document.getElementById('calendarTimelineList');
    const upNextBadge = document.getElementById('calendarUpNextBadge');
    const upNextTitle = document.getElementById('calendarUpNextTitle');
    const upNextSub = document.getElementById('calendarUpNextSub');

    const isToday = year === 2026 && month === 9 && day === 23;
    const monthShort = MONTH_NAMES[month - 1].slice(0, 3);
    const dateKey = `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;

    const newEventDateInput = document.getElementById('newEventDate');
    if (newEventDateInput) {
      newEventDateInput.value = dateKey;
    }

    if (eyebrowEl) {
      eyebrowEl.textContent = isToday ? "TODAY'S TIMELINE" : `SCHEDULE FOR ${monthShort.toUpperCase()} ${day}, ${year}`;
      if (state.preferences.bionicReading) applyBionicReading(eyebrowEl);
    }

    if (isToday) {
      if (upNextBadge) upNextBadge.textContent = "In 25 min";
      if (upNextTitle) upNextTitle.textContent = "09:00 — Lecture";
      if (upNextSub) upNextSub.textContent = "Tech Block 2, Room 304";
      if (state.preferences.bionicReading && upNextTitle) {
        applyBionicReading(upNextTitle.parentElement);
      }

      let defaultItemsHtml = `
        <div class="timeline-item">
          <div class="timeline-node"></div>
          <span class="timeline-time">09:00</span>
          <div class="timeline-content-card">
            <div>
              <div style="font-weight: 700; font-size: 14px;">Lecture: Database Systems</div>
              <div style="font-size: 12px; color: var(--text-muted);">Prof. Miller</div>
            </div>
            <span class="badge-tag badge-class">Class</span>
          </div>
        </div>

        <div class="timeline-item">
          <div class="timeline-node"></div>
          <span class="timeline-time">11:00</span>
          <div class="timeline-content-card">
            <div>
              <div style="font-weight: 700; font-size: 14px;">Study: DBMS Queries</div>
              <div style="font-size: 12px; color: var(--text-muted);">Library 2nd Floor</div>
            </div>
            <span class="badge-tag badge-assign">Assignment</span>
          </div>
        </div>

        <div class="timeline-item">
          <div class="timeline-node" style="border-color: #237A3D;"></div>
          <span class="timeline-time">13:00</span>
          <div class="timeline-content-card" style="background: #F4FAF5; border-color: #D3ECD9;">
            <div>
              <div style="font-weight: 700; font-size: 14px;">Lunch & Mindful Break</div>
              <div style="font-size: 12px; color: #237A3D;">Walk outside, recharge mental battery</div>
            </div>
            <span class="badge-tag badge-break">Rest</span>
          </div>
        </div>

        <div class="timeline-item">
          <div class="timeline-node"></div>
          <span class="timeline-time">14:00</span>
          <div class="timeline-content-card">
            <div>
              <div style="font-weight: 700; font-size: 14px;">DBMS Practical Lab</div>
              <div style="font-size: 12px; color: var(--text-muted);">Lab Complex 1</div>
            </div>
            <span class="badge-tag badge-class">Class</span>
          </div>
        </div>

        <div class="timeline-item">
          <div class="timeline-node"></div>
          <span class="timeline-time">17:00</span>
          <div class="timeline-content-card">
            <div>
              <div style="font-weight: 700; font-size: 14px;">Submit Project Draft</div>
              <div style="font-size: 12px; color: var(--text-muted);">Student Portal</div>
            </div>
            <span class="badge-tag badge-personal">Personal</span>
          </div>
        </div>
      `;

      const customEvents = state.calendar.eventsByDate[dateKey] || [];
      customEvents.forEach(evt => {
        defaultItemsHtml += `
          <div class="timeline-item">
            <div class="timeline-node"></div>
            <span class="timeline-time">${evt.time.split(' ')[0]}</span>
            <div class="timeline-content-card">
              <div>
                <div style="font-weight: 700; font-size: 14px;">${evt.title}</div>
                <div style="font-size: 12px; color: var(--text-muted);">${monthShort} ${day} schedule</div>
              </div>
              <span class="badge-tag ${getBadgeClass(evt.category)}">${evt.category}</span>
            </div>
          </div>
        `;
      });

      if (timelineListEl) {
        timelineListEl.innerHTML = defaultItemsHtml;
        if (state.preferences.bionicReading) {
          applyBionicReading(timelineListEl);
        }
      }
      return;
    }

    // Schedule for other dates
    if (upNextBadge) upNextBadge.textContent = "Planned";
    if (upNextTitle) upNextTitle.textContent = "10:00 — Academic Session";
    if (upNextSub) upNextSub.textContent = `Scheduled for ${monthShort} ${day}`;
    if (state.preferences.bionicReading && upNextTitle) {
      applyBionicReading(upNextTitle.parentElement);
    }

    let itemsHtml = `
      <div class="timeline-item">
        <div class="timeline-node"></div>
        <span class="timeline-time">10:00</span>
        <div class="timeline-content-card">
          <div>
            <div style="font-weight: 700; font-size: 14px;">Core Academic Session</div>
            <div style="font-size: 12px; color: var(--text-muted);">Department Lecture Hall</div>
          </div>
          <span class="badge-tag badge-class">Class</span>
        </div>
      </div>

      <div class="timeline-item">
        <div class="timeline-node" style="border-color: #237A3D;"></div>
        <span class="timeline-time">12:30</span>
        <div class="timeline-content-card" style="background: #F4FAF5; border-color: #D3ECD9;">
          <div>
            <div style="font-weight: 700; font-size: 14px;">Mindful Rest & Lunch</div>
            <div style="font-size: 12px; color: #237A3D;">Campus garden, gentle walk</div>
          </div>
          <span class="badge-tag badge-break">Rest</span>
        </div>
      </div>

      <div class="timeline-item">
        <div class="timeline-node"></div>
        <span class="timeline-time">14:00</span>
        <div class="timeline-content-card">
          <div>
            <div style="font-weight: 700; font-size: 14px;">Independent Study & Reading</div>
            <div style="font-size: 12px; color: var(--text-muted);">Quiet Study Commons</div>
          </div>
          <span class="badge-tag badge-assign">Assignment</span>
        </div>
      </div>
    `;

    const customEvents = state.calendar.eventsByDate[dateKey] || [];
    customEvents.forEach(evt => {
      itemsHtml += `
        <div class="timeline-item">
          <div class="timeline-node"></div>
          <span class="timeline-time">${evt.time.split(' ')[0]}</span>
          <div class="timeline-content-card">
            <div>
              <div style="font-weight: 700; font-size: 14px;">${evt.title}</div>
              <div style="font-size: 12px; color: var(--text-muted);">${monthShort} ${day} schedule</div>
            </div>
            <span class="badge-tag ${getBadgeClass(evt.category)}">${evt.category}</span>
          </div>
        </div>
      `;
    });

    if (timelineListEl) {
      timelineListEl.innerHTML = itemsHtml;
      if (state.preferences.bionicReading) {
        applyBionicReading(timelineListEl);
      }
    }
  }

  window.selectCalendarDay = function (dayNum) {
    state.calendar.selectedDay = dayNum;

    const pills = document.querySelectorAll('.calendar-day-pill');
    pills.forEach(p => {
      const numEl = p.querySelector('.day-pill-num');
      if (numEl) {
        const num = parseInt(numEl.textContent, 10);
        p.classList.toggle('active', num === dayNum);
      }
    });

    updateCalendarTimeline(state.calendar.year, state.calendar.month, dayNum);

    const monthShort = MONTH_NAMES[state.calendar.month - 1].slice(0, 3);
    window.showToast(`Showing schedule for ${monthShort} ${dayNum}, ${state.calendar.year}`);
  };

  window.jumpToCalendarToday = function () {
    state.calendar.year = 2026;
    state.calendar.month = 9;
    state.calendar.selectedDay = 23;
    state.calendar.pickerYear = 2026;
    state.calendar.pickerMonth = 9;

    const headingEl = document.getElementById('calendarHeading');
    if (headingEl) {
      headingEl.textContent = 'September 2026';
    }

    window.closeCalendarDropdown();
    renderCalendarRollingStrip(2026, 9, 23);
    updateCalendarTimeline(2026, 9, 23);
    window.showToast('Jumped to Today: Sep 23, 2026');
  };

  // --- Profile & Accessibility Controls: Dynamic Stepper & Font Scaling ---
  const savedFontSize = (function () {
    try {
      const val = localStorage.getItem('neuroflow_font_size');
      return val ? parseInt(val, 10) : null;
    } catch (e) {
      return null;
    }
  })();
  state.preferences.fontSizePx = savedFontSize && !isNaN(savedFontSize) ? Math.max(12, Math.min(24, savedFontSize)) : 16;

  function applyFontScale(currentPx, showFeedback = true) {
    const minPx = 12;
    const maxPx = 24;
    const scale = currentPx / 16;

    // Apply scale to CSS variable on document and appFrame
    document.documentElement.style.setProperty('--font-scale', scale);
    const frame = document.getElementById('appFrame');
    if (frame) {
      frame.style.setProperty('--font-scale', scale);
    }

    // Update display label
    const displayEl = document.getElementById('fontSizeValueDisplay');
    if (displayEl) {
      displayEl.textContent = `${currentPx}px`;
    }

    // Update live preview box text
    const previewGlyph = document.getElementById('fontPreviewGlyph');
    if (previewGlyph) {
      previewGlyph.textContent = `Aa (${currentPx}px)`;
    }

    // Update button visual opacity when at limit
    const minusBtn = document.getElementById('fontSizeMinusBtn');
    const plusBtn = document.getElementById('fontSizePlusBtn');
    if (minusBtn) {
      minusBtn.style.opacity = currentPx <= minPx ? '0.35' : '1';
      minusBtn.disabled = currentPx <= minPx;
    }
    if (plusBtn) {
      plusBtn.style.opacity = currentPx >= maxPx ? '0.35' : '1';
      plusBtn.disabled = currentPx >= maxPx;
    }

    try {
      localStorage.setItem('neuroflow_font_size', currentPx);
    } catch (e) { }

    if (showFeedback) {
      window.showToast(`Font size set to ${currentPx}px across all screens`);
    }
  }

  window.adjustFontSize = function (delta) {
    const minPx = 12;
    const maxPx = 24;
    state.preferences.fontSizePx = Math.max(minPx, Math.min(maxPx, state.preferences.fontSizePx + delta));
    applyFontScale(state.preferences.fontSizePx, true);
  };

  window.setFontFamily = function (family, btn) {
    state.preferences.fontFamily = family;
    if (btn && btn.parentElement) {
      const btns = btn.parentElement.querySelectorAll('.pref-pill-btn');
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }

    document.documentElement.style.setProperty('--font-family', `'${family}', sans-serif`);
    window.showToast(`Applied ${family} font`);
    savePreferencesToStorage();
  };

  window.setTheme = function (theme, btn) {
    state.preferences.theme = theme;
    if (btn && btn.parentElement) {
      const btns = btn.parentElement.querySelectorAll('.pref-pill-btn');
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }

    document.documentElement.setAttribute('data-theme', theme);
    window.showToast(`Theme switched to ${theme.replace('-', ' ')}`);
    savePreferencesToStorage();
  };

  // --- Accessibility Options Toggles ---
  window.toggleBionicReading = function (checked) {
    state.preferences.bionicReading = !!checked;
    document.body.classList.toggle('bionic-reading', state.preferences.bionicReading);

    const toggle = document.getElementById('bionicToggle');
    if (toggle) toggle.checked = state.preferences.bionicReading;

    const appFrame = document.getElementById('appFrame') || document.body;

    // Refresh active screens & tasks
    renderHomeTasks();
    renderMainTasks();
    updateNextStepCard();
    if (typeof updateCalendarTimeline === 'function') {
      updateCalendarTimeline(state.calendar.year, state.calendar.month, state.calendar.selectedDay);
    }
    updateFocusDisplay();

    if (state.preferences.bionicReading) {
      applyBionicReading(document.body);
    } else {
      removeBionicReading(document.body);
    }

    window.showToast(state.preferences.bionicReading ? 'Bionic reading active: Initial letters bolded across workspace' : 'Bionic reading disabled');
    savePreferencesToStorage();
  };

  window.toggleReduceMotion = function (checked) {
    state.preferences.reduceMotion = !!checked;
    document.body.classList.toggle('reduce-motion', state.preferences.reduceMotion);

    const toggle = document.getElementById('reduceMotionToggle');
    if (toggle) toggle.checked = state.preferences.reduceMotion;

    window.showToast(state.preferences.reduceMotion ? 'Reduced motion active: Animations disabled for vestibular comfort' : 'Standard motion restored');
    savePreferencesToStorage();
  };

  window.toggleReduceClutter = function (checked) {
    state.preferences.reduceClutter = !!checked;
    document.body.classList.toggle('reduce-clutter', state.preferences.reduceClutter);

    const toggle = document.getElementById('reduceClutterToggle');
    if (toggle) toggle.checked = state.preferences.reduceClutter;

    renderHomeTasks();
    renderMainTasks();

    window.showToast(state.preferences.reduceClutter ? 'Visual clutter reduced: Non-essential decorative elements hidden' : 'Standard visual layout restored');
    savePreferencesToStorage();
  };

  window.adjustDuration = function (type, change) {
    if (type === 'focus') {
      state.preferences.focusDuration = Math.max(5, Math.min(60, state.preferences.focusDuration + change));
      const el = document.getElementById('focusDurationValue');
      if (el) el.textContent = `${state.preferences.focusDuration} min`;
    } else {
      state.preferences.breakDuration = Math.max(1, Math.min(20, state.preferences.breakDuration + change));
      const el = document.getElementById('breakDurationValue');
      if (el) el.textContent = `${state.preferences.breakDuration} min`;
    }
    savePreferencesToStorage();
  };

  window.setReminderStyle = function (style, btn) {
    state.preferences.reminderStyle = style;
    if (btn && btn.parentElement) {
      const btns = btn.parentElement.querySelectorAll('.pref-pill-btn');
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    }
    savePreferencesToStorage();
  };

  function savePreferencesToStorage() {
    const prefs = {
      fontSizePx: state.preferences.fontSizePx,
      fontFamily: state.preferences.fontFamily,
      theme: state.preferences.theme,
      bionicReading: !!state.preferences.bionicReading,
      reduceMotion: !!state.preferences.reduceMotion,
      reduceClutter: !!state.preferences.reduceClutter,
      focusDuration: state.preferences.focusDuration,
      breakDuration: state.preferences.breakDuration,
      reminderStyle: state.preferences.reminderStyle
    };
    try {
      localStorage.setItem('neuroflow_preferences', JSON.stringify(prefs));
      localStorage.setItem('neuroflow_font_size', state.preferences.fontSizePx);
    } catch (e) { }
  }

  function loadPreferencesFromStorage() {
    try {
      const raw = localStorage.getItem('neuroflow_preferences');
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved) {
          if (typeof saved.bionicReading === 'boolean') state.preferences.bionicReading = saved.bionicReading;
          if (typeof saved.reduceMotion === 'boolean') state.preferences.reduceMotion = saved.reduceMotion;
          if (typeof saved.reduceClutter === 'boolean') state.preferences.reduceClutter = saved.reduceClutter;
          if (saved.fontSizePx) state.preferences.fontSizePx = saved.fontSizePx;
          if (saved.fontFamily) state.preferences.fontFamily = saved.fontFamily;
          if (saved.theme) state.preferences.theme = saved.theme;
          if (saved.focusDuration) state.preferences.focusDuration = saved.focusDuration;
          if (saved.breakDuration) state.preferences.breakDuration = saved.breakDuration;
          if (saved.reminderStyle) state.preferences.reminderStyle = saved.reminderStyle;
        }
      } else {
        // Respect OS-level prefers-reduced-motion as smart accessible default
        if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
          state.preferences.reduceMotion = true;
        }
      }
    } catch (e) { }

    // Apply classes to body
    document.body.classList.toggle('bionic-reading', !!state.preferences.bionicReading);
    document.body.classList.toggle('reduce-motion', !!state.preferences.reduceMotion);
    document.body.classList.toggle('reduce-clutter', !!state.preferences.reduceClutter);

    if (state.preferences.theme) {
      document.documentElement.setAttribute('data-theme', state.preferences.theme);
    }
    if (state.preferences.fontFamily) {
      document.documentElement.style.setProperty('--font-family', `'${state.preferences.fontFamily}', sans-serif`);
    }

    if (state.preferences.bionicReading) {
      applyBionicReading(document.body);
    }

    syncProfileUI();
  }

  function syncProfileUI() {
    // Sync checkboxes
    const bionicToggle = document.getElementById('bionicToggle');
    if (bionicToggle) bionicToggle.checked = !!state.preferences.bionicReading;

    const reduceMotionToggle = document.getElementById('reduceMotionToggle');
    if (reduceMotionToggle) reduceMotionToggle.checked = !!state.preferences.reduceMotion;

    const reduceClutterToggle = document.getElementById('reduceClutterToggle');
    if (reduceClutterToggle) reduceClutterToggle.checked = !!state.preferences.reduceClutter;

    // Sync Steppers
    const focusVal = document.getElementById('focusDurationValue');
    if (focusVal) focusVal.textContent = `${state.preferences.focusDuration} min`;

    const breakVal = document.getElementById('breakDurationValue');
    if (breakVal) breakVal.textContent = `${state.preferences.breakDuration} min`;

    const fontVal = document.getElementById('fontSizeValueDisplay');
    if (fontVal) fontVal.textContent = `${state.preferences.fontSizePx}px`;

    // Sync Pills
    const allPrefBtns = document.querySelectorAll('#screen-profile .pref-pill-btn');
    allPrefBtns.forEach(btn => {
      const oc = btn.getAttribute('onclick') || '';
      if (oc.includes('setFontFamily')) {
        btn.classList.toggle('active', oc.includes(`'${state.preferences.fontFamily}'`));
      } else if (oc.includes('setTheme')) {
        btn.classList.toggle('active', oc.includes(`'${state.preferences.theme}'`));
      } else if (oc.includes('setReminderStyle')) {
        btn.classList.toggle('active', oc.includes(`'${state.preferences.reminderStyle}'`));
      }
    });
  }

  window.savePreferences = function () {
    savePreferencesToStorage();
    window.showToast('Accessibility preferences saved successfully! ✓');
  };

  // --- Password Reveal Toggles ---
  const togglePassBtn = document.getElementById('togglePasswordBtn');
  const passInput = document.getElementById('loginPassword');
  if (togglePassBtn && passInput) {
    togglePassBtn.addEventListener('click', () => {
      const isPass = passInput.getAttribute('type') === 'password';
      passInput.setAttribute('type', isPass ? 'text' : 'password');
      togglePassBtn.setAttribute('aria-label', isPass ? 'Hide password' : 'Show password');
    });
  }

  const toggleSignupPassBtn = document.getElementById('toggleSignupPasswordBtn');
  const signupPassInput = document.getElementById('signupPassword');
  if (toggleSignupPassBtn && signupPassInput) {
    toggleSignupPassBtn.addEventListener('click', () => {
      const isPass = signupPassInput.getAttribute('type') === 'password';
      signupPassInput.setAttribute('type', isPass ? 'text' : 'password');
      toggleSignupPassBtn.setAttribute('aria-label', isPass ? 'Hide password' : 'Show password');
    });
  }

  // --- Static Login Password Validation ---
  window.handleLoginSubmit = function () {
    const emailInput = document.getElementById('loginEmail');
    const passInput = document.getElementById('loginPassword');
    const errorEl = document.getElementById('loginPasswordError');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value : '';

    // Clear previous error
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }
    if (passInput) passInput.classList.remove('input-error');

    if (!email) {
      if (emailInput) emailInput.focus();
      window.showToast('Please enter your email.');
      return;
    }

    if (!password || password.length < 6) {
      if (errorEl) {
        errorEl.textContent = 'Password must be at least 6 characters.';
        errorEl.style.display = 'block';
      }
      if (passInput) {
        passInput.classList.add('input-error');
        passInput.focus();
      }
      return;
    }

    // Static validation passed
    window.showToast('Welcome back, Alex!');
    window.navigateTo('home');
  };

  // --- Static Sign Up Form Handler ---
  window.handleSignupSubmit = function () {
    const nameInput = document.getElementById('signupName');
    const emailInput = document.getElementById('signupEmail');
    const passInput = document.getElementById('signupPassword');
    const errorEl = document.getElementById('signupPasswordError');

    const name = nameInput ? nameInput.value.trim() : 'Alex';
    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value : '';

    // Clear previous error
    if (errorEl) {
      errorEl.style.display = 'none';
      errorEl.textContent = '';
    }
    if (passInput) passInput.classList.remove('input-error');

    if (!password || password.length < 6) {
      if (errorEl) {
        errorEl.textContent = 'Password must be at least 6 characters.';
        errorEl.style.display = 'block';
      }
      if (passInput) {
        passInput.classList.add('input-error');
        passInput.focus();
      }
      return;
    }

    // Update personalized greeting
    const firstName = name.split(' ')[0] || 'Alex';
    const greetingEl = document.getElementById('homeHeading');
    if (greetingEl) {
      greetingEl.textContent = `Good morning, ${firstName} 👋`;
    }

    window.showToast(`Account created! Welcome, ${firstName}.`);
    window.navigateTo('home');
  };

  // --- Google Auth Simulation (Short Error Handling) ---
  window.handleGoogleAuth = function (isSignup = true) {
    const errorId = isSignup ? 'signupGoogleError' : 'loginGoogleError';
    const errorEl = document.getElementById(errorId);
    if (errorEl) {
      errorEl.style.display = 'block';
    }
    const msg = isSignup
      ? 'Google Sign-Up is unavailable in this prototype. Please register using email.'
      : 'Google Sign-In is unavailable in this prototype. Please use email.';
    window.showToast(msg);
  };

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
      } catch (e) { }
      state.audio.noiseNode = null;
    }
  }

  // --- Modal Helpers ---
  window.openModal = function (modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      if (state.preferences.bionicReading) {
        applyBionicReading(modal);
      }
    }
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
    // Load persisted accessibility preferences & options
    loadPreferencesFromStorage();

    // Start universal Bionic Reading observer
    initBionicObserver();

    // Initialize Calendar Rolling Strip and Datepicker
    if (typeof renderCalendarRollingStrip === 'function') {
      renderCalendarRollingStrip(state.calendar.year, state.calendar.month, state.calendar.selectedDay);
    }

    // Close calendar dropdown when clicking outside
    document.addEventListener('click', (e) => {
      const trigger = document.getElementById('calendarDropdownTrigger');
      const dropdown = document.getElementById('calendarDatePickerDropdown');
      if (dropdown && state.calendar && state.calendar.isOpen) {
        if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
          window.closeCalendarDropdown();
        }
      }
    });

    // Apply saved or default font size immediately across all pages
    if (typeof applyFontScale === 'function') {
      applyFontScale(state.preferences.fontSizePx, false);
    }

    // Quick accessibility button on login navigates to profile
    const a11yBtn = document.getElementById('loginA11yBtn');
    if (a11yBtn) {
      a11yBtn.onclick = () => window.navigateTo('profile');
    }

    // Default start screen
    window.navigateTo('home');
    updateNextStepCard();
  });

})();
