// --- PEER-TO-PEER STATE ---
let peer = null;
let connections = []; 
const urlParams = new URLSearchParams(window.location.search);
const spectateId = urlParams.get('game');
const isSpectator = !!spectateId;

function initP2P() {
    if (isSpectator) {
        document.body.classList.add('spectator-mode');
        peer = new Peer(); 
        peer.on('open', (id) => {
            const conn = peer.connect(spectateId);
            setupConnection(conn);
        });
        // This ensures the spectator's local game remains separate
        console.log("Viewing remote game: " + spectateId);
    } else {
        peer = new Peer();
        peer.on('open', (id) => {
            localStorage.setItem('my_peer_id', id);
        });
        peer.on('connection', (conn) => {
            connections.push(conn);
            sendUpdateToSpectators(conn); // Sync them immediately
        });
    }
}

function setupConnection(conn) {
    conn.on('data', (data) => {
        // Sync all incoming data
        game = data.game;
        gameLog = data.gameLog;
        pitchData = data.pitchData;
        timer = data.timer;
        
        // Update Team Names for Spectator
        const awayLabel = document.getElementById('away-label');
        const homeLabel = document.getElementById('home-label');
        if (awayLabel) awayLabel.innerText = data.teamAway || "AWAY";
        if (homeLabel) homeLabel.innerText = data.teamHome || "HOME";
        
        // Refresh UI
        updateUI();
        renderLog();
        renderPitchUI();
        updateTimerDisplay();
    });
}

function broadcastUpdate() {
    if (isSpectator || (connections && connections.length === 0)) return;
    
    const packet = {
        game: game,
        gameLog: gameLog,
        pitchData: pitchData,
        timer: timer,
        teamAway: localStorage.getItem('team_away'),
        teamHome: localStorage.getItem('team_home')
    };

    connections.forEach(conn => {
        if (conn.open) {
            conn.send(packet);
        }
    });
}

function sendUpdateToSpectators(conn) {
    conn.send({
        game: game,
        gameLog: gameLog,
        pitchData: pitchData,
        timer: timer,
        teamAway: localStorage.getItem('team_away') || "AWAY",
        teamHome: localStorage.getItem('team_home') || "HOME"
    });
}

function generateSpectatorLink() {
    const myId = localStorage.getItem('my_peer_id');
    const url = window.location.origin + window.location.pathname + "?game=" + myId;
    
    // Copy to clipboard (you already have a copy function, just use that logic)
    navigator.clipboard.writeText(url);
    alert("Spectator link copied! Keep this tab open to host.");
}

// Initialize game state from localStorage or defaults
let game = JSON.parse(localStorage.getItem('diamond_tracker_game')) || { 
    away: 0, 
    home: 0, 
    inning: 1, 
    top: true, 
    outs: 0 
};

let gameLog = JSON.parse(localStorage.getItem('diamond_tracker_log')) || [];
let currentThemeIndex = parseInt(localStorage.getItem('diamond_tracker_theme')) || 0;
let isClearing = false;

// Timer State
let timer = JSON.parse(localStorage.getItem('diamond_tracker_timer')) || { 
    startTime: null, 
    baseSeconds: 0, 
    running: false 
};
let timerInterval = null;

// Wake Lock State
let wakeLock = null;
let wakeLockEnabled = localStorage.getItem('diamond_tracker_wakelock') === 'true';

// Pitch Counter State
let pitchData = JSON.parse(localStorage.getItem('diamond_tracker_pitch')) || { 
    mode: 'off', 
    simple: 0, 
    balls: 0, 
    strikes: 0 
};

// Touch tracking for swipe-to-close
let touchStartY = 0;
let touchEndY = 0;

function saveAll() {
    // Spectators should never save to their own localStorage 
    // while viewing someone else's game.
    if (isSpectator) return; 

    localStorage.setItem('diamond_tracker_game', JSON.stringify(game));
    localStorage.setItem('diamond_tracker_log', JSON.stringify(gameLog));
    localStorage.setItem('diamond_tracker_theme', currentThemeIndex);
    localStorage.setItem('diamond_tracker_timer', JSON.stringify(timer));
    localStorage.setItem('diamond_tracker_pitch', JSON.stringify(pitchData));
    
    // Trigger the P2P broadcast
    broadcastUpdate();
}

