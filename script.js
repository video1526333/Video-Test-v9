// Add this at the top of script.js, before DOMContentLoaded
// Initialize NoSleep globally for wake-lock
const noSleep = new NoSleep();

function getWatchHistory() {
    return JSON.parse(localStorage.getItem('watchHistory') || '[]');
}

function getPlaybackPositions() {
    return JSON.parse(localStorage.getItem('playbackPositions') || '{}');
}
function savePlaybackPosition(videoId, episodeName, time) {
    const positions = getPlaybackPositions();
    const key = `${videoId}||${(episodeName || '').trim()}`;
    positions[key] = time;
    localStorage.setItem('playbackPositions', JSON.stringify(positions));
    console.log('[Resume Debug][save] key:', key, 'time:', time, 'positions:', positions);
}
function getPlaybackPosition(videoId, episodeName) {
    const positions = getPlaybackPositions();
    const key = `${videoId}||${(episodeName || '').trim()}`;
    const value = positions[key] || 0;
    console.log('[Resume Debug][get] key:', key, 'value:', value, 'positions:', positions);
    return value;
}
function getWatchedEpisodes() {
    return JSON.parse(localStorage.getItem('watchedEpisodes') || '{}');
}
function addToWatchHistory(videoId, episodeName) {
    console.log('[DEBUG] addToWatchHistory called with:', videoId, episodeName);
    const history = getWatchHistory();
    const timestamp = new Date().toISOString();
    // Avoid duplicate consecutive entries
    if (history.length > 0) {
        const last = history[history.length - 1];
        if (last.videoId === videoId && last.episodeName === episodeName) {
            console.log('[DEBUG] Duplicate consecutive entry. Skipping.');
            return;
        }
    }
    history.push({ videoId, episodeName, timestamp });
    // Limit history to 100 items
    if (history.length > 100) history.shift();
    localStorage.setItem('watchHistory', JSON.stringify(history));
    console.log('[DEBUG] watchHistory after push:', history);
}

function markEpisodeWatched(videoId, episodeName) {
    console.log('[DEBUG] markEpisodeWatched called with:', videoId, episodeName);
    const watched = getWatchedEpisodes();
    if (!watched[videoId]) watched[videoId] = [];
    if (!watched[videoId].includes(episodeName)) {
        watched[videoId].push(episodeName);
        localStorage.setItem('watchedEpisodes', JSON.stringify(watched));
    }
    // Also add to watch history
    addToWatchHistory(videoId, episodeName);
}
function isEpisodeWatched(videoId, episodeName) {
    const watched = getWatchedEpisodes();
    return watched[videoId] && watched[videoId].includes(episodeName);
}


