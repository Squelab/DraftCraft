// State management
const state = {
    players: [],
    filteredPlayers: [],
    availablePlayers: [],
    originalConsensus: {},
    consensusData: {},
    allConsensusData: {},
    currentFormat: 'PPR',
    positionFilter: 'ALL',
    showRiskButtons: true,
    hasModifications: false,
    isAnonymousWork: true,
    toggles: {
        adp: false,
        tiers: false,
        risk: true,
        notes: true
    },
    history: {
        undoStack: [],
        redoStack: [],
        maxSize: 50
    },
    notesModal: {
        isNotesOpen: false,
        currentPlayerId: null
    },
    dragState: {
        element: null,
        dragElement: null,
        index: -1,
        placeholder: null,
        isDragging: false,
        pendingDrag: false,
        startX: 0,
        startY: 0,
        originalRect: null,
        timers: { touch: null, resize: null, scroll: null },
        isScrolling: false,
        wasOverDelete: false,
        currentScrollSpeed: 0,
    }
};

function waitForFirebase() {
    return new Promise((resolve) => {
        if (window.firebase?.auth) {
            resolve();
        } else {
            setTimeout(() => waitForFirebase().then(resolve), 50);
        }
    });
}

function setupHamburgerMenu() {
    const menuBtn = document.getElementById('hamburgerMenuBtn');
    const menu = document.getElementById('hamburgerMenu');

    // Make sure menu starts hidden
    menu.classList.remove('show');

    // Hamburger animation function
    function animateHamburger(isOpen) {
        const lines = menuBtn.querySelectorAll('span');
        if (lines.length >= 3) {
            if (isOpen) {
                lines[0].style.transform = 'translateY(10px) rotate(45deg)';
                lines[1].style.opacity = '0';
                lines[2].style.transform = 'translateY(-10px) rotate(-45deg)';
            } else {
                lines[0].style.transform = 'translateY(0) rotate(0)';
                lines[1].style.opacity = '1';
                lines[2].style.transform = 'translateY(0) rotate(0)';
            }
        }
    }

    // Toggle function with access to animateHamburger
    window.toggleHamburgerMenu = function () {
        const isCurrentlyOpen = menu.classList.contains('show');

        if (isCurrentlyOpen) {
            // Close menu
            menu.classList.remove('show');
            animateHamburger(false);
        } else {
            // Open menu
            menu.classList.add('show');
            animateHamburger(true);
        }
    }

    // Click handler
    menuBtn.addEventListener('click', window.toggleHamburgerMenu);
}

// Toggle Switch Functionality
function setupToggleSwitches() {
    const toggleIds = ['adpToggle', 'tiersToggle', 'riskToggle', 'notesToggle'];
    const stateKeys = ['adp', 'tiers', 'risk', 'notes'];

    toggleIds.forEach((toggleId, index) => {
        const toggle = $(toggleId);
        const stateKey = stateKeys[index];

        // Add click handler
        on(toggle, 'click', () => {
            // Flip the state
            state.toggles[stateKey] = !state.toggles[stateKey];

            // Sync all visuals at once
            syncToggleVisuals();

            // Auto-save the new toggle states
            autoSave();
        });

        // Apply initial functionality
        applyDisplaySettings(stateKey, state.toggles[stateKey]);
    });
}


// Apply display settings
function applyDisplaySettings(setting, enabled) {
    switch (setting) {
        case 'adp':
            document.querySelectorAll('span').forEach(el => {
                if (el.textContent && el.textContent.includes('ADP:')) {
                    el.style.display = enabled ? 'inline' : 'none';
                }
            });
            break;
        case 'risk':
            if (enabled) {
                document.body.classList.add('risk-visible');
            } else {
                document.body.classList.remove('risk-visible');
            }
            updateNotesPosition();
            break;
        case 'notes':
            if (enabled) {
                document.body.classList.add('notes-visible');
                updateNotesPosition();
            } else {
                document.body.classList.remove('notes-visible');
                document.querySelectorAll('.notes-icon').forEach(icon => {
                    icon.style.transform = 'translateX(0)';
                });
            }
            break;
        case 'tiers':
            break;
    }
}

function updateDynamicTitle() {
    const titleElement = $('dynamicTitle');
    if (!titleElement) return;

    const user = window.firebase?.auth?.currentUser;
    const year = cfg.year;
    const format = state.currentFormat || 'PPR';

    let titleName;
    if (user && user.displayName) {
        const displayName = user.displayName;
        const firstName = displayName.split(' ')[0]; // Get just first name
        titleName = firstName + "'s";
    } else {
        titleName = 'Your';
    }

    titleElement.textContent = `${titleName} ${year} ${format} Rankings`;

    // Auto-save when format changes (only if user is signed in)
    if (user) autoSave();
}


// Haptic pickup/drop Idk if this works I only have an iphone
const vibrate = (pattern) => {
    if (window.navigator.vibrate) {
        window.navigator.vibrate(pattern);
    }
};

// Scoring format cycle
const scoringFormats = ['PPR', 'Half PPR', 'Standard'];

// Create delete overlay
const deleteOverlay = document.createElement('div');
deleteOverlay.className = 'delete-overlay';
document.body.appendChild(deleteOverlay);

// Configuration
const cfg = {
    year: new Date().getFullYear(),
    risks: ['Low', 'Medium', 'High'],
    formats: ['PPR', 'Half PPR', 'Standard'],
    skillPositions: ['RB', 'WR', 'TE', 'QB'],
    positionFilters: ['ALL', 'RB', 'WR', 'TE', 'QB'],
    maxPlayers: 200,
    dragThreshold: 15,
    dragDelay: 130,
    styles: {
        riskBtn: { High: 'bg-red-600', Medium: 'bg-yellow-600', Low: 'bg-green-600' },
        riskBorder: { High: 'border-2 border-red-500', Medium: 'border-2 border-yellow-500', Low: 'border-2 border-green-500' },
        posColors: {
            QB: 'bg-purple-900/50 border-l-4 border-purple-600',
            RB: 'bg-blue-900/50 border-l-4 border-blue-600',
            WR: 'bg-green-900/50 border-l-4 border-green-600',
            TE: 'bg-orange-900/50 border-l-4 border-orange-600',
            K: 'bg-pink-900/50 border-l-4 border-pink-600',
            DST: 'bg-gray-700/50 border-l-4 border-gray-600'
        },
        positionBadge: {
            QB: 'text-purple-300 bg-purple-900/50',
            RB: 'text-blue-300 bg-blue-900/50',
            WR: 'text-green-300 bg-green-900/50',
            TE: 'text-orange-300 bg-orange-900/50',
            K: 'text-pink-300 bg-pink-900/50',
            DST: 'text-gray-300 bg-gray-700/50'
        },
        positionFilterColors: {
            'ALL': 'bg-slate-900 border-slate-700',
            'QB': 'bg-purple-600 border-purple-500',
            'RB': 'bg-blue-600 border-blue-500',
            'WR': 'bg-green-600 border-green-500',
            'TE': 'bg-orange-600 border-orange-500'
        }
    }
};