const themes = [
    // The original Dark Blue (Slate) - Retained
    { name: "slate", bg: "#1d2d44", glass: "rgba(13, 19, 33, 0.7)", accent: "#e6e4ce", primary: "#748cab", btnText: "#fff" },
    
    // 1. CLASSIC BALLPARK (Deep Grass & Chalk)
    { name: "ballpark", bg: "#064e3b", glass: "rgba(0, 0, 0, 0.4)", accent: "#ecfdf5", primary: "#10b981", btnText: "#fff" },
    
    // 2. SUNSET LEAGUE (Deep Purple & Orange - Great for glare)
    { name: "sunset", bg: "#2d0a31", glass: "rgba(0, 0, 0, 0.3)", accent: "#fb923c", primary: "#f97316", btnText: "#fff" },
    
    // 3. MIDNIGHT NEON (Black & Electric Cyan)
    { name: "neon", bg: "#000000", glass: "rgba(20, 20, 20, 0.8)", accent: "#22d3ee", primary: "#0891b2", btnText: "#fff" },
    
    // 4. THE UMPIRE (High Contrast Black & White)
    { name: "umpire", bg: "#0f172a", glass: "rgba(255, 255, 255, 0.1)", accent: "#ffffff", primary: "#475569", btnText: "#fff" },
    
    // 5. DIRTY DIAMOND (Earth Brown & Gold)
    { name: "diamond", bg: "#451a03", glass: "rgba(0, 0, 0, 0.4)", accent: "#fde047", primary: "#a16207", btnText: "#fff" },
    
    // 6. POLARIZED OCEAN (Deep Teal & White)
    { name: "ocean", bg: "#164e63", glass: "rgba(8, 51, 68, 0.6)", accent: "#cffafe", primary: "#22d3ee", btnText: "#000" },
    
    // 7. RETRO TURF (Bright Green & Navy)
    { name: "retro", bg: "#1e3a8a", glass: "rgba(30, 58, 138, 0.5)", accent: "#4ade80", primary: "#166534", btnText: "#fff" },
    
    // 8. RED ZONE (Deep Maroon & Bright Red)
    { name: "redzone", bg: "#450a0a", glass: "rgba(0, 0, 0, 0.4)", accent: "#f87171", primary: "#b91c1c", btnText: "#fff" },
    
    // 9. VOLT EDGE (Charcoal & Neon Lime - Best for extreme sun)
    { name: "volt", bg: "#171717", glass: "rgba(0, 0, 0, 0.6)", accent: "#bef264", primary: "#65a30d", btnText: "#000" },
    
    // 10. ROYAL GOLD (Navy & Yellow Gold)
    { name: "royal", bg: "#1e1b4b", glass: "rgba(0, 0, 0, 0.3)", accent: "#fbbf24", primary: "#4338ca", btnText: "#fff" },
    
    // 11. CYBERPUNK (Deep Violet & Hot Pink)
    { name: "cyber", bg: "#2e1065", glass: "rgba(0, 0, 0, 0.4)", accent: "#f472b6", primary: "#db2777", btnText: "#fff" },
    
    // 12. STEEL CITY (Steel Grey & High-Vis Yellow)
    { name: "steel", bg: "#262626", glass: "rgba(255, 255, 255, 0.05)", accent: "#fbbf24", primary: "#525252", btnText: "#fff" }
];

function applyTheme() {
    const t = themes[currentThemeIndex];
    const root = document.documentElement;
    root.style.setProperty('--bg-color', t.bg);
    root.style.setProperty('--glass-bg', t.glass);
    root.style.setProperty('--text-accent', t.accent);
    root.style.setProperty('--btn-primary', t.primary);
    root.style.setProperty('--btn-text', t.btnText);
}

function cycleTheme() {
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    applyTheme();
    saveAll();
}

