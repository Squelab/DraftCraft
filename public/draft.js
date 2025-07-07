// Draft Room State Management
const state = {
    players: [],
    filteredPlayers: [],
    currentFormat: 'PPR',
    positionFilter: 'ALL',
    toggles: {
        adp: false,
        tiers: false,
        risk: true,
        notes: true
    },
    notesModal: {
        isNotesOpen: false,
        currentPlayerId: null
    }
};

const draftState = {
    recentlyDrafted: [], // max 3 players
    isMinimized: false,
    allDraftedPlayers: []
};

// Configuration
const cfg = {
    year: new Date().getFullYear(),
    skillPositions: ['RB', 'WR', 'TE', 'QB'],
    positionFilters: ['ALL', 'RB', 'WR', 'TE', 'QB'],
    styles: {
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
            'ALL': 'alt-slate-700 border-slate-500',
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

function waitForFirebase() {
    return new Promise((resolve) => {
        if (window.firebase?.auth) {
            resolve();
        } else {
            setTimeout(() => waitForFirebase().then(resolve), 50);
        }
    });
}

// Tier system state and functions
const tierState = {
    bars: [
        { id: 'tier-a', label: 'A', color: '#E6A566', abovePlayerId: null, belowPlayerId: null },
        { id: 'tier-b', label: 'B', color: '#C4D470', abovePlayerId: null, belowPlayerId: null },
        { id: 'tier-c', label: 'C', color: '#8FBC8F', abovePlayerId: null, belowPlayerId: null },
        { id: 'tier-d', label: 'D', color: '#87CEEB', abovePlayerId: null, belowPlayerId: null },
        { id: 'tier-e', label: 'E', color: '#9370DB', abovePlayerId: null, belowPlayerId: null },
        { id: 'tier-f', label: 'F', color: '#DDA0DD', abovePlayerId: null, belowPlayerId: null }
    ]
};

// Load user's saved rankings
function initializeRankings() {
    // Load rankings from localStorage (passed from main page)
    const draftData = localStorage.getItem('draftRankings');
    if (draftData) {
        const data = JSON.parse(draftData);
        state.players = data.players;
        state.currentFormat = data.currentFormat;

        // Import toggle states from main.js
        if (data.toggles) {
            state.toggles = { ...state.toggles, ...data.toggles };
            console.log('Imported toggle states:', state.toggles);
        }

        // Import tier positions from main.js
        if (data.tierPositions) {
            data.tierPositions.forEach(savedTier => {
                const tier = tierState.bars.find(t => t.id === savedTier.id);
                if (tier) {
                    tier.abovePlayerId = savedTier.abovePlayerId;
                    tier.belowPlayerId = savedTier.belowPlayerId;
                }
            });
            console.log('Imported tier positions');
        }

        // Set the title from main page
        if (data.title) {
            const titleElement = document.getElementById('dynamicTitle');
            if (titleElement) {
                // Convert from rankings title to draft room title
                const draftTitle = data.title.replace('Rankings', 'Draft Room');
                titleElement.textContent = draftTitle;
            }
        }

        // Clean up localStorage
        localStorage.removeItem('draftRankings');
        filterPlayers();

        // Apply display settings based on imported toggles
        syncDisplaySettings();

        console.log('Loaded rankings from main page (' + state.players.length + ' players)');
    } else {
        console.log('No rankings data found');
    }
}

// Apply display settings from toggle states
function syncDisplaySettings() {
    // Apply ADP display
    if (state.toggles.adp) {
        document.body.classList.add('adp-visible');
    } else {
        document.body.classList.remove('adp-visible');
    }

    // Apply risk display
    if (state.toggles.risk) {
        document.body.classList.add('risk-visible');
    } else {
        document.body.classList.remove('risk-visible');
    }

    // Apply notes display
    if (state.toggles.notes) {
        document.body.classList.add('notes-visible');
    } else {
        document.body.classList.remove('notes-visible');
    }

    // Apply tiers display
    if (state.toggles.tiers) {
        document.body.classList.add('tiers-visible');
        initializeTierSystem();
    } else {
        document.body.classList.remove('tiers-visible');
        // Hide all tier bars
        document.querySelectorAll('.tier-bar').forEach(bar => {
            bar.style.display = 'none';
        });
    }

    updateNotesPosition();
}

function updateNotesPosition() {
    const isRiskDisabled = !state.toggles.risk;
    const isNotesEnabled = state.toggles.notes;

    document.querySelectorAll('.notes-icon').forEach(icon => {
        if (isNotesEnabled && isRiskDisabled) {
            icon.style.transform = 'translateX(48px)';
        } else {
            icon.style.transform = 'translateX(0)';
        }
    });
}

// Search functionality
function advancedPlayerSearch(player, searchTerm) {
    if (!searchTerm) return true;

    const normalize = (str) => {
        return str.toLowerCase()
            .replace(/[''`]/g, "'")
            .replace(/[^\w\s']/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    };

    const normalizedSearch = normalize(searchTerm);
    const normalizedName = normalize(player.name);
    const normalizedTeam = normalize(player.team);

    const nameMatches = (searchWord) => {
        if (normalizedName.includes(searchWord)) return true;
        const nameParts = normalizedName.split(' ');
        if (nameParts.some(part => part.startsWith(searchWord))) return true;
        return false;
    };

    const teamMatches = (searchWord) => {
        return normalizedTeam.includes(searchWord) || normalizedTeam.startsWith(searchWord);
    };

    const searchWords = normalizedSearch.split(' ').filter(word => word.length > 0);
    return searchWords.every(word => nameMatches(word) || teamMatches(word));
}

function filterPlayers() {
    const search = $('searchInput').value.toLowerCase();

    if (state.positionFilter === 'ALL') {
        state.filteredPlayers = state.players.filter(p =>
            !isDrafted(p.id) && advancedPlayerSearch(p, search)
        );
    } else {
        state.filteredPlayers = state.players.filter(p =>
            p.position === state.positionFilter &&
            !isDrafted(p.id) &&
            advancedPlayerSearch(p, search)
        );
    }

    renderPlayers();
    renderRecentlyDrafted();

    // Force tier bars to render after players are rendered
    if (state.toggles.tiers) {
        setTimeout(() => {
            insertTierBars();
            positionTierBars();
        }, 10);
    }
}

// Draft functionality
function isDrafted(playerId) {
    return draftState.allDraftedPlayers.some(p => p.id === playerId);
}

function draftPlayer(playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    // Add to ALL drafted players (newest first)
    draftState.allDraftedPlayers.unshift(player);

    // Update recently drafted display (first 3 from allDraftedPlayers)
    updateRecentlyDraftedDisplay();

    // Re-render both sections
    filterPlayers();

    console.log(`Drafted: ${player.name}`);
}

function undraftPlayer(playerId) {
    // Remove from ALL drafted players
    const allIndex = draftState.allDraftedPlayers.findIndex(p => p.id === playerId);
    if (allIndex !== -1) {
        draftState.allDraftedPlayers.splice(allIndex, 1);
    }

    // Update recently drafted display (first 3 from remaining allDraftedPlayers)
    updateRecentlyDraftedDisplay();

    filterPlayers();
    console.log(`Undrafted player with ID: ${playerId}`);
}

function updateRecentlyDraftedDisplay() {
    // Always show the 3 most recent from allDraftedPlayers
    draftState.recentlyDrafted = draftState.allDraftedPlayers.slice(0, 3);
}

function toggleMinimize() {
    draftState.isMinimized = !draftState.isMinimized;
    const list = $('recentlyDraftedList');
    const btn = $('minimizeBtn');

    if (draftState.isMinimized) {
        list.style.display = 'none';
        btn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"></path>
            </svg>
        `;
        btn.title = 'Expand';
    } else {
        list.style.display = 'block';
        btn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"></path>
            </svg>
        `;
        btn.title = 'Minimize';
    }
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

// Search input handling
function handleSearchInput() {
    const searchInput = $('searchInput');
    const searchValue = searchInput.value;
    let clearBtn = $('clearSearch');

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

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'position: relative; flex-grow: 1;';

        searchInput.parentNode.insertBefore(wrapper, searchInput);
        wrapper.appendChild(searchInput);
        wrapper.appendChild(clearBtn);

        searchInput.classList.remove('flex-grow');
        searchInput.style.width = '100%';
    }

    clearBtn.style.display = searchValue.length > 0 ? 'block' : 'none';
    filterPlayers();
}

function createRiskButton(player) {
    if (!state.toggles.risk) return '';

    const risk = player?.risk || 'Medium';
    const riskLetter = risk[0] || 'M';

    const riskStyles = {
        High: 'bg-red-600 border-red-500',
        Medium: 'bg-yellow-600 border-yellow-500',
        Low: 'bg-green-600 border-green-500'
    };

    return `
        <div class="risk-display ${riskStyles[risk]} border-2 w-10 h-10 rounded text-sm font-bold text-white flex items-center justify-center opacity-75" title="Risk: ${risk}">
            ${riskLetter}
        </div>
    `;
}

function handleClearSearch() {
    const searchInput = $('searchInput');
    searchInput.value = '';
    $('clearSearch').style.display = 'none';
    searchInput.focus();
    filterPlayers();
}

// Notes Modal Functions
function openNotesModal(playerId) {
    const player = state.players.find(p => p.id === playerId);
    if (!player) return;

    state.notesModal.isNotesOpen = true;
    state.notesModal.currentPlayerId = playerId;

    $('notesModalTitle').textContent = `${player.name} - Notes`;
    const textarea = $('notesModalTextarea');
    textarea.value = player.notes || 'No notes available';
    textarea.readOnly = true; // Make it read-only
    textarea.style.backgroundColor = '#374151'; // Darker background to show it's read-only
    textarea.style.cursor = 'default';

    $('notesModal').classList.remove('hidden');
}

function closeNotesModal() {
    if (!state.notesModal.isNotesOpen) return;

    // DON'T save notes - just close
    state.notesModal.isNotesOpen = false;
    state.notesModal.currentPlayerId = null;
    $('notesModal').classList.add('hidden');
}

// Rendering functions
function createNotesIcon(player) {
    if (!state.toggles.notes) return '';

    return `
        <button onclick="openNotesModal('${player.id}')" class="notes-icon bg-slate-600 border-2 border-slate-500 w-10 h-10 rounded text-white hover:bg-slate-700 transition-all duration-200 flex items-center justify-center" title="View notes">
            <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
            </svg>
        </button>
    `;
}

function renderRecentlyDrafted() {
    const container = $('recentlyDraftedList');

    const html = draftState.recentlyDrafted.map((p, i) => `
        <div class="player-item ${cfg.styles.posColors[p.position]} hover:shadow-lg" data-player-id="${p.id}">
            <div class="p-2 gap-2 flex items-stretch">
                <div class="flex flex-grow items-stretch lg:items-center lg:gap-1 cursor-pointer" onclick="undraftPlayer('${p.id}')">
                    <div class="w-12 flex flex-col items-center justify-center lg:w-12 lg:text-center lg:flex-shrink-0">
                        <div class="text-mega font-bold text-gray-100 lg:text-2xl">${p.overallRank || '-'}</div>
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
                                ${state.toggles.adp && p.adp ? `<span class="ml-2 text-gray-400">ADP: ${p.adp}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                ${createNotesIcon(p) ? `<div class="w-10 flex items-center flex-shrink-0">${createNotesIcon(p)}</div>` : ''}
                ${createRiskButton(p) ? `<div class="w-10 flex items-center flex-shrink-0">${createRiskButton(p)}</div>` : ''}
            </div>
        </div>
    `).join('');

    container.innerHTML = html;
}

function renderPlayers() {
    const container = $('playersList');

    const html = state.filteredPlayers.map((p, i) => `
        <div class="player-item ${cfg.styles.posColors[p.position]} hover:shadow-lg" data-player-id="${p.id}" data-index="${i}">
            <div class="p-2 gap-2 flex items-stretch">
                <div class="flex flex-grow items-stretch lg:items-center lg:gap-1 cursor-pointer" onclick="draftPlayer('${p.id}')">
                    <div class="w-12 flex flex-col items-center justify-center lg:w-12 lg:text-center lg:flex-shrink-0">
                        <div class="text-mega font-bold text-gray-100 lg:text-2xl">${p.overallRank || '-'}</div>
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
                                ${state.toggles.adp && p.adp ? `<span class="ml-2 text-gray-400">ADP: ${p.adp}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                ${createNotesIcon(p) ? `<div class="w-10 flex items-center flex-shrink-0">${createNotesIcon(p)}</div>` : ''}
                ${createRiskButton(p) ? `<div class="w-10 flex items-center flex-shrink-0">${createRiskButton(p)}</div>` : ''}
            </div>
        </div>
    `).join('');

    container.innerHTML = html;

    // Add tier bars if tiers are enabled
    if (state.toggles.tiers) {
        insertTierBars();
        positionTierBars();
    }
}

// Tier bar creation and positioning functions
function createTierBar(tier) {
    return `
        <div id="${tier.id}" class="tier-bar" style="background: ${tier.color}; display: none;">
            <div class="tier-label">${tier.label}</div>
        </div>
    `;
}

function insertTierBars() {
    const playersList = document.getElementById('playersList');

    // Remove any existing tier bars first
    document.querySelectorAll('.tier-bar').forEach(bar => bar.remove());

    // Create S-tier (always at top)
    const sTierBar = `
        <div id="tier-s" class="tier-bar tier-s-bar" style="background: #E8867C; display: none;">
            <div class="tier-label">S</div>
        </div>
    `;
    playersList.insertAdjacentHTML('afterbegin', sTierBar);

    // Add other tier bars
    tierState.bars.forEach(tier => {
        playersList.insertAdjacentHTML('beforeend', createTierBar(tier));
    });
}

function positionTierBars() {
    if (!state.toggles.tiers) return;

    // Always show S-tier at the top when tiers are enabled
    const sTierBar = document.getElementById('tier-s');
    if (sTierBar) {
        sTierBar.style.display = 'flex';
        const playersList = document.getElementById('playersList');
        if (playersList && playersList.firstChild !== sTierBar) {
            playersList.insertBefore(sTierBar, playersList.firstChild);
        }
    }

    const visiblePlayerItems = Array.from(document.querySelectorAll('.player-item:not(.available-player)'));

    tierState.bars.forEach(tier => {
        const tierBar = document.getElementById(tier.id);
        if (!tierBar) return;

        let insertPosition = null;

        if (state.positionFilter === 'ALL') {
            let insertAfterIndex = -1;

            if (tier.abovePlayerId && tier.belowPlayerId) {
                const aboveIndex = visiblePlayerItems.findIndex(item => item.dataset.playerId === tier.abovePlayerId);
                const belowIndex = visiblePlayerItems.findIndex(item => item.dataset.playerId === tier.belowPlayerId);

                if (aboveIndex !== -1 && belowIndex !== -1 && belowIndex === aboveIndex + 1) {
                    insertAfterIndex = aboveIndex;
                } else if (aboveIndex !== -1) {
                    insertAfterIndex = aboveIndex;
                } else if (belowIndex !== -1) {
                    insertAfterIndex = belowIndex - 1;
                } else {
                    tierBar.style.display = 'none';
                    return;
                }
            } else if (tier.abovePlayerId) {
                const aboveIndex = visiblePlayerItems.findIndex(item => item.dataset.playerId === tier.abovePlayerId);
                if (aboveIndex !== -1) {
                    insertAfterIndex = aboveIndex;
                }
            } else if (tier.belowPlayerId) {
                const belowIndex = visiblePlayerItems.findIndex(item => item.dataset.playerId === tier.belowPlayerId);
                if (belowIndex !== -1) {
                    insertAfterIndex = belowIndex - 1;
                }
            }

            if (insertAfterIndex >= 0 && insertAfterIndex < visiblePlayerItems.length) {
                insertPosition = visiblePlayerItems[insertAfterIndex];
            }

        } else {
            // Position filtering logic (simplified for draft room)
            const globalPlayerOrder = state.players;

            let aboveGlobalIndex = tier.abovePlayerId ?
                globalPlayerOrder.findIndex(p => p.id === tier.abovePlayerId) : -1;
            let belowGlobalIndex = tier.belowPlayerId ?
                globalPlayerOrder.findIndex(p => p.id === tier.belowPlayerId) : -1;

            if (aboveGlobalIndex !== -1 || belowGlobalIndex !== -1) {
                let targetGlobalIndex = -1;

                if (aboveGlobalIndex !== -1 && belowGlobalIndex !== -1) {
                    targetGlobalIndex = aboveGlobalIndex;
                } else if (aboveGlobalIndex !== -1) {
                    targetGlobalIndex = aboveGlobalIndex;
                } else {
                    targetGlobalIndex = belowGlobalIndex - 1;
                }

                let bestInsertIndex = -1;
                let bestGlobalIndex = Infinity;

                visiblePlayerItems.forEach((item, visibleIndex) => {
                    const playerId = item.dataset.playerId;
                    const globalIndex = globalPlayerOrder.findIndex(p => p.id === playerId);

                    if (globalIndex >= targetGlobalIndex && globalIndex < bestGlobalIndex) {
                        bestGlobalIndex = globalIndex;
                        bestInsertIndex = visibleIndex - 1;
                    }
                });

                if (bestInsertIndex === -1 && visiblePlayerItems.length > 0) {
                    bestInsertIndex = visiblePlayerItems.length - 1;
                }

                if (bestInsertIndex >= 0) {
                    insertPosition = visiblePlayerItems[bestInsertIndex];
                }
            }
        }

        // Insert the tier bar
        if (insertPosition) {
            insertPosition.parentNode.insertBefore(tierBar, insertPosition.nextSibling);
            tierBar.style.display = 'flex';
        } else {
            tierBar.style.display = 'none';
        }
    });
}

function initializeTierSystem() {
    insertTierBars();
    // Note: No dragging setup since tier bars are display-only in draft room
}

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Set up event listeners
    const eventMap = {
        searchInput: ['input', debounce(handleSearchInput, 150)],
        notesModalClose: ['click', closeNotesModal],
        clearSearch: ['click', handleClearSearch],
        positionFilter: ['click', cyclePositionFilter],
        minimizeBtn: ['click', toggleMinimize],
        backToRankings: ['click', () => window.location.href = 'index.html']
    };

    Object.entries(eventMap).forEach(([id, [event, handler]]) => {
        const element = $(id);
        if (element) {
            on(element, event, handler);
        }
    });

    // Notes modal click outside to close
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
        if (e.key === 'Escape' && state.notesModal.isNotesOpen) {
            closeNotesModal();
        }
    });

    // Initialize directly
    setTimeout(() => {
        initializeRankings();
        updatePositionFilterButton();
    }, 100);
});

// Global functions
window.draftPlayer = draftPlayer;
window.undraftPlayer = undraftPlayer;
window.openNotesModal = openNotesModal;