// Utilities
const $ = id => document.getElementById(id);
const on = (el, evt, fn, opts) => el.addEventListener(evt, fn, opts);
const debounce = (fn, ms) => { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); } };
const deepCopy = obj => JSON.parse(JSON.stringify(obj));

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Set up event listeners using map for cleaner code
    const eventMap = {
        searchInput: ['input', debounce(filterPlayers, 150)],
        printBtn: ['click', downloadPrintable],
        notesModalClose: ['click', closeNotesModal],
        clearSearch: ['click', handleClearSearch],
        positionFilter: ['click', cyclePositionFilter],
        undoBtn: ['click', undo],
        redoBtn: ['click', redo],
        scoringFormat: ['click', cycleScoringFormat],
        refreshConsensusBtn: ['click', refreshToExpertConsensus],
        draftBtn: ['click', handleDraftClick],
    };

    // Add null checks for each element
    Object.entries(eventMap).forEach(([id, [event, handler]]) => {
        const element = $(id);
        if (element) {
            on(element, event, handler);
        } else {
            console.warn(`Element with id '${id}' not found`);
        }
    });

    const searchInput = $('searchInput');
    if (searchInput) {
        on(searchInput, 'input', handleSearchInput);
    }

    // Only set up modal listeners if modal exists
    const notesModal = $('notesModal');
    if (notesModal) {
        on(notesModal, 'click', (e) => {
            if (e.target === notesModal) {
                closeNotesModal();
            }
        });
    }

    // Keyboard shortcuts
    on(document, 'keydown', (e) => {
        // Escape key to close modal
        if (e.key === 'Escape' && state.notesModal.isNotesOpen) {
            closeNotesModal();
            return;
        }

        // Undo/Redo shortcuts (but not when typing in inputs)
        if (!['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
            if (e.ctrlKey || e.metaKey) {
                // Shift+Z (Redo) - just Z (Undo) - Ctrl+Y (alternative redo)
                if (e.key === 'Z' && e.shiftKey) {
                    e.preventDefault();
                    redo();
                }
                else if (e.key === 'z' && !e.shiftKey) {
                    e.preventDefault();
                    undo();
                }
                else if (e.key === 'y') {
                    e.preventDefault();
                    redo();
                }
            }
        }
    });

    // Reset scroll state when touches are cancelled/interrupted
    document.addEventListener('touchcancel', () => {
        if (state.dragState.isScrolling) {
            state.dragState.isScrolling = false;
            if (state.dragState.timers.scroll) {
                cancelAnimationFrame(state.dragState.timers.scroll);
            }
        }
    });

    // Reset scroll state when page loses focus
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && state.dragState.isScrolling) {
            state.dragState.isScrolling = false;
            if (state.dragState.timers.scroll) {
                cancelAnimationFrame(state.dragState.timers.scroll);
            }
        }
    });

    // Force layout recalculation when page becomes visible (fixes mobile cache restoration issues)
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            // Force reflow to fix header/content overlap on mobile restoration
            requestAnimationFrame(() => {
                const container = document.querySelector('.container');
                if (container) {
                    // Trigger layout recalculation
                    container.style.display = 'none';
                    container.offsetHeight; // Force reflow
                    container.style.display = 'flex';
                }
            });
        }
    });

    // Also fix on page show (handles back/forward cache)
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            // Page was restored from cache
            requestAnimationFrame(() => {
                const container = document.querySelector('.container');
                if (container) {
                    // Trigger layout recalculation
                    container.style.display = 'none';
                    container.offsetHeight; // Force reflow
                    container.style.display = 'flex';
                }
            });
        }
    });

    on(window, 'resize', () => {
        cancelDragOperation();
        clearTimeout(state.dragState.timers.resize);
        state.dragState.timers.resize = setTimeout(() => {
            filterPlayers();
        }, 250);
    });

    setupHamburgerMenu();

    // Load consensus data first, then initialize rankings
    await loadAllScoringFormats();

    // Wait a bit for Firebase auth to initialize if it exists
    setTimeout(async () => {
        await initializeRankings();
        setupToggleSwitches();
    }, 100);
});

function setOriginalConsensusForCurrentFormat() {
    if (state.players && state.players.length > 0) {
        state.originalConsensus[state.currentFormat] = deepCopy(state.players);
        console.log(`Set originalConsensus for ${state.currentFormat}`);
    }
}

function handleDraftClick() {
    // Use onAuthStateChanged to get the current auth state reliably
    window.firebase.onAuthStateChanged(window.firebase.auth, (user) => {
        if (user) {
            // Get the current title
            const titleElement = document.getElementById('dynamicTitle');
            const currentTitle = titleElement ? titleElement.textContent : 'Your 2025 PPR Rankings';

            // Pass current rankings and title to draft room via localStorage
            localStorage.setItem('draftRankings', JSON.stringify({
                players: state.players,
                currentFormat: state.currentFormat,
                title: currentTitle,
                timestamp: Date.now()
            }));
            // User is signed in, open draft room in new tab
            window.open('draft.html', '_blank');
        } else {
            // No user signed in
            if (confirm('You must be signed in to enter the draft room.\n\nPlease sign in with Google first.')) {
                signInWithGoogle();
            }
        }
    });
}


function refreshToExpertConsensus() {
    // First confirmation
    const confirmed = confirm(
        `This will reset your rankings to the original expert consensus for ${state.currentFormat}. ` +
        `All your custom rankings, notes, and risk assessments will be lost. ` +
        `Are you sure you want to continue?`
    );
    if (!confirmed) return;

    // Second confirmation
    const reallyConfirmed = confirm(
        `Are you really sure you want to continue?\n\nYou'll lose everything! Everything!`
    );
    if (!reallyConfirmed) return;

    saveState('refresh to consensus');
    loadPlayersFromConsensus(state.currentFormat);

    state.originalConsensus[state.currentFormat] = deepCopy(state.players);

    // Reset consensus reference after refresh

    state.hasModifications = false;
    autoSave();
}

function handleSearchInput() {
    const searchInput = document.getElementById('searchInput');
    const searchValue = searchInput.value;
    let clearBtn = document.getElementById('clearSearch');

    // Create clear button if it doesn't exist
    if (!clearBtn) {
        clearBtn = document.createElement('button');
        clearBtn.id = 'clearSearch';
        clearBtn.innerHTML = 'X';
        clearBtn.style.cssText = `
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            background: none;
            border: none;
            color: #9ca3af;
            cursor: pointer;
            font-size: 14px;
            z-index: 10;
            width: 20px;
            height: 20px;
            pointer-events: auto;
        `;
        clearBtn.onclick = handleClearSearch;

        // Wrap the search input in a relative container
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: relative; flex-grow: 1;';

        // Replace search input with wrapper containing input + button
        searchInput.parentNode.insertBefore(wrapper, searchInput);
        wrapper.appendChild(searchInput);
        wrapper.appendChild(clearBtn);

        // Remove flex-grow from input, add to wrapper
        searchInput.classList.remove('flex-grow');
        searchInput.style.width = '100%';
    }

    // Show/hide based on input value
    if (searchValue.length > 0) {
        clearBtn.style.display = 'block';
    } else {
        clearBtn.style.display = 'none';
    }

    filterPlayers();
}

function handleClearSearch() {
    const searchInput = $('searchInput');
    searchInput.value = '';
    $('clearSearch').style.display = 'none';
    searchInput.focus();
    filterPlayers();
}

// History management for undo/redo
function saveState(action = 'action') {
    state.history.redoStack = [];

    // Save current state to undo stack
    const snapshot = {
        players: deepCopy(state.players),
        action: action,
        timestamp: Date.now()
    };

    state.history.undoStack.push(snapshot);

    // Limit undo stack size
    if (state.history.undoStack.length > state.history.maxSize) {
        state.history.undoStack.shift();
    }

    updateUndoRedoButtons();

    // MARK THAT USER HAS MADE MODIFICATIONS
    state.hasModifications = true;
    state.isAnonymousWork = !window.firebase?.auth?.currentUser;

    // Add auto-save trigger
    autoSave();
}


function undo() {
    if (state.history.undoStack.length === 0) return;

    // Save current state to redo stack
    const currentSnapshot = {
        players: deepCopy(state.players),
        action: 'current',
        timestamp: Date.now()
    };
    state.history.redoStack.push(currentSnapshot);

    // Restore previous state
    const previousSnapshot = state.history.undoStack.pop();
    state.players = previousSnapshot.players;

    recalculateRanks();
    filterPlayers();
    updateUndoRedoButtons();
}

function redo() {
    if (state.history.redoStack.length === 0) return;

    // Save current state to undo stack
    const currentSnapshot = {
        players: deepCopy(state.players),
        action: 'undo',
        timestamp: Date.now()
    };
    state.history.undoStack.push(currentSnapshot);

    // Restore next state
    const nextSnapshot = state.history.redoStack.pop();
    state.players = nextSnapshot.players;

    recalculateRanks();
    filterPlayers();
    updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
    const undoBtn = $('undoBtn');
    const redoBtn = $('redoBtn');

    undoBtn.disabled = state.history.undoStack.length === 0;
    redoBtn.disabled = state.history.redoStack.length === 0;
}