function updateScore(team, delta) {
    if (isSpectator) return; 
    game[team] = Math.max(0, game[team] + delta);
    saveAll();
    updateUI();
    broadcastUpdate(); // Add this line!
}

function morphNumber(team, newVal) {
    const blurNode = document.getElementById(`blur-${team}`);
    const zone = document.querySelector(`.${team}-filter`);
    if (!blurNode || !zone) return;

    const oldScores = zone.querySelectorAll('.score-display');
    oldScores.forEach((el, index) => { if (index < oldScores.length - 1) el.remove(); });
    
    const oldDisplay = Array.from(oldScores).pop();
    animateBlur(blurNode, 0, 10, 400);
    
    const newDisplay = document.createElement('div');
    newDisplay.className = 'score-display enter';
    newDisplay.id = `${team}-score`; 
    newDisplay.innerText = newVal;
    zone.appendChild(newDisplay);
    
    setTimeout(() => {
        if (oldDisplay) {
            oldDisplay.classList.add('exit');
            oldDisplay.removeAttribute('id'); 
        }
        newDisplay.classList.remove('enter');
    }, 50);
    
    setTimeout(() => { animateBlur(blurNode, 10, 0, 500); }, 450);
    setTimeout(() => { if (oldDisplay) oldDisplay.remove(); }, 1100);
}

function animateBlur(element, start, end, duration) {
    let startTime = null;
    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        let progress = (timestamp - startTime) / duration;
        if (progress > 1) progress = 1;
        let current = start + (end - start) * progress;
        element.setAttribute('stdDeviation', current);
        if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
}

function handleOutClick(e) {
    if (isClearing) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    if (x < rect.width / 3) removeOut();
    else addOut();
}

function removeOut() {
    if (game.outs > 0) {
        game.outs--;
        updateUI();
        saveAll();
    }
}

function addOut() {
    if (isSpectator) return;

    game.outs++;
    if (game.outs >= 3) {
        game.outs = 0;
        game.top = !game.top;
        if (game.top) game.inning++;
    }
    saveAll();
    updateUI();
    broadcastUpdate();
}

function sequentialReset() {
    const dots = document.querySelectorAll('.dot');
    if (dots.length < 3) return;
    setTimeout(() => { dots[2].classList.remove('active'); }, 0);
    setTimeout(() => { dots[1].classList.remove('active'); }, 200);
    setTimeout(() => { 
        dots[0].classList.remove('active'); 
        setTimeout(() => {
            game.outs = 0;
            if (game.top) { game.top = false; } else { game.top = true; game.inning++; }
            isClearing = false;
            updateUI(true);
            saveAll();
        }, 300);
    }, 400);
}

function changeInning(dir) {
    if (isClearing) return;
    if (dir === 1) {
        if (game.top) game.top = false;
        else { game.top = true; game.inning++; }
    } else {
        if (!game.top) game.top = true;
        else if (game.inning > 1) { game.top = false; game.inning--; }
    }
    updateUI(true); 
    saveAll();
}

function updateUI(shouldAnimate = false) {
    const inningText = document.getElementById('inning-text');
    const render = () => {
        const inNum = document.getElementById('inning-num');
        const inHalf = document.getElementById('inning-half');
        const awayC = document.getElementById('away-card');
        const homeC = document.getElementById('home-card');
        const awayS = document.getElementById('away-score');
        const homeS = document.getElementById('home-score');

        if (inNum) inNum.innerText = game.inning;
        if (inHalf) inHalf.innerText = game.top ? 'TOP' : 'BOTTOM';
        if (awayC) awayC.classList.toggle('batting-now', game.top);
        if (homeC) homeC.classList.toggle('batting-now', !game.top);
        if (awayS) awayS.innerText = game.away;
        if (homeS) homeS.innerText = game.home;
        
        if (!isClearing) {
            document.querySelectorAll('.dot').forEach((d, i) => {
                d.classList.toggle('active', i < game.outs);
            });
        }
    };

    if (shouldAnimate && inningText) {
        inningText.classList.add('slide-out');
        setTimeout(() => {
            render();
            inningText.classList.remove('slide-out');
            inningText.classList.add('slide-in');
            setTimeout(() => { inningText.classList.remove('slide-in'); }, 50);
        }, 300);
    } else { render(); }
}