document.addEventListener('DOMContentLoaded', () => {
    // Wake Lock overlay: enable on first touch or click
    const overlay = document.getElementById('wakeOverlay');
    function enableWakeLock(e) {
        if (e) e.preventDefault();
        noSleep.enable();
        console.log('Wake Lock enabled');
        if (overlay) overlay.remove();
    }
    if (overlay) {
        overlay.addEventListener('touchend', enableWakeLock, { once: true, passive: false });
        overlay.addEventListener('click', enableWakeLock, { once: true });
    }

    // --- Watch History Modal Logic ---
    const watchHistoryButton = document.getElementById('watchHistoryButton');
    const watchHistoryModal = document.getElementById('watchHistoryModal');
    const watchHistoryList = document.getElementById('watchHistoryList');
    const closeWatchHistoryButton = watchHistoryModal ? watchHistoryModal.querySelector('.close-button') : null;

    if (watchHistoryButton && watchHistoryModal && watchHistoryList && closeWatchHistoryButton) {
        watchHistoryButton.addEventListener('click', () => {
            renderWatchHistory();
            watchHistoryModal.classList.add('open');
            if (typeof updateBodyScrollLock === 'function') updateBodyScrollLock();
        });
        closeWatchHistoryButton.addEventListener('click', () => {
            watchHistoryModal.classList.remove('open');
            if (typeof updateBodyScrollLock === 'function') updateBodyScrollLock();
        });
        window.addEventListener('click', (event) => {
            if (event.target === watchHistoryModal) {
                watchHistoryModal.classList.remove('open');
                if (typeof updateBodyScrollLock === 'function') updateBodyScrollLock();
            }
        });
    }


    // Use a public CORS proxy instead of a local server
    const apiUrl = 'https://api.yzzy-api.com/inc/api_mac10.php';
    // Cors proxies options (if one fails, will try the next)
    const corsProxies = [
        'https://corsproxy.io/?',                         // Working proxy - first option
        'https://cors.eu.org/',                           // Option 2
        'https://thingproxy.freeboard.io/fetch/?url=',    // Option 3
        'https://api.allorigins.win/raw?url=',            // Option 4
        'https://api.allorigins.cf/raw?url=',             // Option 5
        'https://api.allorigins.tk/raw?url=',             // Option 6
        'https://api.codetabs.com/v1/proxy?quest=',       // Option 7
        'https://yacdn.org/proxy/',                       // Option 8
        'https://cors.bridged.cc/',                       // Option 9
        'https://cors.sho.sh/',                           // Option 10
        'https://cors.ironproxy.xyz/',                    // Option 11
        'https://norobe-cors-anywhere.herokuapp.com/',    // Option 12
        'https://corsproxy.github.io/?url=',              // Option 13
        'https://cors-proxy.elfsight.com/',               // Option 14 (failing)
        ''                                                // Direct API (may not work due to CORS)
    ];
    let currentProxyIndex = 0; // Start with the first proxy
    const categoryList = document.getElementById('categoryList');
    const videoGrid = document.getElementById('videoGrid');
    const pagination = document.getElementById('pagination');
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const categoryNav = document.getElementById('categoryNav');

    // Nav toggle for mobile
    const navToggle = document.getElementById('navToggle');
    // Settings elements
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsButton = settingsModal.querySelector('.close-button');
    const passwordInput = document.getElementById('passwordInput');
    const submitPasswordButton = document.getElementById('submitPassword');
    const passwordMessage = document.getElementById('passwordMessage');

    // Share elements
    const shareButton = document.getElementById('shareButton');
    const shareModal = document.getElementById('shareModal');
    const closeShareButton = shareModal.querySelector('.close-button');
    const shareLinkInput = document.getElementById('shareLink');
    const copyLinkButton = document.getElementById('copyLinkButton');

    // Watchlist elements
    const addToWatchListButton = document.getElementById('addToWatchListButton');
    const mobileWatchListButton = document.getElementById('mobileWatchListButton');
    // --- All User Data Export/Import ---
    const exportAllUserDataButton = document.getElementById('exportAllUserDataButton');
    const importAllUserDataInput = document.getElementById('importAllUserDataInput');
    const importAllUserDataButton = document.getElementById('importAllUserDataButton');

    // Export all user data to JSON
    function exportAllUserData() {
        const data = {
            watchedEpisodes: getWatchedEpisodes(),
            playbackPositions: getPlaybackPositions(),
            watchList: JSON.parse(localStorage.getItem('watchList') || '[]')
        };
        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'video_portal_userdata.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('All user data exported!', 'info');
    }

    // Import all user data from JSON file
    function importAllUserData(event) {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function (e) {
            try {
                const imported = JSON.parse(e.target.result);
                if (imported.watchedEpisodes) {
                    localStorage.setItem('watchedEpisodes', JSON.stringify(imported.watchedEpisodes));
                }
                if (imported.playbackPositions) {
                    localStorage.setItem('playbackPositions', JSON.stringify(imported.playbackPositions));
                }
                if (imported.watchList) {
                    localStorage.setItem('watchList', JSON.stringify(imported.watchList));
                    watchList = imported.watchList;
                }
                showToast('All user data imported!', 'info');
                // Optionally refresh UI to reflect new data
                settingsModal.classList.remove('open');
                updateBodyScrollLock && updateBodyScrollLock();
                // Optionally reload page
                // location.reload();
            } catch (err) {
                console.error(err);
                showToast('Failed to import user data', 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    // Wire up events
    exportAllUserDataButton && exportAllUserDataButton.addEventListener('click', exportAllUserData);
    importAllUserDataButton && importAllUserDataButton.addEventListener('click', () => importAllUserDataInput.click());
    importAllUserDataInput && importAllUserDataInput.addEventListener('change', importAllUserData);


    // Current video ID (for sharing)
    let currentVideoId = null;
    // Watch list storage in localStorage
    let watchList = JSON.parse(localStorage.getItem('watchList') || '[]');

    // Password configuration
    const correctPassword = '12345678';

    // Check if password is stored in localStorage
    const checkStoredPassword = () => {
        const isAuthenticated = localStorage.getItem('authenticated') === 'true';
        if (isAuthenticated) {
            categoryNav.classList.add('visible');
        }
        return isAuthenticated;
    };

    // Show the category bar by default (even when not authenticated)
    // But will still restrict which categories are shown
    categoryNav.classList.add('visible');

    // Default category ID - Set to 16 for "香港剧"
    const defaultCategoryId = "16";
    // Second restricted category ID - 13 
    const secondRestrictedCategoryId = "13";
    // Array of restricted category IDs to show when not authenticated
    const restrictedCategoryIds = [defaultCategoryId, secondRestrictedCategoryId];

    // Modal elements
    const modal = document.getElementById('videoDetailModal');
    const closeModalButton = modal.querySelector('.close-button');
    const modalTitle = document.getElementById('modalTitle');
    const modalPoster = document.getElementById('modalPoster');
    const modalYear = document.getElementById('modalYear');
    const modalArea = document.getElementById('modalArea');
    const modalLang = document.getElementById('modalLang');
    const modalDirector = document.getElementById('modalDirector');
    const modalActors = document.getElementById('modalActors');
    const modalRemarks = document.getElementById('modalRemarks');
    const modalDescription = document.getElementById('modalDescription');
    const modalEpisodes = document.getElementById('modalEpisodes');

    // Video player modal elements
    const videoPlayerModal = document.getElementById('videoPlayerModal');
    const closeVideoPlayerButton = videoPlayerModal.querySelector('.close-button');
    const videoPlayer = document.getElementById('videoPlayer');
    const playingTitle = document.getElementById('playingTitle');
    let videojsPlayer = null;
    let hlsPlayer = null;

    let currentPage = 1;
    let currentCategory = ''; // Store category ID
    let currentSearch = ''; // Store search term
    let totalPages = 1;
    let isLoading = false; // Flag to prevent multiple simultaneous loads
    let hasMoreContent = true; // Flag to track if more content is available

    const toastContainer = document.getElementById('toastContainer');

    // Create back to top button
    const backToTopBtn = document.createElement('button');
    backToTopBtn.id = 'backToTop';
    backToTopBtn.innerHTML = '&uarr;';
    backToTopBtn.title = 'Back to Top';
    document.body.appendChild(backToTopBtn);

    // Nav toggle event for mobile
    if (navToggle) {
        navToggle.addEventListener('click', () => {
            categoryNav.classList.toggle('open');
            navToggle.setAttribute('aria-expanded', categoryNav.classList.contains('open'));
        });
        // Close nav on outside click
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768 && categoryNav.classList.contains('open')) {
                if (!categoryNav.contains(e.target) && e.target !== navToggle) {
                    categoryNav.classList.remove('open');
                    navToggle.setAttribute('aria-expanded', 'false');
                }
            }
        });
    }

    /**
     * Show a toast notification
     * @param {string} message - Text to display
     * @param {string} type - 'error' or 'info'
     * @param {number} duration - millisecs to display
     */
    function showToast(message, type = 'info', duration = 4000) {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);
        // force reflow for transition
        requestAnimationFrame(() => toast.classList.add('show'));
        // remove after duration
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => {
                toast.remove();
            });
        }, duration);
    }

    // --- Helper Functions ---
    function showLoading() {
        loadingIndicator.style.display = 'block';
        isLoading = true;
    }

    function hideLoading() {
        loadingIndicator.style.display = 'none';
        isLoading = false;
    }

    // Update fetchData to accept maxRetries and retryDelay
    async function fetchData(params, silent = false, maxRetries = null, retryDelay = null) {
        if (!silent) showLoading();
        const FETCH_TIMEOUT = 10000; // 10 seconds
        const rawQuery = Object.entries(params)
            .map(([key, val]) => `${key}=${val}`)
            .join('&');
        const targetUrlRaw = `${apiUrl}?${rawQuery}`;
        const originalProxyIndex = currentProxyIndex;
        let proxyAttempts = 0;
        let success = false;
        let responseData = null;
        const maxTotalTries = maxRetries ? Math.min(maxRetries, corsProxies.length) : corsProxies.length;
        const delayMs = retryDelay || 0;
        while (!success && proxyAttempts < maxTotalTries) {
            const prefix = corsProxies[currentProxyIndex];
            let fetchUrl;
            if (prefix) {
                const [basePart, queryPart] = targetUrlRaw.split('?');
                fetchUrl = prefix + encodeURIComponent(basePart) + (queryPart ? '?' + queryPart : '');
            } else {
                fetchUrl = targetUrlRaw;
            }
            try {
                console.log(`Fetching via CORS proxy ${currentProxyIndex + 1}: ${fetchUrl}`);
                console.log('Request params:', params);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
                const response = await fetch(fetchUrl, {
                    signal: controller.signal,
                    mode: 'cors',
                    cache: 'no-cache'
                }).finally(() => {
                    clearTimeout(timeoutId);
                });
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                if (data.code !== 1) {
                    console.error('API Error:', data.msg);
                    throw new Error(`API Error: ${data.msg}`);
                }
                success = true;
                responseData = data;
                console.log('API Response:', data);
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.error(`Fetch timeout with proxy ${currentProxyIndex + 1}`);
                    if (!silent) showToast('Request timed out. Trying another connection...', 'info', 1500);
                } else {
                    console.error(`Fetch Error with proxy ${currentProxyIndex + 1}:`, error);
                }
                currentProxyIndex = (currentProxyIndex + 1) % corsProxies.length;
                proxyAttempts++;
                if (proxyAttempts >= maxTotalTries) {
                    if (!silent) showToast(`Failed to fetch data: ${error.message}`, 'error');
                } else if (!silent && proxyAttempts % 2 === 0) {
                    showToast(`Switching to alternative connection...`, 'info', 1500);
                }
                // Always delay before next retry if set
                if (delayMs > 0 && proxyAttempts < maxTotalTries) {
                    await new Promise(r => setTimeout(r, delayMs));
                }
            }
        }
        if (!silent) hideLoading();
        return responseData;
    }

    // --- Core Functions ---

    async function loadCategories() {
        // Fetch any list page to get categories (they are included in list responses)
        const data = await fetchData({ ac: 'list', pg: 1 });
        if (!data || !data.class) {
            console.error("Could not load categories.");
            return;
        }

        // Clear previous categories
        categoryList.innerHTML = '';

        // Check if user is authenticated
        const isAuthenticated = checkStoredPassword();

        // Only add "All" option if authenticated
        if (isAuthenticated) {
            const allLi = document.createElement('li');
            allLi.textContent = 'All';
            allLi.dataset.id = '';
            // Only mark as active if defaultCategoryId is empty string
            if (defaultCategoryId === '') {
                allLi.classList.add('active');
            }
            categoryList.appendChild(allLi);
        }

        data.class.forEach(cat => {
            // Sometimes type_name can be null, handle it
            if (cat.type_name) {
                // If not authenticated, only show restricted categories (16 and 13)
                if (!isAuthenticated && !restrictedCategoryIds.includes(cat.type_id)) {
                    return; // Skip this category
                }

                const li = document.createElement('li');
                li.textContent = cat.type_name;
                li.dataset.id = cat.type_id;
                // Set the default category as active
                if (cat.type_id === defaultCategoryId) {
                    li.classList.add('active');
                }
                categoryList.appendChild(li);
            } else {
                console.warn(`Category ID ${cat.type_id} has null name.`);
            }
        });
        // Add Watch List option at end of categories
        const watchLi = document.createElement('li');
        watchLi.textContent = 'Watch List';
        watchLi.dataset.id = 'watchlist';
        // Mark watchlist active if defaultCategoryId corresponds
        if (defaultCategoryId === 'watchlist') {
            watchLi.classList.add('active');
        }
        categoryList.appendChild(watchLi);
        // Add Settings navigation item
        const settingsLi = document.createElement('li');
        settingsLi.textContent = '设置';
        settingsLi.id = 'settingsNav';
        categoryList.appendChild(settingsLi);
        settingsLi.addEventListener('click', (e) => {
          e.stopPropagation();
          settingsModal.classList.add('open');
          updateBodyScrollLock();
        });
        // Add Watch History navigation item
        const historyLi = document.createElement('li');
        historyLi.textContent = '观看历史';
        historyLi.id = 'historyNav';
        categoryList.appendChild(historyLi);
        historyLi.addEventListener('click', (e) => {
          e.stopPropagation();
          renderWatchHistory();
          watchHistoryModal.classList.add('open');
          updateBodyScrollLock();
        });
    }

    // Function to handle image URLs more robustly
    function getValidImageUrl(imageUrl) {
        if (!imageUrl) return null;

        // If it already starts with http/https, use it
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            return imageUrl;
        }

        // If it's a relative URL (starts with /), add domain
        if (imageUrl.startsWith('/')) {
            return 'https://pic3.yzzyimg.online' + imageUrl;
        }

        // Try to parse URLs that might be missing protocol
        if (imageUrl.startsWith('pic1.') ||
            imageUrl.startsWith('pic2.') ||
            imageUrl.startsWith('pic3.') ||
            imageUrl.startsWith('yzzyimg.')) {
            return 'https://' + imageUrl;
        }

        return null;
    }

    async function loadVideos(page = 1, categoryId = '', searchTerm = '', append = false) {
        isWatchListMode = false; // Not in watch list mode when loading normal videos
        if (isLoading || (!append && page > 1 && !hasMoreContent)) return;

        currentPage = page;
        if (!append) {
            currentCategory = categoryId;
            currentSearch = searchTerm;
            hasMoreContent = true;
        }

        // Build query params: if searching, only include wd; otherwise list + pagination + category
        let params;
        if (currentSearch) {
            params = { wd: currentSearch };
            console.log(`Searching for term: ${currentSearch}`);
        } else {
            params = { ac: 'list', pg: currentPage };
            if (currentCategory) {
                params.t = currentCategory;
            }
        }

        // Show info to user
        if (currentSearch && !append) {
            showToast(`Searching for "${currentSearch}"...`, 'info', 2000);
        }

        const data = await fetchData(params);
        if (!data || !data.list) {
            if (!append) {
                videoGrid.innerHTML = '<p>No videos found or failed to load.</p>';
            }
            hasMoreContent = false;
            return; // Stop execution if data is invalid
        }

        if (!append) {
            // Show skeleton cards while loading
            videoGrid.innerHTML = '';
            for (let i = 0; i < 8; i++) {
                const skel = document.createElement('div');
                skel.className = 'video-card skeleton-card';
                videoGrid.appendChild(skel);
            }
        }

        if (data.list.length === 0) {
            if (!append) {
                if (currentSearch) {
                    videoGrid.innerHTML = `<p>No videos found for "${currentSearch}".</p>`;
                } else {
                    videoGrid.innerHTML = '<p>No videos found for this category.</p>';
                }
            }
            hasMoreContent = false;
        } else {
            // Remove skeletons only if not appending
            if (!append) {
                videoGrid.innerHTML = '';
            }
            data.list.forEach(video => {
                const card = document.createElement('div');
                card.className = 'video-card';
                card.dataset.id = video.vod_id;

                const img = document.createElement('img');
                // Use more robust image URL handling
                const validImageUrl = getValidImageUrl(video.vod_pic);
                img.src = validImageUrl || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22150%22%20height%3D%22225%22%20viewBox%3D%220%200%20150%20225%22%3E%3Crect%20fill%3D%22%23ddd%22%20width%3D%22150%22%20height%3D%22225%22%2F%3E%3Ctext%20fill%3D%22%23666%22%20font-family%3D%22sans-serif%22%20font-size%3D%2216%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E';
                img.alt = video.vod_name;
                img.onerror = () => { // Handle image loading errors
                    img.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22150%22%20height%3D%22225%22%20viewBox%3D%220%200%20150%20225%22%3E%3Crect%20fill%3D%22%23ddd%22%20width%3D%22150%22%20height%3D%22225%22%2F%3E%3Ctext%20fill%3D%22%23666%22%20font-family%3D%22sans-serif%22%20font-size%3D%2216%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E'; // Fallback placeholder
                }

                // If list API had no valid image, fetch detail API to get the real thumbnail
                if (!validImageUrl) {
                    fetchData({ ac: 'detail', ids: video.vod_id }, true)
                        .then(detailData => {
                            if (detailData && detailData.list && detailData.list[0]?.vod_pic) {
                                const detailImg = getValidImageUrl(detailData.list[0].vod_pic);
                                if (detailImg) img.src = detailImg;
                            }
                        })
                        .catch(err => console.warn('Failed to fetch detail image:', err));
                }

                const title = document.createElement('h3');
                title.textContent = video.vod_name || 'No Title'; // Handle null titles

                const remarks = document.createElement('p');
                remarks.textContent = video.vod_remarks || ''; // Handle null remarks

                // Card actions overlay
                const actions = document.createElement('div');
                actions.className = 'card-actions';
                // Play button
                const playBtn = document.createElement('button');
                playBtn.innerHTML = '▶️';
                playBtn.className = 'play-btn';
                playBtn.setAttribute('aria-label', '播放');
                playBtn.tabIndex = 0;
                playBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    // Enable wake lock immediately on user tap (for iOS)
                    try {
                        noSleep.enable();
                        console.log('Wake Lock enabled (play button)');
                    } catch (err) {
                        console.warn('Wake Lock enable failed on play button tap:', err);
                    }
                    showVideoDetails(video.vod_id);
                });
                // Share button
                const shareBtn = document.createElement('button');
                shareBtn.innerHTML = '🔗';
                shareBtn.className = 'share-btn';
                shareBtn.setAttribute('aria-label', '分享');
                shareBtn.tabIndex = 0;
                shareBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentVideoId = video.vod_id;
                    showShareModal();
                });
                // Watchlist button
                const wlBtn = document.createElement('button');
                wlBtn.innerHTML = watchList.includes(video.vod_id) ? '★' : '☆';
                wlBtn.className = 'watchlist-btn';
                wlBtn.setAttribute('aria-label', watchList.includes(video.vod_id) ? '从观看列表移除' : '添加到观看列表');
                wlBtn.tabIndex = 0;
                wlBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const idx = watchList.indexOf(video.vod_id);
                    if (idx === -1) {
                        watchList.push(video.vod_id);
                        showToast('已添加到观看列表', 'info');
                        wlBtn.innerHTML = '★';
                        wlBtn.setAttribute('aria-label', '从观看列表移除');
                    } else {
                        watchList.splice(idx, 1);
                        showToast('已从观看列表移除', 'info');
                        wlBtn.innerHTML = '☆';
                        wlBtn.setAttribute('aria-label', '添加到观看列表');
                    }
                    localStorage.setItem('watchList', JSON.stringify(watchList));
                });
                actions.appendChild(playBtn);
                actions.appendChild(shareBtn);
                actions.appendChild(wlBtn);

                card.appendChild(img);
                card.appendChild(actions);
                card.appendChild(title);
                card.appendChild(remarks);
                videoGrid.appendChild(card);
            });

            // Show results count for initial search
            if (currentSearch && !append) {
                showToast(`Found ${data.list.length} video(s) for "${currentSearch}"`, 'info', 3000);
            }
        }

        totalPages = data.pagecount || 1;
        if (currentPage >= totalPages) {
            hasMoreContent = false;
        }
    }

    // Check if user scrolled near bottom
    function checkScroll() {
        if (isWatchListMode) return; // Disable infinite scroll in watch list mode
        if (isLoading || !hasMoreContent) return;

        const scrollPosition = window.innerHeight + window.scrollY;
        const pageHeight = document.body.offsetHeight;
        const scrollThreshold = 0.8; // Load more when user scrolls to 80% of the page

        // Show/hide back to top button
        if (window.scrollY > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }

        // If user has scrolled to threshold and there's more content
        if (scrollPosition / pageHeight > scrollThreshold && hasMoreContent) {
            loadVideos(currentPage + 1, currentCategory, currentSearch, true);
        }
    }

    // Update showVideoDetails to use maxRetries and retryDelay for video detail fetches
    async function showVideoDetails(videoId) {
        showLoaderOverlay();
        // Add loading indicator specific to video details (only once)
        showToast('Loading video details...', 'info', 2000);
        const cacheKey = `video_details_${videoId}`;
        let data;
        try {
            const cachedData = sessionStorage.getItem(cacheKey);
            if (cachedData) {
                try {
                    data = JSON.parse(cachedData);
                    console.log('Using cached video details');
                } catch (e) {
                    console.error('Error parsing cached data', e);
                    // If parsing fails, fetch fresh data with retry and silent toasts
                    data = await fetchData({ ac: 'detail', ids: videoId }, true, 3, 12000);
                }
            } else {
                // Fetch fresh data with retry and silent toasts
                data = await fetchData({ ac: 'detail', ids: videoId }, true, 3, 12000);
                if (data && data.list && data.list.length > 0) {
                    try {
                        sessionStorage.setItem(cacheKey, JSON.stringify(data));
                    } catch (e) {
                        console.error('Error caching video details', e);
                    }
                }
            }
            if (!data || !data.list || data.list.length === 0) {
                showToast('Failed to load video details.', 'error');
                hideLoaderOverlay();
                return false; // Signal failure
            }
            const video = data.list[0]; // Assuming the first item is the one we want

            // Store the current video ID for sharing
            currentVideoId = videoId;
            // Update Watch List button text based on storage
            addToWatchListButton.textContent = watchList.includes(currentVideoId) ? '从观看列表移除' : '添加到观看列表';

            // Update UI elements efficiently (batch DOM updates)
            const updateUI = () => {
                modalTitle.textContent = video.vod_name || 'No Title';
                // Use more robust image URL handling
                const validImageUrl = getValidImageUrl(video.vod_pic);
                modalPoster.src = validImageUrl || 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22200%22%20height%3D%22300%22%20viewBox%3D%220%200%20200%20300%22%3E%3Crect%20fill%3D%22%23ddd%22%20width%3D%22200%22%20height%3D%22300%22%2F%3E%3Ctext%20fill%3D%22%23666%22%20font-family%3D%22sans-serif%22%20font-size%3D%2220%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E';
                modalYear.textContent = video.vod_year || 'N/A';
                modalArea.textContent = video.vod_area || 'N/A';
                modalLang.textContent = video.vod_lang || 'N/A';
                modalDirector.textContent = video.vod_director || 'N/A';
                modalActors.textContent = video.vod_actor || 'N/A';
                modalRemarks.textContent = video.vod_remark || 'N/A';
                // Use innerHTML for description in case it contains basic HTML
                modalDescription.innerHTML = video.vod_content || 'No description available.';
            };
            
            // Use requestAnimationFrame for smoother UI updates
            requestAnimationFrame(updateUI);

            // Handle image loading errors
            modalPoster.onerror = () => {
                modalPoster.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22200%22%20height%3D%22300%22%20viewBox%3D%220%200%20200%20300%22%3E%3Crect%20fill%3D%22%23ddd%22%20width%3D%22200%22%20height%3D%22300%22%2F%3E%3Ctext%20fill%3D%22%23666%22%20font-family%3D%22sans-serif%22%20font-size%3D%2220%22%20x%3D%2250%25%22%20y%3D%2250%25%22%20dominant-baseline%3D%22middle%22%20text-anchor%3D%22middle%22%3ENo%20Image%3C%2Ftext%3E%3C%2Fsvg%3E';
            }

            // Reset the video player
            if (videojsPlayer) {
                videojsPlayer.dispose();
                videojsPlayer = null;
            }

            // Parse and display episodes
            modalEpisodes.innerHTML = ''; // Clear previous episodes
            
            // Use a document fragment to minimize DOM operations
            const fragment = document.createDocumentFragment();
            
            if (video.vod_play_url) {
                // The format seems to be Name1$URL1#Name2$URL2...
                const playSources = video.vod_play_url.split('#');
                // Populate global episodes array for selection modal and controls
                currentEpisodes = playSources.map(src => {
                    const parts = src.split('$');
                    return { name: parts[0] || '', url: parts[1] || '' };
                });
                currentEpisodeIndex = 0;

                // --- FIX: Remove batching/recursion, just process all at once ---
                playSources.forEach(source => {
                    const parts = source.split('$');
                    if (parts.length === 2) {
                        const name = parts[0];
                        const url = parts[1];
                        if (url && url.startsWith('http')) {
                            const isM3u8 = url.includes('.m3u8');
                            const link = document.createElement('a');
                            link.href = 'javascript:void(0)';
                            link.textContent = name || '播放';
                            link.dataset.url = url;
                            link.dataset.name = name || 'Episode';
                            if (isEpisodeWatched(videoId, name)) {
                                link.classList.add('watched');
                            } else {
                                link.classList.remove('watched');
                            }
                            if (isM3u8) {
                                link.addEventListener('click', function (e) {
                                    e.preventDefault();
                                    // Enable wake lock immediately on user tap (for iOS)
                                    try {
                                        noSleep.enable();
                                        console.log('Wake Lock enabled (user gesture)');
                                    } catch (err) {
                                        console.warn('Wake Lock enable failed on tap:', err);
                                    }
                                    playM3u8Video(url, this);
                                });
                            } else {
                                link.target = '_blank';
                                link.href = url;
                            }
                            fragment.appendChild(link);
                        } else {
                            console.warn(`Invalid episode URL found: ${url}`);
                        }
                    }
                });
            } else {
                const noEpisodes = document.createElement('div');
                noEpisodes.textContent = 'No playback sources available.';
                fragment.appendChild(noEpisodes);
            }
            // Append all episodes at once
            modalEpisodes.appendChild(fragment);

            // Update browser history to allow direct linking
            updateBrowserHistory(videoId, video.vod_name);

            modal.classList.add('open'); // Show the modal via CSS class
            
            // Check if we have a previously watched episode for this video and auto-play it
            try {
                const watched = getWatchedEpisodes();
                if (watched[videoId] && watched[videoId].length > 0 && currentEpisodes.length > 0) {
                    // Find the last watched episode
                    const lastWatchedEpisode = watched[videoId][watched[videoId].length - 1];
                    const episodeIndex = currentEpisodes.findIndex(ep => ep.name === lastWatchedEpisode);
                    
                    if (episodeIndex >= 0) {
                        // Found the episode, play it after a short delay
                        setTimeout(() => {
                            playEpisode(episodeIndex);
                        }, 500);
                    }
                }
            } catch (err) {
                console.error('Error auto-playing last watched episode:', err);
            }
            
            // Prevent background scroll
            document.body.style.overflow = 'hidden';
            
            // Prevent scroll propagation from modal-content to background
            const modalContent = modal.querySelector('.modal-content');
            if (modalContent && !modalContent._scrollLockAttached) {
                modalContent.addEventListener('wheel', function (e) {
                    const delta = e.deltaY;
                    const up = delta < 0;
                    const scrollTop = modalContent.scrollTop;
                    const scrollHeight = modalContent.scrollHeight;
                    const offsetHeight = modalContent.offsetHeight;
                    if ((up && scrollTop === 0) || (!up && scrollTop + offsetHeight >= scrollHeight)) {
                        e.preventDefault();
                        e.stopPropagation();
                    }
                }, { passive: false });
                modalContent._scrollLockAttached = true;
            }
            
            hideLoaderOverlay();
            return true; // Signal success
        } catch (error) {
            hideLoaderOverlay();
            console.error('Error in showVideoDetails:', error);
            showToast('Failed to load video details. Please try again.', 'error');
            
            // Ensure scrolling is restored
            document.body.style.overflow = '';
            updateBodyScrollLock();
            
            return false; // Signal failure
        }
    }

    /**
     * Update the browser URL without reloading the page
     * @param {string} videoId - The video ID
     * @param {string} videoTitle - The video title for the page title
     */
    function updateBrowserHistory(videoId, videoTitle) {
        // Only update if browser supports history API
        if (window.history && window.history.pushState) {
            const url = new URL(window.location);
            url.searchParams.set('video', videoId);
            window.history.pushState({ videoId }, videoTitle, url);
            // Update page title
            document.title = videoTitle ? `${videoTitle} - Video Portal` : 'Video Portal';
        }
    }

    /**
     * Show the share modal with link to current video
     */
    function showShareModal() {
        if (!currentVideoId) {
            showToast('No video selected to share', 'error');
            return;
        }

        // Generate a full URL to the current video
        const url = new URL(window.location.href);
        // Clear any existing parameters
        url.search = '';
        // Set the video parameter
        url.searchParams.set('video', currentVideoId);

        // Update the share link input
        shareLinkInput.value = url.href;

        // Show the modal
        shareModal.classList.add('open');

        // Select the text for easy copying
        shareLinkInput.select();
    }

    /**
     * Copy the share link to clipboard
     */
    function copyShareLink() {
        // Select the link text
        shareLinkInput.select();
        shareLinkInput.setSelectionRange(0, 99999); // For mobile devices

        // Copy to clipboard
        try {
            // Use the newer clipboard API if available
            if (navigator.clipboard) {
                navigator.clipboard.writeText(shareLinkInput.value)
                    .then(() => {
                        showToast('Link copied to clipboard!', 'info');
                    })
                    .catch(err => {
                        console.error('Failed to copy link: ', err);
                        // Fallback to the older method
                        document.execCommand('copy');
                        showToast('Link copied to clipboard!', 'info');
                    });
            } else {
                // Fallback for older browsers
                document.execCommand('copy');
                showToast('Link copied to clipboard!', 'info');
            }
        } catch (err) {
            console.error('Failed to copy link: ', err);
            showToast('Failed to copy link. Please select and copy manually.', 'error');
        }
    }

    // Function to play m3u8 videos
    function playM3u8Video(url, linkElement, retryCount = 0) {
        // Enable wake lock immediately on playback start
        try { noSleep.enable(); console.log('Wake Lock enabled (on play)'); } catch(e) {}
        const MAX_RETRIES = 3;
        showLoaderOverlay();
        // Add a global loading timeout to prevent hanging
        let loadingTimeout = setTimeout(() => {
            hideLoaderOverlay();
            showErrorOverlay(() => playM3u8Video(url, linkElement, retryCount + 1));
            showToast('Video loading timed out. Please try again.', 'error');
            if (hlsPlayer) {
                try {
                    hlsPlayer.stopLoad();
                    hlsPlayer.detachMedia();
                    hlsPlayer.destroy();
                } catch (e) {
                    console.error('Error cleaning up HLS player:', e);
                }
                hlsPlayer = null;
            }
        }, 15000); // 15 seconds timeout
        
        // Safety timeout to ensure page remains scrollable
        let safetyTimeout = setTimeout(() => {
            console.warn('Video safety timeout triggered');
            // Don't close modal, but ensure page is scrollable
            document.body.style.overflow = '';
        }, 25000);
        
        // Reset active statuses
        const allLinks = modalEpisodes.querySelectorAll('a');
        allLinks.forEach(link => link.classList.remove('active'));
        if (linkElement) {
            linkElement.classList.add('active');
            playingTitle.textContent = `Now Playing: ${linkElement.dataset.name}`;
            // --- Mark episode as watched ---
            if (currentVideoId && linkElement.dataset.name) {
                markEpisodeWatched(currentVideoId, linkElement.dataset.name);
                // Also update watched styling on all episode links
                const allLinks = modalEpisodes.querySelectorAll('a');
                allLinks.forEach(link => {
                    if (isEpisodeWatched(currentVideoId, link.dataset.name)) {
                        link.classList.add('watched');
                    } else {
                        link.classList.remove('watched');
                    }
                });
            }
        }
        // Show player modal and enable wake lock
        videoPlayerModal.classList.add('open');
        try {
            noSleep.enable();
            console.log('Wake Lock enabled');
        } catch (e) {
            console.warn('Wake Lock enable failed:', e);
        }

        // Clean up any previous HLS instance
        if (hlsPlayer) { 
            try {
                hlsPlayer.stopLoad();
                hlsPlayer.detachMedia();
                hlsPlayer.destroy(); 
            } catch (e) {
                console.error('Error cleaning up existing HLS player:', e);
            }
            hlsPlayer = null; 
        }
        videoPlayer.style.display = 'block';
        // Clean up Plyr source
        if (plyrPlayer) {
            if (typeof plyrPlayer.stop === 'function') plyrPlayer.stop();
            plyrPlayer.source = { type: 'video', sources: [] };
        }

        // Add error handling and retry logic
        const handleError = (error) => {
            console.error('Video loading error:', error);
            clearTimeout(loadingTimeout);
            clearTimeout(safetyTimeout);
            hideLoaderOverlay();
            if (retryCount < MAX_RETRIES - 1) {
                showToast(`Video loading failed. Retrying... (${retryCount + 1}/${MAX_RETRIES})`, 'error', 2000);
                setTimeout(() => {
                    playM3u8Video(url, linkElement, retryCount + 1);
                }, 1500);
            } else {
                showErrorOverlay(() => playM3u8Video(url, linkElement, 0));
            }
        };

        // Simplified HLS playback with error handling
        if (Hls.isSupported()) {
            try {
                hlsPlayer = new Hls({
                    debug: false,
                    maxLoadingRetry: 4,
                    manifestLoadingTimeOut: 10000,
                    manifestLoadingMaxRetry: 4,
                    manifestLoadingRetryDelay: 500,
                    levelLoadingTimeOut: 10000,
                    levelLoadingMaxRetry: 4,
                    levelLoadingRetryDelay: 500,
                    fragLoadingTimeOut: 20000,
                    fragLoadingMaxRetry: 6,
                    // Reduce quality to prevent freezing
                    startLevel: -1, // Auto
                    capLevelToPlayerSize: true,
                    // More aggressive ABR algorithm
                    abrEwmaDefaultEstimate: 500000, // 500kbps initial estimate
                    abrBandWidthFactor: 0.8
                });
                
                hlsPlayer.on(Hls.Events.ERROR, function(event, data) {
                    console.warn('HLS error event:', event, data);
                    
                    if (data.fatal) {
                        console.error('Fatal HLS error:', data.type, data.details);
                        handleError(data);
                    }
                });
                
                hlsPlayer.on(Hls.Events.MANIFEST_PARSED, function() {
                    clearTimeout(loadingTimeout);
                    clearTimeout(safetyTimeout);
                    hideLoaderOverlay();
                });
                
                hlsPlayer.on(Hls.Events.MEDIA_ATTACHED, function() {
                    hideLoaderOverlay();
                });

                hlsPlayer.loadSource(url);
                hlsPlayer.attachMedia(videoPlayer);
                // Re-initialize Plyr after HLS attaches
                if (plyrPlayer) {
                    plyrPlayer.restart();
                    plyrPlayer.play(); // Ensure autoplay
                }
                
                // Check if media attachment succeeds within 5 seconds
                const mediaAttachmentTimeout = setTimeout(() => {
                    if (hlsPlayer && !hlsPlayer.media) {
                        console.error('HLS media attachment timed out');
                        handleError(new Error('Media attachment timeout'));
                    }
                }, 5000);
                
                // Clear the timeout when media is attached
                hlsPlayer.on(Hls.Events.MEDIA_ATTACHED, function() {
                    clearTimeout(mediaAttachmentTimeout);
                });
            } catch (e) {
                hideLoaderOverlay();
                handleError(e);
            }
        } else {
            // Native HLS (Safari)
            try {
                videoPlayer.src = url;
                if (plyrPlayer) {
                    plyrPlayer.source = {
                        type: 'video',
                        sources: [{ src: url, type: 'application/x-mpegURL' }]
                    };
                    plyrPlayer.play(); // Ensure autoplay
                }
                
                // Add error listener for Safari
                videoPlayer.addEventListener('error', function(e) {
                    console.error('Video error event:', videoPlayer.error);
                    handleError(videoPlayer.error);
                }, { once: true });
                
                // Clear timeout on loadedmetadata for Safari
                videoPlayer.addEventListener('loadedmetadata', function() {
                    clearTimeout(loadingTimeout);
                    clearTimeout(safetyTimeout);
                    hideLoaderOverlay();
                }, { once: true });
            } catch (e) {
                hideLoaderOverlay();
                handleError(e);
            }
        }
        
        // Restore playback position if available
        let resumeTime = 0;
        if (currentVideoId && linkElement && linkElement.dataset.name) {
            resumeTime = getPlaybackPosition(currentVideoId, linkElement.dataset.name);
        }
        console.log('[Resume Debug] resumeTime:', resumeTime, 'for', currentVideoId, linkElement && linkElement.dataset.name);
        // Set currentTime only if resumeTime is meaningful (not at start or end)
        const setResumeTime = () => {
            // Clear timeout here too in case the above events didn't fire
            clearTimeout(loadingTimeout);
            
            console.log('[Resume Debug] loadedmetadata fired, video duration:', videoPlayer.duration);
            if (resumeTime > 1 && resumeTime < (videoPlayer.duration || Infinity) - 2) {
                videoPlayer.currentTime = resumeTime;
                console.log('[Resume Debug] Set currentTime to', resumeTime);
            } else {
                console.log('[Resume Debug] Not resuming (resumeTime not in range):', resumeTime);
            }
            // --- Autoplay Fix ---
            const wasMuted = videoPlayer.muted;
            videoPlayer.muted = true;
            let playRetry = false;
            const pauseHandler = () => {
                if (!playRetry && !videoPlayer.ended && !videoPlayer.seeking && videoPlayer.currentTime > 0) {
                    playRetry = true;
                    console.log('[Resume Debug] Detected auto-pause, retrying play()...');
                    videoPlayer.play();
                }
                videoPlayer.removeEventListener('pause', pauseHandler);
            };
            videoPlayer.addEventListener('pause', pauseHandler);
            videoPlayer.play().then(() => {
                console.log('[Resume Debug] play() called after setting currentTime.');
                // Restore mute state after playback starts
                setTimeout(() => { videoPlayer.muted = wasMuted; }, 200);
            }).catch(e => {
                console.error('[Resume Debug] Playback error (autoplay?):', e);
                // Try to restore mute state anyway
                setTimeout(() => { videoPlayer.muted = wasMuted; }, 200);
                
                // Add play button overlay for user interaction when autoplay fails
                showPlayOverlay();
            });
        };
        
        // New function to show play button overlay when autoplay is blocked
        function showPlayOverlay() {
            // Check if overlay already exists
            if (document.getElementById('playOverlay')) return;
            
            // Create play button overlay
            const overlay = document.createElement('div');
            overlay.id = 'playOverlay';
            overlay.style.position = 'absolute';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
            overlay.style.display = 'flex';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.style.zIndex = '100';
            overlay.style.cursor = 'pointer';
            
            // Create play icon
            const playIcon = document.createElement('div');
            playIcon.innerHTML = '▶️';
            playIcon.style.fontSize = '4rem';
            playIcon.style.color = 'white';
            overlay.appendChild(playIcon);
            
            // Add click handler to start playback
            overlay.addEventListener('click', function() {
                // Enable wake lock on overlay tap to resume playback
                try { noSleep.enable(); console.log('Wake Lock enabled (overlay)'); } catch(err) { console.warn('Wake Lock enable failed on overlay tap:', err); }
                videoPlayer.muted = false;
                videoPlayer.play()
                    .then(() => {
                        overlay.remove();
                        console.log('Video playback started by user interaction');
                        // Removed: auto fullscreen logic
                    })
                    .catch(err => {
                        console.error('Still failed to play after user interaction:', err);
                        showToast('Unable to play video. Please try again.', 'error');
                    });
            });
            
            // Add overlay to video container
            const videoContainer = document.querySelector('.video-player-container');
            videoContainer.style.position = 'relative';
            videoContainer.appendChild(overlay);
            
            // Show toast to inform user
            showToast('Click to play video', 'info', 3000);
        }
        
        // If the video element is ready, set currentTime; otherwise, listen for loadedmetadata
        if (videoPlayer.readyState >= 1) {
            setResumeTime();
        } else {
            videoPlayer.addEventListener('loadedmetadata', setResumeTime, { once: true });
        }
        // Save playback position on timeupdate (only if >5s and not near end)
        videoPlayer.ontimeupdate = function () {
            if (currentVideoId && linkElement && linkElement.dataset.name) {
                if (videoPlayer.currentTime > 5 && videoPlayer.currentTime < (videoPlayer.duration || Infinity) - 2) {
                    savePlaybackPosition(currentVideoId, linkElement.dataset.name, videoPlayer.currentTime);
                    if (Math.floor(videoPlayer.currentTime) % 10 === 0) {
                        console.log('[Resume Debug] Saving playback position (ontimeupdate):', videoPlayer.currentTime);
                    }
                }
            }
        };
        // Also save position on pause and disable wake lock
        videoPlayer.onpause = function () {
            if (currentVideoId && linkElement && linkElement.dataset.name) {
                if (videoPlayer.currentTime > 5 && videoPlayer.currentTime < (videoPlayer.duration || Infinity) - 2) {
                    savePlaybackPosition(currentVideoId, linkElement.dataset.name, videoPlayer.currentTime);
                    console.log('[Resume Debug] Saving playback position (pause):', videoPlayer.currentTime);
                }
            }
            noSleep.disable();
            console.log('Wake Lock disabled');
        };
        // Save position when modal closes (if applicable)
        if (videoPlayerModal) {
            const saveOnClose = () => {
                if (currentVideoId && linkElement && linkElement.dataset.name) {
                    if (videoPlayer.currentTime > 5 && videoPlayer.currentTime < (videoPlayer.duration || Infinity) - 2) {
                        savePlaybackPosition(currentVideoId, linkElement.dataset.name, videoPlayer.currentTime);
                        console.log('[Resume Debug] Saving playback position (modal close):', videoPlayer.currentTime);
                    }
                }
            };
            videoPlayerModal.addEventListener('close', saveOnClose);
            videoPlayerModal.addEventListener('hide', saveOnClose);
        }
    }

    // --- Scroll Lock Helper ---
    function updateBodyScrollLock() {
        // Remove the scroll locking behavior - always allow scrolling
        document.body.style.overflow = '';
        
        // Keep the backup check to make sure scrolling is never locked
        if (document.body.style.overflow === 'hidden') {
            document.body.style.overflow = '';
        }
    }

    // --- Event Listeners ---

    // Back to top button click
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });

    // Scroll event for infinite loading and back to top button
    window.addEventListener('scroll', checkScroll);

    // Category selection
    categoryList.addEventListener('click', (event) => {
        if (event.target.tagName === 'LI') {
            // Remove active class from previously selected item
            const currentActive = categoryList.querySelector('.active');
            if (currentActive) {
                currentActive.classList.remove('active');
            }
            // Add active class to clicked item
            event.target.classList.add('active');

            const categoryId = event.target.dataset.id;
            searchInput.value = ''; // Clear search input when changing categories
            if (categoryId === 'watchlist') {
                loadWatchList();
            } else {
                loadVideos(1, categoryId, '');
            }

            // Scroll to top when changing categories
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // Hide sidebar on mobile after selecting a category
            if (window.innerWidth <= 768 && categoryNav.classList.contains('open')) {
                if (categoryNav) {
                    categoryNav.classList.remove('open');
                }

                if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
            }
        }
    });

    // Search
    searchButton.addEventListener('click', () => {
        const searchTerm = searchInput.value.trim();
        if (searchTerm) {
            console.log(`Searching for: "${searchTerm}"`);
            // Reset any active category when searching
            const currentActive = categoryList.querySelector('.active');
            if (currentActive) {
                currentActive.classList.remove('active');
            }

            if (categoryList) {
                // Only mark the 'All' category active if it exists
                const allCategoryItem = categoryList.querySelector('li[data-id=""]');
                if (allCategoryItem) {
                    allCategoryItem.classList.add('active');
                }
            }


            loadVideos(1, '', searchTerm); // Load page 1, clear category, use search term

            // Scroll to top for new search
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            showToast('Please enter a search term', 'info');
        }
    });

    searchInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
            searchButton.click(); // Trigger search on Enter key
        }
    });

    // Video card click
    videoGrid.addEventListener('click', (event) => {
        // Enable wake lock immediately on user tap (for iOS)
        try { noSleep.enable(); console.log('Wake Lock enabled (card click)'); } catch (err) { console.warn('Wake Lock enable failed on card click:', err); }
        const card = event.target.closest('.video-card');
        if (!card) return;
        const videoId = card.dataset.id;
        currentVideoId = videoId;
        (async () => {
            const MAX_RETRIES = 3;
            let attempt = 0;
            let success = false;
            showLoaderOverlay();
            while (attempt < MAX_RETRIES && !success) {
                try {
                    const data = await fetchData({ ac: 'detail', ids: videoId });
                    if (!data || !data.list || data.list.length === 0) {
                        attempt++;
                        if (attempt < MAX_RETRIES) {
                            showToast(`加载失败，正在重试... (${attempt}/${MAX_RETRIES})`, 'error');
                        } else {
                            showToast('Failed to load video details after 3 attempts.', 'error');
                        }
                        continue;
                    }
                    // Parse episodes
                    currentEpisodes = data.list[0].vod_play_url.split('#')
                        .map(src => { const [name, url] = src.split('$'); return { name: name || 'Episode', url }; });
                    if (currentEpisodes.length === 0) {
                        showToast('No episodes available.', 'info');
                        hideLoaderOverlay();
                        return;
                    }
                    // Update watch list button text
                    watchListBtn.textContent = watchList.includes(currentVideoId) ? '从观看列表移除' : '添加到观看列表';
                    // Play default episode: resume at last watched if available
                    const watchedMap = getWatchedEpisodes();
                    const epNames = watchedMap[videoId] || [];
                    const lastEp = epNames[epNames.length - 1];
                    let startIdx = 0;
                    if (lastEp) {
                        const found = currentEpisodes.findIndex(ep => ep.name === lastEp);
                        if (found >= 0) startIdx = found;
                    }
                    playEpisode(startIdx);
                    videoPlayerModal.classList.add('open');
                    updateBodyScrollLock();
                    success = true;
                } catch (err) {
                    attempt++;
                    console.error(err);
                    if (attempt < MAX_RETRIES) {
                        showToast(`加载失败，正在重试... (${attempt}/${MAX_RETRIES})`, 'error');
                    } else {
                        showToast('Error loading video after 3 attempts.', 'error');
                    }
                }
            }
            hideLoaderOverlay();
        })();
    });

    // Modal close
    closeModalButton.addEventListener('click', () => {
        modal.classList.remove('open');
        updateBodyScrollLock();
        // Stop the video if playing
        if (videojsPlayer) {
            videojsPlayer.dispose();
            videojsPlayer = null;
        }
        
        // Clean up any HLS resources if the modal with video player is closed
        if (hlsPlayer) {
            try {
                hlsPlayer.stopLoad();
                hlsPlayer.detachMedia();
                hlsPlayer.destroy();
            } catch (e) {
                console.error('Error cleaning up HLS player:', e);
            }
            hlsPlayer = null;
        }
        
        // Clear video player source
        if (videoPlayer) {
            videoPlayer.pause();
            videoPlayer.removeAttribute('src');
            videoPlayer.load();
        }
        
        // Reset page title and URL when closing the modal
        document.title = 'Video Portal';
        // Only update if browser supports history API
        if (window.history && window.history.pushState) {
            const url = new URL(window.location);
            url.searchParams.delete('video');
            window.history.pushState({}, 'Video Portal', url);
        }
        noSleep.disable();
        console.log('Wake Lock disabled');
        
        // Extra check to make sure scroll is restored
        document.body.style.overflow = '';
        hideLoaderOverlay();
    });

    // Video player modal close
    closeVideoPlayerButton.addEventListener('click', () => {
        videoPlayerModal.classList.remove('open');
        updateBodyScrollLock();
        // Stop the video and clean up resources
        videoPlayer.pause();
        
        // Properly destroy HLS player to avoid memory leaks
        if (hlsPlayer) { 
            try {
                hlsPlayer.stopLoad();
                hlsPlayer.detachMedia();
                hlsPlayer.destroy(); 
            } catch (e) {
                console.error('Error cleaning up existing HLS player:', e);
            }
            hlsPlayer = null; 
        }
        
        // Clear video src to free memory
        videoPlayer.removeAttribute('src');
        videoPlayer.load();
        
        noSleep.disable();
        console.log('Wake Lock disabled');
        hideLoaderOverlay();
    });

    // Share button click
    shareButton.addEventListener('click', showShareModal);

    // Copy link button click
    copyLinkButton.addEventListener('click', copyShareLink);

    // Close share modal
    closeShareButton.addEventListener('click', () => {
        shareModal.classList.remove('open');
        updateBodyScrollLock();
    });

    // Handle popstate (browser back/forward buttons)
    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.videoId) {
            // User navigated back to a video detail page
            showVideoDetails(event.state.videoId);
        } else {
            // User navigated back to the main page
            modal.classList.remove('open');
            updateBodyScrollLock();
        }
    });

    window.addEventListener('click', (event) => {
        if (event.target === modal) { // Close if clicked outside the modal content
            modal.classList.remove('open');
            updateBodyScrollLock();
        }
        if (event.target === videoPlayerModal) { // Close if clicked outside the video player modal content
            videoPlayerModal.classList.remove('open');
            updateBodyScrollLock();
            // Stop the video
            if (videojsPlayer) {
                videojsPlayer.dispose();
                videojsPlayer = null;
            }
            videoPlayer.pause();
            if (hlsPlayer) { hlsPlayer.destroy(); hlsPlayer = null; }
        }
        if (event.target === settingsModal) { // Close settings modal if clicked outside
            settingsModal.classList.remove('open');
            updateBodyScrollLock();
        }
        if (event.target === shareModal) { // Close share modal if clicked outside
            shareModal.classList.remove('open');
            updateBodyScrollLock();
        }
    });

    // --- Settings functionality ---
    settingsButton.addEventListener('click', () => {
        settingsModal.classList.add('open');
    });

    closeSettingsButton.addEventListener('click', () => {
        settingsModal.classList.remove('open');
        updateBodyScrollLock();
    });

    submitPasswordButton.addEventListener('click', validatePassword);
    passwordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            validatePassword();
        }
    });

    function validatePassword() {
        const password = passwordInput.value;

        if (password === correctPassword) {
            // Show success message
            passwordMessage.textContent = 'Password correct!';
            passwordMessage.className = 'success';

            // Show category nav
            categoryNav.classList.add('visible');

            // Store authentication in localStorage
            localStorage.setItem('authenticated', 'true');

            // Reload categories to show all of them
            loadCategories();

            // Close modal after short delay
            setTimeout(() => {
                settingsModal.classList.remove('open');
                updateBodyScrollLock();
                passwordInput.value = ''; // Clear password field
                passwordMessage.textContent = '';
            }, 1500);
        } else {
            // Show error message
            passwordMessage.textContent = 'Incorrect password. Try again.';
            passwordMessage.className = '';
            passwordInput.value = ''; // Clear password field
        }
    }

    // --- Watch History Functions ---

    async function renderWatchHistory() {
        const MAX_HISTORY = 50; // Limit display to most recent 50 entries
        const history = getWatchHistory();
        const fullHistory = [...history]; // Keep a copy of the full history
        // Sort by most recent first
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        // Limit to most recent entries for display
        history.splice(MAX_HISTORY);
        // Clear the list
        watchHistoryList.innerHTML = '';
        
        // Fetch video details for all entries in one request if possible
        const videoIds = [...new Set(history.map(item => item.videoId))].join(',');
        const videoData = {};
        
        if (videoIds) {
            const data = await fetchData({ ac: 'detail', ids: videoIds }, true);
            if (data && data.list) {
                data.list.forEach(video => {
                    videoData[video.vod_id] = video;
                });
            }
        }
        
        history.forEach(item => {
            const video = videoData[item.videoId];
            console.log('[DEBUG] rendering history item:', item, 'video:', video);
            const div = document.createElement('div');
            div.className = 'watch-history-item watch-history-item-enhanced';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '12px';
            div.style.padding = '8px 0';
            div.style.cursor = 'pointer';
            div.style.borderBottom = '1px solid #23232b';
            // Thumbnail
            const thumb = document.createElement('img');
            thumb.className = 'watch-history-thumb';
            thumb.style.width = '50px';
            thumb.style.height = '70px';
            thumb.style.objectFit = 'cover';
            thumb.style.borderRadius = '6px';
            thumb.style.background = '#23232b';
            thumb.style.flexShrink = '0';
            thumb.src = video ? getValidImageUrl(video.vod_pic) || '' : '';
            thumb.alt = video ? (video.vod_name || 'No Image') : 'No Image';
            div.appendChild(thumb);
            // Info block
            const info = document.createElement('div');
            info.className = 'watch-history-info';
            info.style.display = 'flex';
            info.style.flexDirection = 'column';
            info.style.justifyContent = 'center';
            info.style.minWidth = '0';
            const title = document.createElement('strong');
            title.textContent = video ? video.vod_name : item.videoId;
            title.style.fontSize = '1.03em';
            title.style.overflow = 'hidden';
            title.style.textOverflow = 'ellipsis';
            title.style.whiteSpace = 'nowrap';
            info.appendChild(title);
            const episode = document.createElement('em');
            episode.textContent = ` ${item.episodeName}`;
            episode.style.margin = '3px 0 0 0';
            episode.style.fontStyle = 'normal';
            episode.style.color = '#bbb';
            episode.style.fontSize = '0.97em';
            info.appendChild(episode);
            const date = new Date(item.timestamp);
            const dateString = `${date.toLocaleDateString()}, ${date.toLocaleTimeString()}`;
            const dateSpan = document.createElement('span');
            dateSpan.style.color = 'gray';
            dateSpan.style.fontSize = '0.9em';
            dateSpan.style.marginTop = '2px';
            dateSpan.textContent = dateString;
            info.appendChild(dateSpan);
            div.appendChild(info);
            div.onclick = () => {
                watchHistoryModal.classList.remove('open');
                if (typeof updateBodyScrollLock === 'function') updateBodyScrollLock();
                
                // Instead of just calling showVideoDetails, use a more robust approach to ensure video playback
                (async () => {
                    try {
                        // First show the video details
                        await showVideoDetails(item.videoId);
                        
                        // Then find episode matching the one in watch history
                        if (currentEpisodes && currentEpisodes.length > 0) {
                            // Find the matching episode
                            const epIndex = currentEpisodes.findIndex(ep => ep.name === item.episodeName);
                            
                            if (epIndex >= 0) {
                                // Found the episode, now play it
                                playEpisode(epIndex);
                            } else {
                                // Fallback: play the first episode
                                showToast(`Couldn't find episode "${item.episodeName}", playing first available episode`, 'info');
                                playEpisode(0);
                            }
                        }
                    } catch (error) {
                        console.error('Error playing video from watch history:', error);
                        showToast('Failed to play video. Please try again.', 'error');
                    }
                })();
            };
            watchHistoryList.appendChild(div);
        });
    }
    function checkForSharedVideo() {
        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('video');
        const episodeParam = urlParams.get('episode'); // Add support for episode parameter

        if (videoId) {
            // First restore normal scroll state to ensure page is usable even if video loading fails
            document.body.style.overflow = '';
            
            // Add the emergency scroll recovery button
            addScrollRecoveryButton();
            
            // Set a global safety timeout
            const safetyTimeout = setTimeout(() => {
                console.warn('Safety timeout triggered - restoring scrolling');
                ensureScrollable();
            }, 20000); // 20 second safety timeout
            
            // Delay loading the shared video to allow the page to render first
            showToast('Loading video...', 'info');
            setTimeout(() => {
                showVideoDetails(videoId)
                    .then(success => {
                        // Clear safety timeout if successful
                        clearTimeout(safetyTimeout);
                        
                        // If showVideoDetails resolved successfully, it will set scroll lock
                        if (!success) {
                            // If it returned false specifically, we need to restore scrolling
                            document.body.style.overflow = '';
                            updateBodyScrollLock();
                            return;
                        }
                        
                        // If we have an episode parameter and the video loaded successfully, play that episode
                        if (episodeParam && currentEpisodes && currentEpisodes.length > 0) {
                            // Try to find the episode by name first
                            const epIndex = currentEpisodes.findIndex(ep => 
                                ep.name === episodeParam || 
                                ep.name === `第${episodeParam}集` || 
                                ep.name === `第${episodeParam}话`
                            );
                            
                            if (epIndex >= 0) {
                                // Found the specific episode
                                setTimeout(() => {
                                    playEpisode(epIndex);
                                }, 500);
                            } else {
                                // Try to treat episode param as an index
                                const numericIndex = parseInt(episodeParam, 10);
                                if (!isNaN(numericIndex) && numericIndex > 0 && numericIndex <= currentEpisodes.length) {
                                    setTimeout(() => {
                                        playEpisode(numericIndex - 1); // Adjust for 0-based indexing
                                    }, 500);
                                } else {
                                    // Default to first episode if we can't find a match
                                    setTimeout(() => {
                                        playEpisode(0);
                                    }, 500);
                                }
                            }
                        } else {
                            // Default behavior: auto-play first episode when no episode specified
                            if (currentEpisodes && currentEpisodes.length > 0) {
                                setTimeout(() => {
                                    playEpisode(0);
                                }, 500);
                            }
                        }
                    })
                    .catch(err => {
                        // Clear safety timeout
                        clearTimeout(safetyTimeout);
                        
                        console.error('Error loading shared video:', err);
                        showToast('Failed to load video. Please try again.', 'error');
                        // Ensure scrolling is restored if there's an error
                        document.body.style.overflow = '';
                        updateBodyScrollLock();
                    });
            }, 1000);
        }
    }

    // --- Watch List Functions ---
    async function loadWatchList() {
        isWatchListMode = true; // Set watch list mode
        // Render saved videos from watchList
        videoGrid.innerHTML = '';
        if (watchList.length === 0) {
            videoGrid.innerHTML = '<p>No videos in your watch list.</p>';
            return;
        }
        showToast('Loading your watch list...', 'info');
        const ids = watchList.join(',');
        const data = await fetchData({ ac: 'detail', ids: ids });
        if (!data || !data.list) {
            videoGrid.innerHTML = '<p>Failed to load watch list.</p>';
            return;
        }
        data.list.forEach(video => {
            const card = document.createElement('div');
            card.className = 'video-card';
            card.dataset.id = video.vod_id;
            const img = document.createElement('img');
            const validImageUrl = getValidImageUrl(video.vod_pic);
            img.src = validImageUrl || '';
            img.alt = video.vod_name || 'No Image';
            const title = document.createElement('h3');
            title.textContent = video.vod_name || 'No Title';
            const remarks = document.createElement('p');
            remarks.textContent = video.vod_remarks || '';
            card.appendChild(img);
            card.appendChild(title);
            card.appendChild(remarks);
            videoGrid.appendChild(card);
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function toggleWatchList() {
        if (!currentVideoId) return;
        const idx = watchList.indexOf(currentVideoId);
        if (idx === -1) {
            watchList.push(currentVideoId);
            showToast('已添加到观看列表', 'info');
        } else {
            watchList.splice(idx, 1);
            showToast('已从观看列表移除', 'info');
        }
        localStorage.setItem('watchList', JSON.stringify(watchList));
        addToWatchListButton.textContent = watchList.includes(currentVideoId) ? '从观看列表移除' : '添加到观看列表';
    }
    // Event listeners for Watch List buttons
    addToWatchListButton.addEventListener('click', toggleWatchList);
    mobileWatchListButton.addEventListener('click', () => {
        const currentActive = categoryList.querySelector('.active');
        if (currentActive) currentActive.classList.remove('active');
        loadWatchList();
    });
    // Header Watch List button for quick access
    const headerWatchListBtn = document.getElementById('headerWatchListBtn');
    if (headerWatchListBtn) {
        headerWatchListBtn.addEventListener('click', () => {
            const currentActive = categoryList.querySelector('.active');
            if (currentActive) currentActive.classList.remove('active');
            loadWatchList();
            // Scroll to top for new view
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // --- Restore initialize function ---
    async function initialize() {
        try {
            await loadCategories(); // Load categories first
            
            // Clear any existing active categories
            const activeItems = categoryList.querySelectorAll('li.active');
            activeItems.forEach(li => li.classList.remove('active'));
            
            // Default load: show watch list
            const watchLi = categoryList.querySelector('li[data-id="watchlist"]');
            if (watchLi) {
                watchLi.classList.add('active');
            }
            
            // First show something on screen, then check for shared video
            loadWatchList();
            
            // Check if user is already authenticated
            checkStoredPassword();
            
            // Check if we should load a specific video (from shared link) - now last step
            checkForSharedVideo();
        } catch (error) {
            console.error('Error during initialization:', error);
            showToast('Error initializing app. Please reload the page.', 'error');
        }
    }
    initialize();

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // Adjust path for GitHub Pages subdirectory
            navigator.serviceWorker.register('/Video-Test-v2/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }

    // Episode navigation support for elderly
    let currentEpisodes = [];
    let currentEpisodeIndex = 0;
    const episodeControls = document.createElement('div');
    episodeControls.id = 'episodeControls';
    episodeControls.style.cssText = 'font-size:1.2rem; margin:0.5rem; text-align:center; color:#000';
    const prevBtn = document.createElement('button');
    prevBtn.id = 'prevEpisode'; prevBtn.textContent = '上一集'; prevBtn.disabled = true;
    prevBtn.style.cssText = 'font-size:1.2rem; padding:0.5rem 1rem;';
    const nextBtn = document.createElement('button');
    nextBtn.id = 'nextEpisode'; nextBtn.textContent = '下一集'; nextBtn.disabled = true;
    nextBtn.style.cssText = 'font-size:1.2rem; padding:0.5rem 1rem;';
    const ctrlContainer = document.createElement('div');
    ctrlContainer.style.cssText = 'display:flex; justify-content:center; gap:1rem;';
    ctrlContainer.appendChild(prevBtn);
    ctrlContainer.appendChild(nextBtn);
    // Add navigation handlers for episode controls
    prevBtn.addEventListener('click', () => {
        // Enable wake lock on prev button click (user gesture)
        try { noSleep.enable(); console.log('Wake Lock enabled (prev button)'); } catch(err) { console.warn('Wake Lock enable failed on prev button tap:', err); }
        if (currentEpisodeIndex > 0) {
            playEpisode(currentEpisodeIndex - 1);
        }
    });
    nextBtn.addEventListener('click', () => {
        // Enable wake lock on next button click (user gesture)
        try { noSleep.enable(); console.log('Wake Lock enabled (next button)'); } catch(err) { console.warn('Wake Lock enable failed on next button tap:', err); }
        if (currentEpisodeIndex < currentEpisodes.length - 1) {
            playEpisode(currentEpisodeIndex + 1);
        }
    });
    // Insert controls into video player modal
    const videoContent = videoPlayerModal.querySelector('.video-modal-content');
    videoContent.appendChild(episodeControls);
    videoContent.appendChild(ctrlContainer);
    // Insert Select Episode button right below prev/next controls
    const selectBtn = document.createElement('button');
    selectBtn.id = 'selectEpisodeBtn';
    selectBtn.textContent = '选择剧集';
    selectBtn.style.cssText = 'font-size:1.2rem; padding:0.5rem 1rem; margin:0.5rem auto; display:block;';
    videoContent.appendChild(selectBtn);
    selectBtn.addEventListener('click', () => {
        // Enable wake lock on select episode tap (user gesture)
        try { noSleep.enable(); console.log('Wake Lock enabled (select episode)'); } catch(err) { console.warn('Wake Lock enable failed on select episode tap:', err); }
        // Ensure episodes have been loaded
        if (!currentEpisodes || currentEpisodes.length === 0) {
            showToast('当前没有可选剧集', 'info');
            return;
        }
        // Populate selectEpisode list
        selectList.innerHTML = '';
        currentEpisodes.forEach((ep, idx) => {
            const btn = document.createElement('button');
            btn.textContent = ep.name || `Episode ${idx + 1}`;
            btn.style.cssText = 'font-size:1rem; padding:0.5rem;';
            btn.addEventListener('click', () => {
                selectModal.classList.remove('open');
                playEpisode(idx);
            });
            selectList.appendChild(btn);
        });
        selectModal.classList.add('open');
    });

    // Create Watch List Toggle button once (only here)
    const watchListBtn = document.createElement('button');
    watchListBtn.id = 'modalWatchListBtn';
    watchListBtn.textContent = '添加到观看列表';
    watchListBtn.style.cssText = 'font-size:1.2rem; padding:0.5rem 1rem; margin:0.5rem auto; display:block;';
    videoContent.appendChild(watchListBtn);
    watchListBtn.addEventListener('click', () => {
        if (!currentVideoId) return;
        const idx = watchList.indexOf(currentVideoId);
        if (idx === -1) {
            watchList.push(currentVideoId);
            watchListBtn.textContent = '从观看列表移除';
            showToast('已添加到观看列表', 'info');
        } else {
            watchList.splice(idx, 1);
            watchListBtn.textContent = '添加到观看列表';
            showToast('已从观看列表移除', 'info');
        }
        localStorage.setItem('watchList', JSON.stringify(watchList));
    });

    // Create Resume button once
    const resumeBtn = document.createElement('button');
    resumeBtn.id = 'resumeEpisodeBtn';
    resumeBtn.style.cssText = 'font-size:1.2rem; padding:0.5rem 1rem; margin:0.5rem auto; display:none;';
    videoContent.appendChild(resumeBtn);
    resumeBtn.addEventListener('click', () => {
        // Enable wake lock immediately on user tap (for iOS)
        try { noSleep.enable(); console.log('Wake Lock enabled (resume button)'); } catch(err) { console.warn('Wake Lock enable failed on resume button tap:', err); }
        if (!currentVideoId || !videoPlayer) return;
        const epName = currentEpisodes[currentEpisodeIndex].name;
        const resumeTime = getPlaybackPosition(currentVideoId, epName);
        if (resumeTime > 1) {
            // Seek and play
            videoPlayer.currentTime = resumeTime;
            videoPlayer.play();
            showToast(`从${Math.floor(resumeTime / 60)}:${String(Math.floor(resumeTime % 60)).padStart(2, '0')}继续播放`, 'info');
        }
    });

    // Create Select Episode Modal for elderly-friendly episode selection
    const selectModal = document.createElement('div');
    selectModal.id = 'selectEpisodeModal';
    selectModal.className = 'modal';
    selectModal.innerHTML = `
      <div class="modal-content select-episode-modal">
        <span class="close-button">&times;</span>
        <h3>选择剧集</h3>
        <div id="selectEpisodeList" class="select-episode-list"></div>
      </div>
    `;
    document.body.appendChild(selectModal);
    const selectList = selectModal.querySelector('#selectEpisodeList');
    selectModal.querySelector('.close-button').addEventListener('click', () => {
      selectModal.classList.remove('open');
    });

    /**
     * Play an episode by index and update controls
     */
    function playEpisode(index) {
        if (index < 0 || index >= currentEpisodes.length) return;
        currentEpisodeIndex = index;
        const ep = currentEpisodes[index];
        playingTitle.textContent = `Episode ${index + 1}: ${ep.name}`;
        episodeControls.textContent = `Episode ${index + 1} of ${currentEpisodes.length}`;
        prevBtn.disabled = (index === 0);
        nextBtn.disabled = (index === currentEpisodes.length - 1);

        // Check resume time for this episode
        const resumeTime = getPlaybackPosition(currentVideoId, ep.name);
        if (resumeTime > 1) {
            resumeBtn.style.display = 'block';
            const m = Math.floor(resumeTime / 60);
            const s = String(Math.floor(resumeTime % 60)).padStart(2, '0');
            resumeBtn.textContent = `从${m}:${s}继续播放`;
        } else {
            resumeBtn.style.display = 'none';
        }

        // Play video with resume logic
        const dummyLink = document.createElement('a');
        dummyLink.dataset.name = ep.name;
        playM3u8Video(ep.url, dummyLink);
    }

    // Wake Lock support: Screen Wake Lock API if available, else fallback to NoSleep.js
    // (NoSleep already initialized earlier)

    // Static nav items for Settings and Watch History
    const settingsNav = document.getElementById('settingsNav');
    if (settingsNav) {
      settingsNav.addEventListener('click', e => {
        e.stopPropagation();
        settingsModal.classList.add('open');
        updateBodyScrollLock();
      });
    }
    const historyNav = document.getElementById('historyNav');
    if (historyNav) {
      historyNav.addEventListener('click', e => {
        e.stopPropagation();
        renderWatchHistory();
        watchHistoryModal.classList.add('open');
        updateBodyScrollLock();
      });
    }

    // Add a global scroll recovery mechanism
    function ensureScrollable() {
        // Force enable scrolling regardless of modal state
        document.body.style.overflow = '';
        
        // If any modals are open, close them
        const openModals = document.querySelectorAll('.modal.open');
        openModals.forEach(modal => {
            modal.classList.remove('open');
        });
        
        // Clean up any video resources
        if (hlsPlayer) {
            try {
                hlsPlayer.stopLoad();
                hlsPlayer.detachMedia();
                hlsPlayer.destroy();
            } catch (e) {
                console.error('Error cleaning up HLS player:', e);
            }
            hlsPlayer = null;
        }
        
        if (videoPlayer) {
            videoPlayer.pause();
            videoPlayer.removeAttribute('src');
            videoPlayer.load();
        }
        
        noSleep.disable();
        console.log('Wake Lock disabled');
        
        showToast('Page reset - scrolling restored', 'info', 2000);
    }

    // Add scroll recovery button
    function addScrollRecoveryButton() {
        // Check if button already exists
        if (document.getElementById('scrollRecoveryBtn')) {
            return;
        }
        
        const recoveryBtn = document.createElement('button');
        recoveryBtn.id = 'scrollRecoveryBtn';
        recoveryBtn.innerHTML = '🔓 Fix Scroll';
        recoveryBtn.style.cssText = 'position: fixed; top: 10px; right: 10px; z-index: 9999; padding: 5px 10px; ' + 
                                   'background: #ff4444; color: white; border: none; border-radius: 4px; ' +
                                   'box-shadow: 0 2px 5px rgba(0,0,0,0.3); cursor: pointer;';
        recoveryBtn.addEventListener('click', ensureScrollable);
        document.body.appendChild(recoveryBtn);
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            if (recoveryBtn.parentNode) {
                recoveryBtn.parentNode.removeChild(recoveryBtn);
            }
        }, 10000);
    }

    // Add this to window object for console access in emergencies
    window.fixScroll = ensureScrollable;

    // Plyr player instance
    let plyrPlayer = null;
    // Initialize Plyr after DOMContentLoaded
    const videoPlayerElem = document.getElementById('videoPlayer');
    // Detect iOS devices (including iPadOS) and enable native inline fullscreen
    if ((/iPad|iPhone|iPod/.test(navigator.userAgent)) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
        videoPlayerElem.setAttribute('playsinline', '');
        videoPlayerElem.setAttribute('webkit-playsinline', '');
    }
    if (window.Plyr && videoPlayerElem) {
        plyrPlayer = new Plyr(videoPlayerElem, {
            controls: [
                'play-large', 'play', 'progress', 'current-time', 'fullscreen'
            ],
            settings: ['quality', 'speed'],
            hideControls: false, // Always show controls
            tooltips: { controls: true, seek: true },
            i18n: { play: '播放', pause: '暂停', volume: '音量', fullscreen: '全屏' },
            disableContextMenu: false,
            invertTime: false, // Show current/total time instead of remaining time
            fullscreen: {
                enabled: true,
                fallback: true,
                iosNative: true
            }
        });
        // Make controls always visible
        if (plyrPlayer.elements && plyrPlayer.elements.controls) {
            plyrPlayer.elements.controls.classList.add('plyr-controls--always-visible');
        }
        // Preference: Always show controls checkbox in settings
        const alwaysShowCheckbox = document.getElementById('alwaysShowControlsCheckbox');
        const storedPref = localStorage.getItem('alwaysShowControls');
        const alwaysShowPref = storedPref === null ? true : JSON.parse(storedPref);
        if (alwaysShowCheckbox) {
            alwaysShowCheckbox.checked = alwaysShowPref;
            alwaysShowCheckbox.addEventListener('change', () => {
                localStorage.setItem('alwaysShowControls', JSON.stringify(alwaysShowCheckbox.checked));
            });
        }
        // Toggle hiding controls on fullscreen based on preference
        // Use a timeout handle for click-to-show-hide
        let hideControlsTimeout = null;
        if (plyrPlayer && plyrPlayer.on) {
            // Enter fullscreen: hide controls if pref is off
            plyrPlayer.on('enterfullscreen', () => {
                const show = alwaysShowCheckbox ? alwaysShowCheckbox.checked : true;
                if (!show && plyrPlayer.elements.container) {
                    plyrPlayer.elements.container.classList.add('hide-controls');
                    // Inform user they can tap to show controls
                    showToast('点击屏幕以显示控制按钮', 'info', 3000);
                }
            });
            // Exit fullscreen: always show controls and clear any pending timeouts
            plyrPlayer.on('exitfullscreen', () => {
                if (plyrPlayer.elements.container) {
                    plyrPlayer.elements.container.classList.remove('hide-controls');
                }
                clearTimeout(hideControlsTimeout);
            });
        }
        // Click on container in fullscreen can show controls temporarily
        if (plyrPlayer && plyrPlayer.elements && plyrPlayer.elements.container) {
            const container = plyrPlayer.elements.container;
            container.addEventListener('click', () => {
                const show = alwaysShowCheckbox ? alwaysShowCheckbox.checked : true;
                if (!show && container.classList.contains('hide-controls')) {
                    container.classList.remove('hide-controls');
                    clearTimeout(hideControlsTimeout);
                    hideControlsTimeout = setTimeout(() => {
                        container.classList.add('hide-controls');
                    }, 3000);
                }
            });
        }
    }

    // Loader and Error Overlay logic for elderly users
    const loaderOverlay = document.getElementById('loaderOverlay');
    const errorOverlay = document.getElementById('errorOverlay');
    const retryButton = document.getElementById('retryButton');

    function showLoaderOverlay() {
      if (loaderOverlay) loaderOverlay.style.display = 'flex';
      // Prevent background scroll
      document.body.style.overflow = 'hidden';
    }
    function hideLoaderOverlay() {
      if (loaderOverlay) loaderOverlay.style.display = 'none';
      // Restore scroll only if no modal is open
      if (!document.querySelector('.modal.open')) document.body.style.overflow = '';
    }
    function showErrorOverlay(retryFn) {
      if (errorOverlay) errorOverlay.style.display = 'flex';
      if (retryButton && typeof retryFn === 'function') {
        retryButton.onclick = () => {
          hideErrorOverlay();
          retryFn();
        };
        retryButton.focus();
      }
      // Prevent background scroll
      document.body.style.overflow = 'hidden';
    }
    function hideErrorOverlay() {
      if (errorOverlay) errorOverlay.style.display = 'none';
      // Restore scroll only if no modal is open
      if (!document.querySelector('.modal.open')) document.body.style.overflow = '';
    }

    // One-time listener: enable wake-lock on first user touch
    document.addEventListener('touchend', () => {
        noSleep.enable();
        console.log('Wake Lock enabled (first touch)');
    }, { once: true, passive: true });

}); 