// Notes Modal Functions
function openNotesModal(playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    state.notesModal.isNotesOpen = true;
    state.notesModal.currentPlayerId = playerId;

    $('notesModalTitle').textContent = `${player.name} - Notes`;
    $('notesModalTextarea').value = player.notes || '';
    $('notesModal').classList.remove('hidden');

    setTimeout(() => {
        $('notesModalTextarea').focus();
    }, 100);
}

function closeNotesModal() {
    if (!state.notesModal.isNotesOpen) return;

    const notes = $('notesModalTextarea').value;
    if (state.notesModal.currentPlayerId) {
        // Don't call saveState here since updateNotes will do it
        updateNotes(state.notesModal.currentPlayerId, notes);
    }

    state.notesModal.isNotesOpen = false;
    state.notesModal.currentPlayerId = null;
    $('notesModal').classList.add('hidden');
}


// Position filter functionality
function cyclePositionFilter() {
    const currentIndex = cfg.positionFilters.indexOf(state.positionFilter);
    const nextIndex = (currentIndex + 1) % cfg.positionFilters.length;
    state.positionFilter = cfg.positionFilters[nextIndex];

    updatePositionFilterButton();
    filterPlayers();
}

function updatePositionFilterButton() {
    const btn = $('positionFilter');
    const colors = cfg.styles.positionFilterColors[state.positionFilter];

    btn.className = `w-10 h-10 ${colors} border-2 rounded-md flex items-center justify-center hover:opacity-80 transition-all duration-200 cursor-pointer text-white font-bold text-lg`;

    if (state.positionFilter === 'ALL') {
        btn.innerHTML = '<img src="favicon.png" class="w-7 h-7">';
    } else {
        btn.innerHTML = state.positionFilter;
    }

    btn.title = `Filter by position (${state.positionFilter})`;
}

// Data loading
async function loadAllScoringFormats() {
    await waitForFirebase();
    try {
        await Promise.all(cfg.formats.map(async format => {
            const docName = format.toLowerCase().replace(' ', '-'); // 'ppr', 'half-ppr', 'standard'
            const docRef = window.firebase.doc(window.firebase.db, 'expert-consensus', docName);
            const docSnap = await window.firebase.getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const allPlayers = data.players || [];

                // Store ALL players for search functionality
                state.allConsensusData[format] = {
                    toggles: data.toggles,
                    players: allPlayers.map((p, i) => ({
                        ...p,
                        id: p.id || `p${i}`,
                        risk: p.risk || 'Medium',
                        notes: p.notes || '',
                        originalRank: i + 1
                    }))
                };

                // Store filtered skill players for initial load  
                const skillPlayers = allPlayers
                    .filter(p => cfg.skillPositions.includes(p.position))
                    .slice(0, cfg.maxPlayers);

                state.consensusData[format] = skillPlayers.map((p, i) => ({
                    ...p,
                    id: p.id || `p${i}`,
                    risk: p.risk || 'Medium',
                    notes: p.notes || '',
                    overallRank: i + 1
                }));
            }
        }));

        state.currentFormat = 'PPR';
        updateScoringButton('PPR');
    } catch (error) {
        console.error('Firestore loading failed:', error);
        throw error;
    }
}

async function initializeRankings() {
    const user = window.firebase?.auth?.currentUser;

    if (user) {
        console.log('User signed in, checking for existing work...');

        // SINGLE BULLETPROOF CHECK: Does user have ANY existing work?
        const hasExistingWork = await checkForAnyExistingUserData();
        if (hasExistingWork) {
            console.log('Found existing user work - loading from cloud...');
            await loadFromCloud(); // Load whatever exists, even if minimal
            return; // STOP HERE - protect existing work
        }

        console.log('Confirmed: No existing user work found - safe to load fresh consensus');
    }

    // Handle pending anonymous work for new sign-ins
    if (window.pendingAnonymousWork) {
        console.log('Restoring pending anonymous work...');
        const savedWork = window.pendingAnonymousWork;
        state.players = savedWork.players;
        state.toggles = savedWork.toggles;
        state.currentFormat = savedWork.currentFormat;
        filterPlayers(); // Don't recalculate ranks for restored work
        updateDynamicTitle();
        syncToggleVisuals();

        if (user) {
            await autoSave(); // Save to cloud for signed-in users
            console.log('Anonymous work saved to new account!');
            state.isAnonymousWork = false;
            state.hasModifications = true;
        } else {
            state.isAnonymousWork = true;
            state.hasModifications = true;
        }

        window.pendingAnonymousWork = null;
        return; // STOP HERE - we have user's work
    }

    // ONLY load fresh consensus if we're certain there's no existing user work
    if (state.consensusData && state.consensusData[state.currentFormat]) {
        state.players = deepCopy(state.consensusData[state.currentFormat]);
        setOriginalConsensusForCurrentFormat();
        filterPlayers(); // Don't recalculate ranks for fresh consensus
    }

    state.isAnonymousWork = !user;
    state.hasModifications = false;
}


// Data protection need
async function checkForAnyExistingUserData() {
    const user = window.firebase?.auth?.currentUser;
    if (!user) return false;

    try {
        const docRef = window.firebase.doc(window.firebase.db, 'rankings', user.uid);
        const doc = await window.firebase.getDoc(docRef);

        if (!doc.exists()) {
            console.log('No user document found - safe to load fresh data');
            return false;
        }

        const data = doc.data();

        // Check for ANY indicators of user work
        const hasPlayers = data?.players?.length > 0;
        const hasToggles = data?.toggles && Object.keys(data.toggles).length > 0;
        const hasLastUpdated = data?.lastUpdated;

        // Even empty players array could mean user deleted everything intentionally
        const hasAnyUserData = hasPlayers || hasToggles || hasLastUpdated;

        if (hasAnyUserData) {
            console.log(`Found existing user work: ${data.players?.length || 0} players, toggles: ${!!hasToggles}, lastUpdated: ${!!hasLastUpdated}`);
            return true;
        }

        console.log('Document exists but contains no user work - safe to load fresh data');
        return false;

    } catch (error) {
        console.error('Error checking for existing user data:', error);
        // FAIL SAFE: If we can't check, assume work exists to prevent data loss
        console.log('Cannot verify user data safety - assuming work exists to prevent loss');
        return true;
    }
}

function syncToggleVisuals() {
    const toggleIds = ['adpToggle', 'tiersToggle', 'riskToggle', 'notesToggle'];
    const stateKeys = ['adp', 'tiers', 'risk', 'notes'];

    toggleIds.forEach((toggleId, index) => {
        const toggle = document.getElementById(toggleId);
        const stateKey = stateKeys[index];
        const isEnabled = state.toggles[stateKey];

        if (toggle) {
            const circle = toggle.querySelector('div');
            if (circle) {
                // Use inline styles for everything to avoid CSS conflicts
                if (isEnabled) {
                    toggle.classList.add('toggle-enabled');
                    circle.style.left = 'auto';
                    circle.style.right = '0.25rem';
                } else {
                    toggle.classList.remove('toggle-enabled');
                    circle.style.right = 'auto';
                    circle.style.left = '0.25rem';
                }

                // Apply the functionality
                applyDisplaySettings(stateKey, isEnabled);
            }
        }
    });
}

function loadPlayersFromConsensus(format) {
    if (state.consensusData && state.consensusData[format]) {
        state.players = deepCopy(state.consensusData[format]);
        recalculateRanks();

        state.originalConsensus[format] = deepCopy(state.players);

        filterPlayers();
    }
}