function toggleTimer() {
    if (timer.running) {
        timer.baseSeconds += Math.floor((Date.now() - timer.startTime) / 1000);
        timer.running = false;
        timer.startTime = null;
        clearInterval(timerInterval);
    } else {
        timer.running = true;
        timer.startTime = Date.now();
        startInterval();
    }
    saveAll();
}

function resetTimer() {
    if (confirm("Reset the game timer to zero?")) {
        timer = { startTime: null, baseSeconds: 0, running: false };
        if (timerInterval) clearInterval(timerInterval);
        updateTimerDisplay();
        saveAll();
    }
}

function startInterval() {
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    let totalSeconds = timer.baseSeconds;
    if (timer.running && timer.startTime) {
        const elapsedSinceStart = Math.floor((Date.now() - timer.startTime) / 1000);
        totalSeconds += elapsedSinceStart;
    }
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    const pad = (n) => n.toString().padStart(2, '0');
    const display = document.getElementById('timer-display');
    if (display) display.innerText = `${pad(h)}:${pad(m)}:${pad(s)}`;
}

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            updateWakeLockUI(true);
        } catch (err) {
            wakeLockEnabled = false;
            updateWakeLockUI(false);
        }
    }
}

async function releaseWakeLock() {
    if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
        updateWakeLockUI(false);
    }
}

function toggleWakeLock() {
    wakeLockEnabled = !wakeLockEnabled;
    if (wakeLockEnabled) requestWakeLock();
    else releaseWakeLock();
    saveAll();
}

function updateWakeLockUI(isActive) {
    const btn = document.getElementById('wakelock-btn');
    const icon = document.getElementById('lock-icon');
    if (!btn || !icon) return;
    if (isActive) {
        btn.classList.add('active');
        icon.innerHTML = '<path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>';
    } else {
        btn.classList.remove('active');
        icon.innerHTML = '<path d="M12 17c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm6-9h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z"/>';
    }
}

function togglePitchMode() {
    if (pitchData.mode === 'off') pitchData.mode = 'simple';
    else if (pitchData.mode === 'simple') pitchData.mode = 'advanced';
    else pitchData.mode = 'off';
    renderPitchUI();
    saveAll();
}

function updatePitch(type, val) {
    if (isSpectator) return; // Add this line!
    if (pitchData.mode === 'off') return;
    pitchData[type] = Math.max(0, pitchData[type] + val);
    saveAll();
    renderPitchUI();
    broadcastUpdate(); // Add this line!
}

function renderPitchUI() {
    const card = document.getElementById('pitch-card');
    const simpleView = document.getElementById('pitch-simple');
    const advView = document.getElementById('pitch-advanced');
    const toggleBtn = document.getElementById('pitch-toggle-btn');
    const modeIndicator = document.getElementById('pitch-mode-indicator');
    if (pitchData.mode === 'off') {
        card.style.display = 'none';
        toggleBtn.classList.remove('active');
        modeIndicator.innerText = 'OFF';
    } else {
        card.style.display = 'block';
        toggleBtn.classList.add('active');
        if (pitchData.mode === 'simple') {
            modeIndicator.innerText = 'SMP';
            simpleView.style.display = 'block';
            advView.style.display = 'none';
            document.getElementById('simple-pitch-count').innerText = pitchData.simple;
        } else {
            modeIndicator.innerText = 'ADV';
            simpleView.style.display = 'none';
            advView.style.display = 'block';
            document.getElementById('adv-balls').innerText = pitchData.balls;
            document.getElementById('adv-strikes').innerText = pitchData.strikes;
            const total = pitchData.balls + pitchData.strikes;
            document.getElementById('adv-total').innerText = total;
            let pct = total > 0 ? Math.round((pitchData.strikes / total) * 100) : 0;
            document.getElementById('adv-percent').innerText = pct + '%';
        }
    }
}

function toggleDrawer(open) {
    const drawer = document.getElementById('drawer-overlay');
    if (!drawer) return;
    drawer.classList.toggle('active', open);
    if(open) {
        document.getElementById('edit-away').value = localStorage.getItem('team_away') || "";
        document.getElementById('edit-home').value = localStorage.getItem('team_home') || "";
    }
}

function setupSwipeToClose() {
    const drawerContent = document.querySelector('.drawer-content');
    if (!drawerContent) return;
    drawerContent.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
    drawerContent.addEventListener('touchend', (e) => { touchEndY = e.changedTouches[0].clientY; handleSwipeGesture(); }, { passive: true });
}

function handleSwipeGesture() {
    if (touchEndY - touchStartY > 100) toggleDrawer(false);
}

function updateTeamName(team, name) {
    const label = document.getElementById(`${team}-label`);
    if (label) label.innerText = name.trim() === "" ? (team === 'away' ? 'AWAY' : 'HOME') : name.toUpperCase();
    localStorage.setItem(`team_${team}`, name);
}

function confirmReset() {
    if (confirm("Are you sure you want to start a new game?")) {
        localStorage.clear();
        game = { away: 0, home: 0, inning: 1, top: true, outs: 0 };
        gameLog = [];
        timer = { startTime: null, baseSeconds: 0, running: false };
        pitchData = { mode: pitchData.mode, simple: 0, balls: 0, strikes: 0 };
        clearInterval(timerInterval);
        morphNumber('away', 0);
        morphNumber('home', 0);
        renderLog();
        updateUI(true);
        updateTimerDisplay();
        updateWakeLockUI(false);
        renderPitchUI();
        document.getElementById('edit-away').value = "";
        document.getElementById('edit-home').value = "";
        updateTeamName('away', "");
        updateTeamName('home', "");
        toggleDrawer(false);
        saveAll();
    }
}

function handleHitTypeChange() {
    const hitType = document.getElementById('log-type').value;
    const locationSelect = document.getElementById('log-location');
    const nonSpatial = ["walk", "hbp", "strikeout"];
    locationSelect.disabled = nonSpatial.includes(hitType);
    if (locationSelect.disabled) locationSelect.selectedIndex = 0;
}

function addHitLog() {
    const playerName = document.getElementById('log-player').value.trim();
    const hitType = document.getElementById('log-type').value;
    const location = document.getElementById('log-location').value;
    if (!playerName || !hitType) return alert("Name and Hit Type required");
    let logEntry = "";
    if (hitType === "strikeout") logEntry = `${playerName} struck out.`;
    else if (hitType === "walk") logEntry = `${playerName} walked.`;
    else if (hitType === "hbp") logEntry = `${playerName} was hit by a pitch.`;
    else if (hitType === "groundout") logEntry = `${playerName} grounded out to ${location}.`;
    else if (hitType === "popout") logEntry = `${playerName} popped out to ${location}.`;
    else if (hitType === "flyout") logEntry = `${playerName} flied out to ${location}.`;
    else if (hitType === "lineout") logEntry = `${playerName} lined out to ${location}.`;
    else if (hitType === "homerun") logEntry = `${playerName} hit a homerun to ${location}.`;
    else if (hitType === "single") logEntry = `${playerName} hit a single to ${location}.`;
    else if (hitType === "double") logEntry = `${playerName} hit a double to ${location}.`;
    else if (hitType === "triple") logEntry = `${playerName} hit a triple to ${location}.`;
    gameLog.unshift({ text: logEntry, inning: game.inning, top: game.top });
    renderLog();
    saveAll();
    document.getElementById('log-player').value = "";
    document.getElementById('log-type').selectedIndex = 0;
    document.getElementById('log-location').selectedIndex = 0;
}

function addLog(play) {
    if (isSpectator) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logEntry = {
        play,
        score: `${game.away}-${game.home}`,
        inning: `${game.top ? 'Top' : 'Bot'} ${game.inning}`,
        time: timestamp
    };
    gameLog.unshift(logEntry);
    renderLog();
    saveAll();
    broadcastUpdate();
}