async function loadPlayersFromFile() {
    const format = state.currentFormat || 'PPR';
    const docName = format.toLowerCase().replace(' ', '-');

    try {
        const docRef = window.firebase.doc(window.firebase.db, 'expert-consensus', docName);
        const docSnap = await window.firebase.getDoc(docRef);

        if (docSnap.exists()) {
            const d = docSnap.data();
            const allPlayers = d.players || [];

            state.allConsensusData[format] = {
                toggles: d.toggles,
                players: allPlayers.map((p, i) => ({
                    ...p,
                    id: p.id || `p${i}`,
                    risk: p.risk || 'Medium',
                    notes: p.notes || '',
                    originalRank: i + 1
                }))
            };

            const skillPlayers = allPlayers
                .filter(p => cfg.skillPositions.includes(p.position))
                .slice(0, cfg.maxPlayers);

            state.players = skillPlayers.map((p, i) => ({
                ...p,
                id: p.id || `p${i}`,
                risk: p.risk || 'Medium',
                notes: p.notes || '',
                overallRank: i + 1
            }));

            // Store the skill players as consensus data
            state.consensusData[format] = deepCopy(state.players);

            recalculateRanks();

            filterPlayers();
        }
    } catch (error) {
        console.error('Error loading from Firestore:', error);
    }
}

function cycleScoringFormat() {
    const button = document.getElementById('scoringFormat');
    const currentFormat = button.dataset.format || 'PPR';
    const currentIndex = scoringFormats.indexOf(currentFormat);
    const nextIndex = (currentIndex + 1) % scoringFormats.length;
    const newFormat = scoringFormats[nextIndex];

    updateScoringButton(newFormat);

    const previousFormat = state.currentFormat;
    state.currentFormat = newFormat;

    // Set consensus for new format if not set
    if (!state.originalConsensus[newFormat] && state.consensusData[newFormat]) {
        state.originalConsensus[newFormat] = deepCopy(state.consensusData[newFormat]);
    }

    if (isUnedited(previousFormat)) {
        loadPlayersFromConsensus(newFormat);

        state.originalConsensus[newFormat] = deepCopy(state.players);

    } else {
        updateADPValues(newFormat);
    }

    updateDynamicTitle();
}

function updateScoringButton(format) {
    const button = document.getElementById('scoringFormat');
    const highlight = document.getElementById('formatHighlight');

    // Add null checks
    if (!button || !highlight) return;

    button.dataset.format = format; // This line is crucial!
    button.title = `Scoring Format: ${format}`;

    // Move highlight based on format
    const positions = {
        'PPR': 'translateY(0)',           // top third
        'Half PPR': 'translateY(100%)',   // middle third
        'Standard': 'translateY(200%)'    // bottom third
    };

    highlight.style.transform = positions[format];
}

function isUnedited(formatToCheck = null) {
    const checkFormat = formatToCheck || state.currentFormat;
    const original = state.originalConsensus[checkFormat];

    if (!original || state.players.length !== original.length) {
        console.log(`FAILED: ${!original ? 'No original data' : 'Length mismatch'}`);
        return false;
    }

    for (let i = 0; i < state.players.length; i++) {
        const p = state.players[i];
        const orig = original[i];

        for (const key of Object.keys(p)) {
            if (key === 'adp') continue; // Skip ADP
            if (p[key] !== orig[key]) {
                return false;
            }
        }
    }

    return true;
}

function updateADPValues(format) {
    if (!state.consensusData[format]) return;

    const adpMap = new Map(
        state.consensusData[format].map(p => [`${p.name}-${p.team}`, p.adp])
    );

    state.players.forEach(player => {
        const adp = adpMap.get(`${player.name}-${player.team}`);
        if (adp !== undefined) player.adp = adp;
    });

    filterPlayers();
}

// Player management
function recalculateRanks() {
    const posCounts = {};
    state.players.forEach((p, i) => {
        posCounts[p.position] = (posCounts[p.position] || 0) + 1;
        p.overallRank = i + 1;
        p.positionRank = posCounts[p.position];
    });
}

function filterPlayers() {
    const search = $('searchInput').value.toLowerCase();

    if (state.positionFilter === 'ALL') {
        state.filteredPlayers = state.players.filter(p =>
            advancedPlayerSearch(p, search)
        );

        // Find available players to add (from all consensus data)
        state.availablePlayers = [];
        if (search.length >= 2 && state.allConsensusData[state.currentFormat]) {
            const currentPlayerIds = new Set(state.players.map(p => p.id));

            // FIX: Access players array from the data structure
            const allPlayers = state.allConsensusData[state.currentFormat].players || [];

            state.availablePlayers = allPlayers
                .filter(p =>
                    !currentPlayerIds.has(p.id) &&
                    advancedPlayerSearch(p, search)
                )
                .slice(0, 10);
        }
    } else {
        // Show only selected position from current rankings
        state.filteredPlayers = state.players.filter(p =>
            p.position === state.positionFilter &&
            advancedPlayerSearch(p, search)
        );

        // Show available players of this position (not in current rankings)
        const currentPlayerIds = new Set(state.players.map(p => p.id));
        state.availablePlayers = [];

        if (state.allConsensusData[state.currentFormat]) {
            // FIX: Access players array from the data structure
            const allPlayers = state.allConsensusData[state.currentFormat].players || [];

            state.availablePlayers = allPlayers
                .filter(p =>
                    p.position === state.positionFilter &&
                    !currentPlayerIds.has(p.id) &&
                    (search.length === 0 || advancedPlayerSearch(p, search))
                )
                .slice(0, 20);
        }
    }

    renderPlayers();
}