function renderLog() {
    const container = document.getElementById('hit-log-container');
    if (!container) return;
    if (gameLog.length === 0) {
        container.innerHTML = '<div class="log-empty">No plays recorded.</div>';
        return;
    }
    container.innerHTML = gameLog.map(play => `
        <div class="log-item">
            <div class="play-info">${play.text}</div>
            <div class="play-meta">${play.top ? 'T' : 'B'}${play.inning}</div>
        </div>
    `).join('');
}

function toggleShareMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById('share-menu');
    if (menu) menu.classList.toggle('active');
}

function shareTo(platform) {
    const h = document.getElementById("home-label").textContent;
    const a = document.getElementById("away-label").textContent;
    const scoreText = `Current Score: ${a} ${game.away}, ${h} ${game.home} (${game.top ? 'Top' : 'Bottom'} ${game.inning})`;
    switch(platform) {
        case 'text': window.location.href = `sms:?&body=${encodeURIComponent(scoreText)}`; break;
        case 'email': window.location.href = `mailto:?subject=Baseball Update&body=${encodeURIComponent(scoreText)}`; break;
        case 'copyLink': copyToClipboard(window.location.href, "Link Copied!"); break;
        case 'copyGameRecap': copyToClipboard(generateGameRecap(), "Full Recap Copied!"); break;
        case 'generateSimpleRecap': copyToClipboard(scoreText, "Score Copied!"); break;
    }
}

function copyToClipboard(text, message) {
    navigator.clipboard.writeText(text).then(() => {
        const btn = document.querySelector('.share-toggle');
        if (!btn) return;
        const original = btn.innerHTML;
        btn.innerHTML = `<span style="font-size:10px;">COPIED!</span>`;
        setTimeout(() => { btn.innerHTML = original; }, 2000);
    });
}

// --- MEGA ORGANIC RECAP LOGIC ---

function getInningSuffix(inning) {
    if (inning % 10 === 1 && inning % 100 !== 11) return inning + "st";
    if (inning % 10 === 2 && inning % 100 !== 12) return inning + "nd";
    if (inning % 10 === 3 && inning % 100 !== 13) return inning + "rd";
    return inning + "th";
}

function generateGameRecap() {
    const homeTeamName = document.getElementById("home-label").textContent;
    const awayTeamName = document.getElementById("away-label").textContent;
    const homeScore = game.home;
    const awayScore = game.away;
    const inning = game.inning;
    const topOfInning = game.top;
    const outs = game.outs;
    const hitLogs = gameLog.map(l => l.text);
    
    let recap = "";
    const runDifferential = Math.abs(homeScore - awayScore);
    let winningTeam, losingTeam, winningScore, losingScore;

    // Determine winning/losing teams
    if (homeScore > awayScore) {
        winningTeam = homeTeamName; losingTeam = awayTeamName;
        winningScore = homeScore; losingScore = awayScore;
    } else if (awayScore > homeScore) {
        winningTeam = awayTeamName; losingTeam = homeTeamName;
        winningScore = awayScore; losingScore = homeScore;
    }

    // 1. INTRO / SCORE SUMMARY
    if (homeScore === awayScore) {
        const tieOutcomes = [
            `Folks, we've got ourselves a deadlock. ${homeTeamName} and ${awayTeamName} are tied at ${homeScore} runs apiece.`,
            `This one's a real seesaw battle! Things are knotted up at ${homeScore}.`,
            `It's all square here. Neither side is giving an inch with the score at ${homeScore} to ${homeScore}.`,
            `We're in the thick of a classic pitcher's duel, tied up at ${homeScore}.`,
            `A high-tension stalemate! Both squads have put up ${homeScore} runs so far.`
        ];
        recap = tieOutcomes[Math.floor(Math.random() * tieOutcomes.length)] + " ";
    } else {
        let scoreDescription;
        if (runDifferential === 1) {
            scoreDescription = [
                `Talk about a close one! The ${winningTeam} are squeaking by the ${losingTeam} by just a run.`,
                `It's a nail-biter! The ${winningTeam} are clinging to a one-run lead.`,
                `Just a sliver of daylight! The ${winningTeam} lead ${losingTeam} by a single run.`,
                `The tension is palpable as the ${winningTeam} hold onto a slim 1-run advantage.`
            ][Math.floor(Math.random() * 4)];
        } else if (runDifferential === 2) {
            scoreDescription = [
                `The ${winningTeam} are holding a slight advantage, up by a couple of runs.`,
                `A two-run cushion for the ${winningTeam} as they lead the ${losingTeam}.`,
                `The ${winningTeam} are up by two, but this game is far from over.`,
                `Two runs separate these teams, with the ${winningTeam} currently in front.`
            ][Math.floor(Math.random() * 4)];
        } else if (runDifferential <= 4) {
            scoreDescription = [
                `The ${winningTeam} have a bit of breathing room, leading by ${runDifferential}.`,
                `A solid advantage for the ${winningTeam}, they're in control of this contest.`,
                `The ${winningTeam} are extending their lead, now up by ${runDifferential} runs.`,
                `The ${losingTeam} have some work to do, trailing the ${winningTeam} by ${runDifferential}.`
            ][Math.floor(Math.random() * 4)];
        } else {
            scoreDescription = [
                `And it's a blowout! The ${winningTeam} are dominating, leading by a whopping ${runDifferential} runs.`,
                `This one's getting out of hand! The ${winningTeam} are crushing the ${losingTeam}.`,
                `It's a lopsided affair! The ${winningTeam} have a commanding ${runDifferential}-run lead.`,
                `The ${winningTeam} are absolutely dismantling the competition today.`
            ][Math.floor(Math.random() * 4)];
        }
        recap = `${scoreDescription} The scoreboard shows ${winningScore} to ${losingScore}.\n`;
    }

    // 2. HIT LOG / HIGHLIGHTS
    const filteredHitLogs = hitLogs.filter(log => log.trim().length > 0).slice(0, 4);
    if (filteredHitLogs.length > 0) {
        const highlightIntros = [
            `Alright, let's recap some of the action:`,
            `Here's a look at the key moments so far:`,
            `Some significant plays to report:`,
            `The highlight reel is starting to fill up:`,
            `Looking back at the recent plays:`
        ];
        recap += `\n` + highlightIntros[Math.floor(Math.random() * highlightIntros.length)] + `\n`;
        recap += filteredHitLogs.map(log => ` - ${log}`).join('\n') + `\n`;
    } else {
        recap += `\nThings have been pretty quiet on the stat sheet, with minimal highlights to report.\n`;
    }

    // 3. INNING & OUTS (THE SITUATION)
    const suffix = getInningSuffix(inning);
    const half = topOfInning ? 'top' : 'bottom';
    let inningDescription;

    switch (outs) {
        case 0:
            inningDescription = [
                `We're now in the ${half} of the ${suffix}, and the inning's just getting started with no outs.`,
                `Fresh inning here, ${half} of the ${suffix}, with a clean slate and no outs.`,
                `The ${half} of the ${suffix} is underway, nobody out yet.`
            ][Math.floor(Math.random() * 3)];
            break;
        case 1:
            inningDescription = [
                `There's one out recorded in the ${half} of the ${suffix}.`,
                `One down in the ${half} of the ${suffix}, as the defense looks for two more.`,
                `The ${half} of the ${suffix} continues with one away.`
            ][Math.floor(Math.random() * 3)];
            break;
        case 2:
            inningDescription = [
                `Two down, one to go in the ${half} of the ${suffix}.`,
                `We're down to the final out of the ${half} in the ${suffix} inning.`,
                `Two outs on the board, ${winningTeam ? winningTeam : 'the offense'} is looking for a two-out rally.`
            ][Math.floor(Math.random() * 3)];
            break;
        default:
            inningDescription = `And that's the side retired! Time for a change.`;
    }
    recap += `\n${inningDescription}`;

    // 4. CLOSING HOOK
    const closers = [
        ` Stay tuned, there's plenty of baseball left to be played!`,
        ` Anything can happen in this game.`,
        ` We'll see if the ${losingTeam || 'trailing side'} can mount a comeback.`,
        ` What a contest we have on our hands today!`,
        ` It's a beautiful day for baseball, and this game is proving why.`
    ];
    recap += closers[Math.floor(Math.random() * closers.length)];

    return recap;
}