function advancedPlayerSearch(player, searchTerm) {
    if (!searchTerm) return true;

    // Normalize function to handle punctuation and case
    const normalize = (str) => {
        return str.toLowerCase()
            .replace(/[''`]/g, "'")
            .replace(/[^\w\s']/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    // Team name mappings for common abbreviations
    const teamMappings = {
        'arizona': ['ari', 'cardinals', 'arizona'],
        'atlanta': ['atl', 'falcons', 'atlanta'],
        'baltimore': ['bal', 'ravens', 'baltimore'],
        'buffalo': ['buf', 'bills', 'buffalo'],
        'carolina': ['car', 'panthers', 'carolina'],
        'chicago': ['chi', 'bears', 'chicago'],
        'cincinnati': ['cin', 'bengals', 'cincinnati'],
        'cleveland': ['cle', 'browns', 'cleveland'],
        'dallas': ['dal', 'cowboys', 'dallas'],
        'denver': ['den', 'broncos', 'denver'],
        'detroit': ['det', 'lions', 'detroit'],
        'green bay': ['gb', 'packers', 'green bay'],
        'houston': ['hou', 'texans', 'houston'],
        'indianapolis': ['ind', 'colts', 'indianapolis'],
        'jacksonville': ['jax', 'jaguars', 'jacksonville'],
        'kansas city': ['kc', 'chiefs', 'kansas city'],
        'las vegas': ['lv', 'raiders', 'las vegas'],
        'los angeles chargers': ['lac', 'chargers', 'los angeles chargers'],
        'los angeles rams': ['lar', 'rams', 'los angeles rams'],
        'miami': ['mia', 'dolphins', 'miami'],
        'minnesota': ['min', 'vikings', 'minnesota'],
        'new england': ['ne', 'patriots', 'new england'],
        'new orleans': ['no', 'saints', 'new orleans'],
        'new york giants': ['nyg', 'giants', 'new york giants'],
        'new york jets': ['nyj', 'jets', 'new york jets'],
        'philadelphia': ['phi', 'eagles', 'philadelphia'],
        'pittsburgh': ['pit', 'steelers', 'pittsburgh'],
        'san francisco': ['sf', '49ers', 'niners', 'san francisco'],
        'seattle': ['sea', 'seahawks', 'seattle'],
        'tampa bay': ['tb', 'buccaneers', 'bucs', 'tampa bay'],
        'tennessee': ['ten', 'titans', 'tennessee'],
        'washington': ['was', 'commanders', 'washington']
    };

    const normalizedSearch = normalize(searchTerm);
    const normalizedName = normalize(player.name);
    const normalizedTeam = normalize(player.team);

    // Create expanded team search terms
    let teamSearchTerms = [normalizedTeam, player.team.toLowerCase()];

    // Add team mappings
    Object.values(teamMappings).forEach(aliases => {
        if (aliases.some(alias => alias === normalizedTeam || alias === player.team.toLowerCase())) {
            teamSearchTerms.push(...aliases);
        }
    });

    // For name matching, try different approaches
    const nameMatches = (searchWord) => {
        // Direct substring match
        if (normalizedName.includes(searchWord)) return true;

        // Check if search word matches start of any name part
        const nameParts = normalizedName.split(' ');
        if (nameParts.some(part => part.startsWith(searchWord))) return true;

        // This handles cases like "jam" -> "ja'm" to match "ja'marr"
        for (let i = 1; i < searchWord.length; i++) {
            const withApostrophe = searchWord.slice(0, i) + "'" + searchWord.slice(i);
            if (normalizedName.includes(withApostrophe)) return true;

            // Also check if it matches start of name parts
            if (nameParts.some(part => part.startsWith(withApostrophe))) return true;
        }

        return false;
    };

    const teamMatches = (searchWord) => {
        return teamSearchTerms.some(term =>
            term.includes(searchWord) || term.startsWith(searchWord)
        );
    };

    // Split search into words for multi-word matching
    const searchWords = normalizedSearch.split(' ').filter(word => word.length > 0);

    // Check if all search words match somewhere in name or team
    return searchWords.every(word => {
        return nameMatches(word) || teamMatches(word);
    });
}

function addPlayer(playerId) {
    saveState('add player');

    // FIX: Access the players array from the correct structure
    const allPlayersData = state.allConsensusData[state.currentFormat];
    const playerToAdd = allPlayersData?.players?.find(p => p.id === playerId);

    if (!playerToAdd) {
        return;
    }

    // Create new player object with current rankings properties
    const newPlayer = {
        ...playerToAdd,
        overallRank: state.players.length + 1,
        positionRank: 1
    };

    // Add to the end of rankings
    state.players.push(newPlayer);
    recalculateRanks();
    filterPlayers();
}

function updatePlayerOrder() {
    document.querySelectorAll('.drag-placeholder').forEach(el => el.remove());

    if (state.positionFilter === 'ALL') {
        // Normal behavior for all positions
        const playerElements = Array.from(document.querySelectorAll('.player-item:not(.drag-placeholder):not(.available-player)'));
        const newOrder = playerElements
            .map(el => state.players.find(p => p.id === el.dataset.playerId))
            .filter(Boolean);

        if (newOrder.length === state.players.length) {
            // CHECK IF ORDER ACTUALLY CHANGED BEFORE SAVING STATE
            const orderChanged = !state.players.every((player, index) =>
                player.id === newOrder[index].id
            );

            if (orderChanged) {
                saveState('reorder players');
                state.players = newOrder;
                recalculateRanks();
                filterPlayers();
            }
        } else {
            filterPlayers();
        }
    } else {
        // Positional filtering logic
        const playerElements = Array.from(document.querySelectorAll('.player-item:not(.drag-placeholder):not(.available-player)'));
        const newPositionalOrder = playerElements
            .map(el => state.players.find(p => p.id === el.dataset.playerId))
            .filter(Boolean);

        // Get players not in the current position filter
        const otherPositionPlayers = state.players.filter(p => p.position !== state.positionFilter);

        // Rebuild the full rankings by interleaving the reordered position players
        const newFullRankings = [];
        let posIndex = 0;

        for (let i = 0; i < state.players.length; i++) {
            const originalPlayer = state.players[i];

            if (originalPlayer.position === state.positionFilter) {
                if (posIndex < newPositionalOrder.length) {
                    newFullRankings.push(newPositionalOrder[posIndex]);
                    posIndex++;
                }
            } else {
                newFullRankings.push(originalPlayer);
            }
        }

        // CHECK IF ORDER ACTUALLY CHANGED BEFORE SAVING STATE
        const orderChanged = !state.players.every((player, index) =>
            player.id === newFullRankings[index].id
        );

        if (orderChanged) {
            saveState('reorder players');
            // Update the master rankings
            state.players = newFullRankings;
            recalculateRanks();
            filterPlayers();
        }
    }
}



// Rendering helpers
const createRiskButton = (action, player) => {
    const risk = player?.risk || 'Medium';
    const riskLetter = risk[0] || 'M';

    return `<button onclick="cycleRisk('${player.id}')" class="risk-button ${cfg.styles.riskBtn[risk]} border ${cfg.styles.riskBorder[risk]} w-10 h-10 rounded text-sm font-bold text-white transition-all duration-200 flex items-center justify-center">${riskLetter}</button>`;
};

const createNotesIcon = (player) => {
    return `<button onclick="openNotesModal('${player.id}')" class="notes-icon bg-slate-600 border-2 border-slate-500 w-10 h-10 rounded text-white hover:bg-slate-700 transition-all duration-200 flex items-center justify-center" title="Edit notes">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                </svg>
            </button>`;
};

const createAddButton = (player) => {
    return `<button onclick="addPlayer('${player.id}')" class="bg-green-600 border-2 border-green-500 w-10 h-10 rounded text-white hover:bg-green-700 transition-all duration-200 flex items-center justify-center">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path>
                </svg>
            </button>`;
};

function updateNotesPosition() {
    const isRiskDisabled = !state.toggles.risk;
    const isNotesEnabled = state.toggles.notes; // Check if notes are enabled

    document.querySelectorAll('.notes-icon').forEach(icon => {
        // Only transform if notes are actually enabled (visible)
        if (isNotesEnabled && isRiskDisabled) {
            icon.style.transform = 'translateX(48px)';
        } else {
            icon.style.transform = 'translateX(0)';
        }
    });
}

// Rendering
function renderPlayers() {
    const container = $('playersList');
    const search = $('searchInput').value.toLowerCase();

    const html = [];

    // Current players
    state.filteredPlayers.forEach((p, i) => {
        html.push(`
            <div class="player-item ${cfg.styles.posColors[p.position]} hover:shadow-lg" data-player-id="${p.id}" data-index="${i}">
                <div class="p-2 gap-2 flex items-stretch">
                    <div class="drag-area flex flex-grow items-stretch cursor-move lg:items-center lg:gap-1">
                        <div class="w-12 flex flex-col items-center justify-center lg:w-12 lg:text-center lg:flex-shrink-0">
                            <div class="text-mega font-bold text-gray-100 lg:text-2xl">${p.overallRank}</div>
                            <div class="text-mini ${cfg.styles.positionBadge[p.position].split(' ')[0]} lg:hidden">${p.position}${p.positionRank}</div>
                        </div>
                        <div class="hidden lg:block lg:w-16 lg:flex-shrink-0 lg:flex lg:justify-center">
                            <span class="${cfg.styles.positionBadge[p.position]} px-2 py-1 rounded text-sm font-medium text-center">${p.position}${p.positionRank}</span>
                        </div>
                        <div class="px-2 flex-grow flex items-center">
                            <div class="flex-grow">
                                <div class="font-semibold text-mega text-gray-100">${p.name}</div>
                                <div class="text-mini text-gray-400 flex">
                                    <span class="w-12">${p.team}</span>
                                    ${p.adp ? `<span class="ml-2 text-gray-400">ADP: ${p.adp}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="w-10 flex items-center flex-shrink-0">${createNotesIcon(p)}</div>
                    <div class="w-10 flex items-center flex-shrink-0">${createRiskButton('action', p)}</div>
                </div>
            </div>
        `);
    });

    // Available players
    state.availablePlayers.forEach((p, i) => {
        html.push(`
            <div class="player-item available-player ${cfg.styles.posColors[p.position]} opacity-70 hover:shadow-lg" data-player-id="${p.id}" data-index="${i}">
                <div class="p-2 flex items-stretch gap-2">
                    <div class="drag-area flex items-stretch gap-2 flex-grow cursor-move lg:items-center lg:gap-1">
                        <div class="w-12 flex flex-col items-center justify-center lg:w-12 lg:text-center lg:flex-shrink-0">
                            <div class="text-mega font-bold text-gray-100 lg:text-2xl">${p.originalRank || '-'}</div>
                            <div class="text-mini ${cfg.styles.positionBadge[p.position].split(' ')[0]} lg:hidden">${p.position}${p.positionRank || ''}</div>
                        </div>
                        <div class="hidden lg:block lg:w-16 lg:flex-shrink-0 lg:flex lg:justify-center">
                            <span class="${cfg.styles.positionBadge[p.position]} px-2 py-1 rounded text-sm font-medium text-center">${p.position}${p.positionRank || ''}</span>
                        </div>
                        <div class="px-2 flex-grow flex items-center">
                            <div class="flex-grow">
                                <div class="font-semibold text-mega text-gray-100">${p.name}</div>
                                <div class="text-mini text-gray-400 flex">
                                    <span class="w-12">${p.team}</span>
                                    ${p.adp ? `<span class="ml-2 text-gray-400">ADP: ${p.adp}</span>` : ''}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="w-10 flex items-center">${createAddButton(p)}</div>
                </div>
            </div>
        `);
    });

    container.innerHTML = html.join('');

    setupDragHandlers();
    syncToggleVisuals();
}

// Drag and drop handling
function setupDragHandlers() {
    document.querySelectorAll('.drag-area').forEach(item => {
        on(item, 'touchstart', handleTouchStart, { passive: true });
        on(item, 'touchmove', handleTouchMove, { passive: false });
        on(item, 'touchend', handleTouchEnd, { passive: true });
        on(item, 'mousedown', handleMouseDown);
    });
}

function initDrag(element, clientX, clientY) {
    // PREVENT DRAG IF ALREADY SCROLLING
    if (state.dragState.isScrolling) {
        return;
    }

    const rect = element.getBoundingClientRect();
    Object.assign(state.dragState, {
        element,
        index: parseInt(element.dataset.index),
        isDragging: true,
        startX: clientX,
        startY: clientY,
        originalRect: { left: rect.left, top: rect.top },
    });

    startAutoScroll();

    vibrate(50);

    state.dragState.placeholder = element.cloneNode(true);
    state.dragState.placeholder.classList.add('drag-placeholder');

    // Replace the risk button with delete button in placeholder
    const placeholderRiskBtn = state.dragState.placeholder.querySelector('button[onclick*="cycleRisk"]');
    if (placeholderRiskBtn) {
        const playerId = element.dataset.playerId;
        placeholderRiskBtn.outerHTML = `
                                <button onclick="deletePlayer('${playerId}')" class="delete-button bg-red-600 border-2 border-red-500 w-10 h-10 rounded text-white hover:bg-red-700 transition-all duration-200 flex items-center justify-center">
                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                    </svg>
                                </button>
                            `;
    }

    // Make sure parent exists before inserting placeholder
    if (!element.parentNode) {
        state.dragState.isDragging = false;
        return;
    }

    // Insert placeholder
    try {
        element.parentNode.insertBefore(state.dragState.placeholder, element);
    } catch (e) {
        state.dragState.isDragging = false;
        return;
    }

    element.classList.add('drag-active');
    Object.assign(element.style, {
        width: rect.width + 'px',
        height: rect.height + 'px',
        left: rect.left + 'px',
        top: rect.top + 'px'
    });
}

function moveDrag(clientX, clientY) {
    if (!state.dragState.isDragging || !state.dragState.element) return;

    const { element, startX, startY, originalRect, placeholder } = state.dragState;
    element.style.left = (originalRect.left + clientX - startX) + 'px';
    element.style.top = (originalRect.top + clientY - startY) + 'px';

    // Auto-scroll logic
    handleAutoScroll(clientY);

    // Check if over delete zone OR placeholder delete button
    const deleteZone = $('deleteZone');
    const deleteRect = deleteZone.getBoundingClientRect();
    const placeholderDeleteBtn = document.querySelector('.drag-placeholder .delete-button');
    let isOverDelete = clientX >= deleteRect.left && clientX <= deleteRect.right &&
        clientY >= deleteRect.top && clientY <= deleteRect.bottom;

    // Also check placeholder delete button
    if (!isOverDelete && placeholderDeleteBtn) {
        const btnRect = placeholderDeleteBtn.getBoundingClientRect();
        isOverDelete = clientX >= btnRect.left && clientX <= btnRect.right &&
            clientY >= btnRect.top && clientY <= btnRect.bottom;
    }

    if (isOverDelete) {
        // Add red glow to entire page background
        deleteOverlay.classList.add('active');
        document.body.classList.add('delete-mode');

        deleteZone.classList.add('bg-red-800', 'scale-110');
        deleteZone.classList.remove('bg-red-600');
        state.dragState.wasOverDelete = true;
        return;
    } else {
        // Remove red glow from page background
        deleteOverlay.classList.remove('active');
        document.body.classList.remove('delete-mode');

        deleteZone.classList.remove('bg-red-800', 'scale-110');
        deleteZone.classList.add('bg-red-600');
        state.dragState.wasOverDelete = false;
    }

    element.style.pointerEvents = 'none';
    const elementBelow = document.elementFromPoint(clientX, clientY);
    element.style.pointerEvents = 'auto';

    const targetItem = elementBelow?.closest('.player-item');
    if (targetItem && placeholder && !targetItem.classList.contains('drag-active') && !targetItem.classList.contains('available-player')) {
        const targetRect = targetItem.getBoundingClientRect();
        const before = clientY < targetRect.top + targetRect.height / 2;
        targetItem.parentNode.insertBefore(placeholder, before ? targetItem : targetItem.nextSibling);
    }
}

function handleAutoScroll(clientY) {
    // Get the players container (the one that will eventually be fixed-height scrollable)
    const playersContainer = document.querySelector('.bg-slate-800.rounded-lg');
    if (!playersContainer) {
        state.dragState.currentScrollSpeed = 0;
        state.dragState.isScrolling = false;
        return;
    }

    const rect = playersContainer.getBoundingClientRect();

    let scrollSpeed = 0;

    // Check if we're ABOVE the container - entire area above = zoom scroll up
    if (clientY < rect.top) {
        scrollSpeed = -12;
    }
    // Check if we're BELOW the container - entire area below = zoom scroll down  
    else if (clientY > rect.bottom) {
        scrollSpeed = 12;
    }
    // Inside container - use the original zone logic
    else {
        // Position within the container (0 = top edge, containerHeight = bottom edge)
        const positionInContainer = clientY - rect.top;
        const containerHeight = rect.height;

        // Scroll zones (pixels from container edges)
        const zoomZone = 40;
        const fastZone = 60;
        const mediumZone = 80;
        const slowZone = 100;
        const snailZone = 120;

        // TOP ZONES - near the top edge of container
        if (positionInContainer < zoomZone) {
            scrollSpeed = -12;
        } else if (positionInContainer < fastZone) {
            scrollSpeed = -9;
        } else if (positionInContainer < mediumZone) {
            scrollSpeed = -6;
        } else if (positionInContainer < slowZone) {
            scrollSpeed = -3;
        } else if (positionInContainer < snailZone) {
            scrollSpeed = -1;
        }
        // BOTTOM ZONES - near the bottom edge of container
        else if (positionInContainer > containerHeight - zoomZone) {
            scrollSpeed = 12;
        } else if (positionInContainer > containerHeight - fastZone) {
            scrollSpeed = 9;
        } else if (positionInContainer > containerHeight - mediumZone) {
            scrollSpeed = 6;
        } else if (positionInContainer > containerHeight - slowZone) {
            scrollSpeed = 3;
        } else if (positionInContainer > containerHeight - snailZone) {
            scrollSpeed = 1;
        } else {
        }
    }

    state.dragState.currentScrollSpeed = scrollSpeed;
    state.dragState.isScrolling = scrollSpeed !== 0;
}

function startAutoScroll() {
    if (state.dragState.timers.scroll) return; // Already running

    const scrollLoop = () => {
        if (!state.dragState.isDragging) {
            state.dragState.timers.scroll = null;
            state.dragState.isScrolling = false;
            return;
        }

        if (state.dragState.currentScrollSpeed !== 0) {
            // Scroll the CONTAINER instead of the window
            const playersContainer = document.querySelector('.bg-slate-800.rounded-lg');
            if (playersContainer) {
                playersContainer.scrollTop += state.dragState.currentScrollSpeed;
            }

            // Update placeholder position during scroll
            if (state.dragState.element && state.dragState.placeholder) {
                const dragRect = state.dragState.element.getBoundingClientRect();
                const centerX = dragRect.left + dragRect.width / 2;
                const centerY = dragRect.top + dragRect.height / 2;
                updatePlaceholderPosition(centerX, centerY);
            }
        }

        state.dragState.timers.scroll = requestAnimationFrame(scrollLoop);
    };

    state.dragState.timers.scroll = requestAnimationFrame(scrollLoop);
}

function stopAutoScroll() {
    if (state.dragState.timers.scroll) {
        cancelAnimationFrame(state.dragState.timers.scroll);
        state.dragState.timers.scroll = null;
    }
    state.dragState.isScrolling = false;
    state.dragState.currentScrollSpeed = 0;
}

function updatePlaceholderPosition(clientX, clientY) {
    const { element, placeholder } = state.dragState;
    if (!element || !placeholder) return;

    element.style.pointerEvents = 'none';
    const elementBelow = document.elementFromPoint(clientX, clientY);
    element.style.pointerEvents = 'auto';

    const targetItem = elementBelow?.closest('.player-item');
    if (targetItem && !targetItem.classList.contains('drag-active') && !targetItem.classList.contains('available-player')) {
        const targetRect = targetItem.getBoundingClientRect();
        const before = clientY < targetRect.top + targetRect.height / 2;
        targetItem.parentNode.insertBefore(placeholder, before ? targetItem : targetItem.nextSibling);
    }
}

function endDrag() {
    if (!state.dragState.isDragging) return;

    const { element, placeholder } = state.dragState;

    // Reset delete zone styling FIRST
    const deleteZone = $('deleteZone');
    deleteZone.classList.remove('bg-red-800', 'scale-110');
    deleteZone.classList.add('bg-red-600');

    // Remove red pulse from background
    deleteOverlay.classList.remove('active');
    document.body.classList.remove('delete-mode');

    if (element && placeholder) {
        const wasOverDelete = state.dragState.wasOverDelete;

        if (wasOverDelete) {
            vibrate([100, 50, 100]);
            const playerId = element.dataset.playerId;
            deletePlayer(playerId);

            element.remove();
            placeholder.remove();
        } else {
            vibrate(100);
            placeholder.parentNode.replaceChild(element, placeholder);
            element.classList.remove('drag-active');
            ['width', 'height', 'left', 'top'].forEach(prop => element.style[prop] = '');
            updatePlayerOrder(); // This needs drag state to still be valid!
        }
    }

    // Clear drag state AFTER all drop logic is complete
    Object.assign(state.dragState, {
        element: null,
        placeholder: null,
        isDragging: false,
        wasOverDelete: false,
        isScrolling: false,        // Clear these LAST
        currentScrollSpeed: 0      // Clear these LAST
    });

    // Stop auto-scrolling LAST
    stopAutoScroll();
}


function deletePlayer(playerId) {
    saveState('delete player');
    const playerIndex = state.players.findIndex(p => p.id === playerId);
    if (playerIndex !== -1) {
        state.players.splice(playerIndex, 1);
        recalculateRanks();
        filterPlayers();
    }
}

function cancelDragOperation() {
    clearTimeout(state.dragState.timers.touch);

    const deleteZone = $('deleteZone');
    deleteZone.classList.remove('bg-red-800', 'scale-110');
    deleteZone.classList.add('bg-red-600');

    // Remove red pulse from background
    deleteOverlay.classList.remove('active');
    document.body.classList.remove('delete-mode');

    state.dragState.wasOverDelete = false;

    endDrag();
}

function handleTouchStart(e) {
    if (state.dragState.isDragging || state.dragState.timers.touch) return;

    const touch = e.touches[0];
    const playerItem = e.target.closest('.player-item');
    if (!playerItem || playerItem.classList.contains('available-player')) return;

    state.dragState.startX = touch.clientX;
    state.dragState.startY = touch.clientY;
    state.dragState.pendingDrag = true;

    state.dragState.timers.touch = setTimeout(() => {
        if (state.dragState.pendingDrag && !state.dragState.isScrolling) {
            initDrag(playerItem, touch.clientX, touch.clientY);
            if (navigator.vibrate) navigator.vibrate(50);
        }
    }, cfg.dragDelay);
}

function handleTouchMove(e) {
    const touch = e.touches[0];

    if (state.dragState.pendingDrag && !state.dragState.isDragging) {
        const moveX = Math.abs(touch.clientX - state.dragState.startX);
        const moveY = Math.abs(touch.clientY - state.dragState.startY);

        if (moveX > cfg.dragThreshold || moveY > cfg.dragThreshold) {
            cancelPendingDrag();
        }
        return;
    }

    if (state.dragState.isDragging) {
        e.preventDefault();
        moveDrag(touch.clientX, touch.clientY);
    }
}
function handleTouchEnd() {
    cancelPendingDrag();
    endDrag();
}

function cancelPendingDrag() {
    state.dragState.pendingDrag = false;
    if (state.dragState.timers.touch) {
        clearTimeout(state.dragState.timers.touch);
        state.dragState.timers.touch = null;
    }
}

function handleMouseDown(e) {
    const playerItem = e.target.closest('.player-item');
    if (!playerItem || playerItem.classList.contains('available-player')) return;

    e.preventDefault();
    initDrag(playerItem, e.clientX, e.clientY);
    on(document, 'mousemove', handleMouseMove);
    on(document, 'mouseup', handleMouseUp);
}

function handleMouseMove(e) {
    if (!state.dragState.isDragging) return;
    e.preventDefault();
    moveDrag(e.clientX, e.clientY);
}

function handleMouseUp() {
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    endDrag();
}

// Player actions
window.cycleRisk = id => {
    saveState('change risk');
    const p = state.players.find(x => x.id === id);
    if (p) {
        const i = cfg.risks.indexOf(p.risk);
        p.risk = cfg.risks[(i + 1) % cfg.risks.length];
        filterPlayers();
    }
};

window.updateNotes = (id, notes) => {
    saveState('update notes');
    const p = state.players.find(x => x.id === id);
    if (p) p.notes = notes;
};

window.addPlayer = addPlayer;
window.deletePlayer = deletePlayer;
window.openNotesModal = openNotesModal;


function downloadPrintable() {
    // Get user info like the printable function does
    const user = window.firebase?.auth?.currentUser;
    let name = user ? (user.displayName || 'Your') : 'Your';

    // Add 's' if name doesn't already end with 's' (case-insensitive)
    if (!name.toLowerCase().endsWith('s') && name.toLowerCase() !== 'your') {
        name += 's';
    }

    const scoring = state.currentFormat || 'PPR';
    const backendFormat = scoring.replace(' ', '');

    downloadFile(generatePrintableHTML(), `${name}${cfg.year}${backendFormat}Printable.html`, 'text/html');
}

function downloadFile(content, filename, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

const autoSave = debounce(async () => {
    const user = window.firebase?.auth?.currentUser;
    if (!user) return;

    try {
        const data = {
            rankerName: user.displayName || user.email.split('@')[0],
            year: cfg.year,
            scoringFormat: state.currentFormat,
            players: state.players,
            toggles: state.toggles,
            lastUpdated: new Date().toISOString()
        };

        const docRef = window.firebase.doc(window.firebase.db, 'rankings', user.uid);
        await window.firebase.setDoc(docRef, data);

    } catch (error) {
        console.error('Auto-save failed:', error);
    }
}, 2000);

function signInWithGoogle() {
    // Save current work to temporary storage before signing in
    if (state.hasModifications && state.isAnonymousWork) {
        console.log('Saving anonymous work before sign-in...');
        localStorage.setItem('anonymousRankings', JSON.stringify({
            players: state.players,
            toggles: state.toggles,
            currentFormat: state.currentFormat,
            timestamp: Date.now()
        }));
    }

    window.firebase.signInWithRedirect(window.firebase.auth, window.firebase.provider);
}


async function signOutUser() {
    try {
        await window.firebase.signOut(window.firebase.auth);
        location.reload();
    } catch (error) {
        alert('Sign out failed: ' + error.message);
    }
}

// Auto-load on sign in
async function loadFromCloud() {
    const user = window.firebase?.auth?.currentUser;
    if (!user) return false;

    try {
        const docRef = window.firebase.doc(window.firebase.db, 'rankings', user.uid);
        const docSnap = await window.firebase.getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // Load ANY existing data, no matter how small
            if (data && Array.isArray(data.players)) {
                console.log(`Loading cloud data (${data.players.length} players)`);

                state.players = data.players;

                // Restore toggle states if they exist
                if (data.toggles) {
                    state.toggles = { ...state.toggles, ...data.toggles };
                }

                // Update UI elements
                if (data.scoringFormat && data.scoringFormat !== state.currentFormat) {
                    state.currentFormat = data.scoringFormat;
                    if (typeof updateScoringButton === 'function') {
                        updateScoringButton(data.scoringFormat);
                    }
                }

                state.originalConsensus[state.currentFormat] = deepCopy(state.players);

                state.positionFilter = 'ALL';
                if (typeof updatePositionFilterButton === 'function') {
                    updatePositionFilterButton();
                }

                state.history.undoStack = [];
                state.history.redoStack = [];
                if (typeof updateUndoRedoButtons === 'function') {
                    updateUndoRedoButtons();
                }

                recalculateRanks();
                filterPlayers();
                if (typeof updateDynamicTitle === 'function') updateDynamicTitle();
                if (typeof syncToggleVisuals === 'function') syncToggleVisuals();

                // Mark as loaded from cloud (not anonymous work)
                state.isAnonymousWork = false;
                state.hasModifications = false; // Changed to false - this is existing saved work

                return true;
            }
        }

        return false;
    } catch (error) {
        console.error('Failed to load cloud data:', error);
        return false;
    }
}


// Update the auth state listener to auto-load
function updateAuthUI(user) {
    const authBtn = document.getElementById('authBtn');
    const authIcon = document.getElementById('authIcon');
    const authText = document.getElementById('authText');
    const refreshBtn = document.getElementById('refreshConsensusBtn');

    if (!authBtn) return; // Guard against missing elements

    if (user) {
        // User is signed in
        authBtn.onclick = signOutUser;
        authIcon.innerHTML = '<path fill-rule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clip-rule="evenodd" />';
        authIcon.setAttribute('fill', 'currentColor');
        authIcon.setAttribute('viewBox', '0 0 20 20');

        authText.innerHTML = '<span class="md:hidden">Sign out</span><span class="hidden md:inline">Sign out</span>';

        // Show refresh consensus button
        if (refreshBtn) {
            refreshBtn.style.display = 'flex';
        }

        updateDynamicTitle(); // Update title with user's name
    } else {
        // User is not signed in
        authBtn.onclick = signInWithGoogle;
        authIcon.innerHTML = '<path fill="#e5e5e5" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />';
        authIcon.setAttribute('viewBox', '0 0 48 48');

        authText.innerHTML = '<span class="md:hidden">Sign in</span><span class="hidden md:inline">Sign in with Google</span>';

        // Hide refresh consensus button
        if (refreshBtn) {
            refreshBtn.style.display = 'none';
        }
    }
}

window.updateAuthUI = updateAuthUI;
window.refreshToExpertConsensus = refreshToExpertConsensus;
window.signInWithGoogle = signInWithGoogle;


// Printable generation
function generatePrintableHTML() {
    // Get user info for title - use Firebase user if signed in, otherwise fallback
    const user = window.firebase?.auth?.currentUser;
    const rankerName = user ? (user.displayName || 'Your') : 'Your';

    let possessiveName;
    if (rankerName.toLowerCase() === 'your') {
        possessiveName = rankerName; // No possessive for "Your"
    } else if (rankerName.toLowerCase().endsWith('s')) {
        possessiveName = rankerName + "'";
    } else {
        possessiveName = rankerName + "'s";
    }

    const title = `${possessiveName} ${cfg.year} ${state.currentFormat} Rankings`;
    const perCol = 30, perPage = 60;

    const genPlayer = p => {
        const [first, ...last] = p.name.split(/\s+/);
        const riskClass = p.risk ? `risk-${p.risk.toLowerCase()}` : '';
        return `<div class="player ${riskClass}">
            <div class="rank">${p.overallRank}</div>
            <div class="position ${p.position}">${p.position}${p.positionRank}</div>
            <div class="player-info">
                <div class="name"><div class="first-name">${first}</div><div class="last-name">${last.join(' ')}</div></div>
                <div class="team-adp">
                    <span class="team">${p.team}</span>
                    ${p.adp ? `<span class="adp">ADP: ${p.adp}</span>` : ''}
                </div>
            </div>
            <div class="notes">${p.notes || ''}</div>
        </div>`;
    };

    const genColumn = players => players.map(genPlayer).join('');

    const pages = [];
    for (let i = 0; i < state.players.length; i += perPage) {
        const pageNum = Math.floor(i / perPage) + 1;
        pages.push(`<div class="page">
            <div class="header">
                <div class="subtitle">${title} - Generated on ${new Date().toLocaleDateString()}</div>
                <div class="url-header">${window.location.origin}</div>
            </div>
            <div class="columns">
                <div class="column">${genColumn(state.players.slice(i, i + perCol))}</div>
                <div class="column">${genColumn(state.players.slice(i + perCol, i + perPage))}</div>
            </div>
            <div class="page-footer">
                <span>${window.location.hostname}</span>
                <span>Page ${pageNum} of ${Math.ceil(state.players.length / perPage)}</span>
            </div>
        </div>`);
    }

    const styles = `
*{margin:0;padding:0;box-sizing:border-box}body{font:10px/1.1 Arial,sans-serif;color:#333;background:#fff}
.page{width:8.5in;height:11in;margin:0 auto;padding:.2in;page-break-after:always;position:relative;display:flex;flex-direction:column}
.page:last-child{page-break-after:avoid}.header{text-align:center;margin-bottom:.1in;padding-bottom:3px;display:flex;justify-content:space-between;align-items:center}
.url-header{font-size:9px;color:#666}.subtitle{font-size:10px;color:#666;flex-grow:1}
.columns{display:flex;gap:.1in;flex-grow:1}.column{width:3.85in}
.player{position:relative;margin-bottom:2px;height:28px;width:3.85in;border-radius:2px;border-left:3px solid #d1d5db}
.player.risk-high{border-left:3px solid #dc2626}
.player.risk-medium{border-left:3px solid #d97706}
.player.risk-low{border-left:3px solid #16a34a}
.rank{position:absolute;left:4px;top:6px;width:18px;height:16px;font:bold 11px/16px Arial;color:#111;text-align:center}
.position{position:absolute;left:25px;top:6px;width:28px;height:16px;font:bold 7px/16px Arial;text-align:center;color:#000}
.player-info{position:absolute;left:56px;top:2px;width:85px;height:24px;overflow:hidden}
.name{font:bold 8px/9px Arial}.first-name,.last-name{display:block;height:9px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.team-adp{font-size:6px;height:7px;line-height:7px;display:flex;justify-content:space-between}
.team{color:#666}.adp{color:#888}
.notes{position:absolute;left:144px;top:2px;width:2.25in;height:24px;background:#fff;border:1px solid #d1d5db;
border-radius:2px;padding:2px 3px;font-size:6px;color:#374151;word-wrap:break-word;overflow:hidden;line-height:7px}
.page-footer{position:absolute;bottom:.1in;left:.2in;right:.2in;display:flex;justify-content:space-between;font-size:9px;color:#666}
@media print{body{margin:0}.page{margin:0;page-break-after:always}.page:last-child{page-break-after:avoid}}`;
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>${styles}</style></head><body>${pages.join('')}</body></html>`;
}