// --- AUDIO LOGIC ---

// --- UPDATED AUDIO & BUN RAIN LOGIC ---

let rainInterval = null;

function playBuns() {
    const trumpet = document.getElementById('audio-trumpet');
    const randomAudios = [
        document.getElementById('audio-rand-1'),
        document.getElementById('audio-rand-3'), // Fixed: rand-2 was missing in your HTML
        document.getElementById('audio-rand-4'),
        document.getElementById('audio-rand-5'),
        document.getElementById('audio-rand-6'),
        document.getElementById('audio-rand-7'),
        document.getElementById('audio-rand-8'),
        document.getElementById('audio-rand-9'),
        document.getElementById('audio-rand-10')
    ];

    if (!trumpet) return;

    // Start raining buns
    startBunRain();

    trumpet.currentTime = 0;
    trumpet.play().catch(e => console.log("Trumpet failed", e));

    trumpet.onended = () => {
        const valid = randomAudios.filter(a => a && a.src && a.src.trim() !== "");
        if (valid.length > 0) {
            const selected = valid[Math.floor(Math.random() * valid.length)];
            selected.currentTime = 0;
            selected.play().catch(e => console.log("Dialogue failed", e));
            
            // Stop raining only after the dialogue ends
            selected.onended = () => stopBunRain();
        } else {
            // If no dialogue, stop after trumpet
            stopBunRain();
        }
    };
}

function startBunRain() {
    if (rainInterval) return; // Prevent multiple intervals
    rainInterval = setInterval(() => {
        const bun = document.createElement('div');
        bun.className = 'bun-drop';
        bun.style.backgroundImage = "url('https://codehs.com/uploads/79411300e7ae3cb0766885493066194d')";
        
        // Randomize position and speed
        const startX = Math.random() * window.innerWidth;
        const duration = Math.random() * 2 + 2; // 2-4 seconds
        const size = Math.random() * 40 + 40; // 40-80px
        
        bun.style.left = `${startX}px`;
        bun.style.width = `${size}px`;
        bun.style.height = `${size}px`;
        bun.style.animationDuration = `${duration}s`;
        
        document.body.appendChild(bun);
        
        // Cleanup element after animation
        setTimeout(() => bun.remove(), duration * 1000);
    }, 150); // Drop a bun every 150ms
}

function stopBunRain() {
    clearInterval(rainInterval);
    rainInterval = null;
}

function copySpectatorLink() {
    const myId = localStorage.getItem('my_peer_id');
    if (!myId) {
        alert("Peer connection not ready yet. Please wait a moment.");
        return;
    }
    const url = window.location.origin + window.location.pathname + "?game=" + myId;
    
    navigator.clipboard.writeText(url).then(() => {
        alert("Spectator link copied! Keep this tab open to keep hosting.");
    });
}


document.addEventListener('DOMContentLoaded', () => {
    initP2P(); // Initialize PeerJS
    
    applyTheme();
    updateUI();
    renderLog();
    updateTimerDisplay();
    renderPitchUI();
    setupSwipeToClose();
    
    if (wakeLockEnabled) requestWakeLock();
    else updateWakeLockUI(false);
    if (timer.running) startInterval();
    const savedAway = localStorage.getItem('team_away');
    const savedHome = localStorage.getItem('team_home');
    if (savedAway) updateTeamName('away', savedAway);
    if (savedHome) updateTeamName('home', savedHome);
    document.addEventListener('click', () => {
        const menu = document.getElementById('share-menu');
        if (menu) menu.classList.remove('active');
    });
    // Rest of your team name loading...
});
