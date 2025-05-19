// Load configuration
const config = {
    discord: {
        clientId: '1363747847039881347',
        guildId: '1363747433074655433',
        requiredRoles: ['1363749144266674267'],
        creatorRole: '1363771721177628692', // HR-only role
        redirectUri: 'https://avalonpd.netlify.app',
        debug: true // Enable debug mode
    }
};

// Make config globally available for debugging
window.config = config;

// Enable console logging only in debug mode
const debugLog = (...args) => {
    if (config.discord.debug) {
        console.log('[DEBUG]', ...args);
    }
};

// Create toast notification element
const toast = document.createElement('div');
toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 15px 25px;
    background: #333;
    color: white;
    border-radius: 5px;
    display: none;
    z-index: 1000;
    animation: slideIn 0.5s ease-out;
`;
document.body.appendChild(toast);

// Toast animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
    }

    .profile-container {
        position: relative;
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 5px 15px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.3s ease;
        margin-left: auto;
    }

    .profile-container:hover {
        background: rgba(255, 255, 255, 0.2);
    }

    .profile-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        border: 2px solid var(--accent);
    }

    .profile-username {
        color: var(--text);
        font-weight: 500;
    }

    .dropdown-content {
        display: none;
        position: absolute;
        right: 0;
        top: 100%;
        background: var(--primary);
        border-radius: 8px;
        padding: 8px;
        margin-top: 8px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    }

    .profile-container.active .dropdown-content {
        display: block;
    }

    .dropdown-content button {
        background: none;
        border: none;
        color: var(--text);
        padding: 8px 16px;
        width: 100%;
        text-align: left;
        cursor: pointer;
        border-radius: 4px;
        transition: background 0.2s;
    }

    .dropdown-content button:hover {
        background: rgba(255, 255, 255, 0.1);
    }
`;
document.head.appendChild(style);

function showToast(message, isError = false) {
    toast.style.background = isError ? '#dc3545' : '#28a745';
    toast.textContent = message;
    toast.style.display = 'block';
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Create notification sound element
    const notificationSound = document.createElement('audio');
    notificationSound.id = 'notification-sound';
    notificationSound.src = 'notification.mp3';
    notificationSound.style.display = 'none';
    document.body.appendChild(notificationSound);
    
    // Restore login/profile state
    const token = localStorage.getItem('discord_token');
    const hasAccess = localStorage.getItem('has_access') === 'true';
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    if (userData.username) {
        updateLoginButton(userData);
    }
    if (hasAccess) {
        unlockRestrictedContent();
    }

    // Handle OAuth token in URL hash
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const [accessToken, tokenType] = [fragment.get('access_token'), fragment.get('token_type')];
    
    if (accessToken) {
        handleAuthToken(accessToken, tokenType);
    }

    // Restore privileges for create-update link
    updatePrivileges();

    // Theme selection handlers and persistence
    initializeTheme();
    
    // Add real-time update polling
    startUpdatePolling();
    
    // Load recent updates on homepage
    loadRecentUpdates();

    // Connect to server-sent events for real-time notifications
    connectToNotificationStream();

    if (typeof updateRestrictedNav === 'function') {
        updateRestrictedNav();
    }
});

// Handle Discord Authentication
function handleDiscordAuth() {
    const scopes = encodeURIComponent('identify guilds guilds.members.read');
    const authUrl = `https://discord.com/oauth2/authorize` + 
        `?client_id=${config.discord.clientId}` +
        `&redirect_uri=${encodeURIComponent(config.discord.redirectUri)}` +
        `&response_type=token` +
        `&scope=${scopes}` +
        `&guild_id=${config.discord.guildId}` +
        `&prompt=consent`;
    debugLog('Auth URL:', authUrl);
    window.location.href = authUrl;
}

// Handle the authorization token from Discord
async function handleAuthToken(accessToken, tokenType) {
    try {
        showToast('Authenticating...');
        
        // Store the token
        localStorage.setItem('discord_token', accessToken);
        
        // Fetch user data
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                'Authorization': `${tokenType} ${accessToken}`
            }
        });
        
        if (!userResponse.ok) throw new Error('Failed to fetch user data');
        const userData = await userResponse.json();
        localStorage.setItem('user_data', JSON.stringify(userData));
        
        // Fetch guild member data
        const guildId = config.discord.guildId;
        const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
            headers: {
                'Authorization': `${tokenType} ${accessToken}`
            }
        });
        
        if (!memberResponse.ok) throw new Error('Failed to fetch member data');
        const memberData = await memberResponse.json();
        
        // Check roles
        const roles = memberData.roles || [];
        localStorage.setItem('roles', JSON.stringify(roles));
        
        const hasAccess = roles.some(role => 
            config.discord.requiredRoles.includes(role)
        );
        localStorage.setItem('has_access', hasAccess ? 'true' : 'false');
        
        // Update UI
        updateLoginButton(userData);
        if (hasAccess) {
            unlockRestrictedContent();
            showToast('Access granted!');
        }
        updatePrivileges();
        
        // Clean up URL
        window.history.replaceState({}, document.title, '/');
        showToast('Successfully logged in!');
        
        // Request notification permission after successful login
        requestNotificationPermission();
        
    } catch (error) {
        console.error('Authentication error:', error);
        showToast('Authentication failed: ' + error.message, true);
        localStorage.removeItem('discord_token');
        localStorage.removeItem('user_data');
        localStorage.removeItem('roles');
        localStorage.removeItem('has_access');
    }
}

// Update login button with user profile
function updateLoginButton(userData) {
    const navElement = document.querySelector('nav');
    const loginBtn = document.querySelector('.login-btn');
    
    if (loginBtn && navElement) {
        // Create profile container
        const profileContainer = document.createElement('div');
        profileContainer.className = 'profile-container';
        
        // Create dropdown menu
        const dropdownContent = document.createElement('div');
        dropdownContent.className = 'dropdown-content';
        const logoutBtn = document.createElement('button');
        logoutBtn.textContent = 'Logout';
        logoutBtn.onclick = logout;
        dropdownContent.appendChild(logoutBtn);

        // Add avatar
        const avatar = document.createElement('img');
        avatar.className = 'profile-avatar';
        avatar.src = userData.avatar 
            ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png`
            : 'https://cdn.discordapp.com/embed/avatars/0.png';
        avatar.alt = userData.username;

        // Add username
        const username = document.createElement('span');
        username.className = 'profile-username';
        username.textContent = userData.username;

        // Assemble profile container
        profileContainer.appendChild(avatar);
        profileContainer.appendChild(username);
        profileContainer.appendChild(dropdownContent);

        // Replace login button with profile container
        loginBtn.parentNode.replaceChild(profileContainer, loginBtn);

        // Add hover effect handler
        profileContainer.addEventListener('click', function() {
            this.classList.toggle('active');
        });
    }
}

// Function to unlock restricted content
function unlockRestrictedContent() {
    document.querySelectorAll('.restricted-nav').forEach(item => {
        item.style.display = 'block';
    });
}

// Logout function
function logout() {
    localStorage.removeItem('discord_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('has_access');
    localStorage.removeItem('roles');
    window.location.reload();
}

// Function to check if user has access to a specific page
function checkPageAccess() {
    const token = localStorage.getItem('discord_token');
    const hasAccess = localStorage.getItem('has_access') === 'true';
    
    if (!token || !hasAccess) {
        window.location.href = '/';
        return false;
    }
    
    return true;
}

// Show loading overlay until page fully loads
document.addEventListener('readystatechange', () => {
    if (document.readyState === 'complete') {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 500);
    }
});

// Add fade-in animation to sections on scroll
const faders = document.querySelectorAll('.team-section, .updates-section, .hero');
const appearOptions = { threshold: 0.2 };

const appearOnScroll = new IntersectionObserver((entries, appearOnScroll) => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('appear');
        appearOnScroll.unobserve(entry.target);
    });
}, appearOptions);

faders.forEach(fader => {
    appearOnScroll.observe(fader);
});

// CSS for appear class
const fadeStyle = document.createElement('style');
fadeStyle.textContent = `
.hero, .team-section, .updates-section { opacity: 0; transform: translateY(20px); transition: opacity 0.8s ease-out, transform 0.8s ease-out; }
.appear { opacity: 1 !important; transform: translateY(0) !important; }
`;
document.head.appendChild(fadeStyle);

// After loading config and userData
// Restore privileges for create-update link
function updatePrivileges() {
    const roles = JSON.parse(localStorage.getItem('roles') || '[]');
    // Show SOP/TRAINING (handled by unlockRestrictedContent)
    // Show CREATE UPDATE if has creatorRole
    if (config.discord.creatorRole && roles.includes(config.discord.creatorRole)) {
        document.querySelectorAll('.restricted-create').forEach(el => el.style.display = 'block');
    }
}

// Dynamic loading of updates
async function loadUpdates() {
    const grid = document.querySelector('.updates-grid');
    if (!grid) return;
    grid.innerHTML = '';
    try {
        const token = localStorage.getItem('discord_token');
        const res = await fetch('/.netlify/functions/updates', {
            headers: {
                'Authorization': token
            }
        });
        if (!res.ok) throw new Error('Failed to load updates');
        const updates = await res.json();
        
        if (updates.length === 0) {
            grid.innerHTML = '<p class="no-updates">No updates available</p>';
            return;
        }
        
        // Sort by newest first
        updates.sort((a, b) => b.timestamp - a.timestamp);
        
        updates.forEach(item => {
            const bubble = document.createElement('div');
            bubble.className = 'update-bubble';
            bubble.innerHTML = `
                <div class="update-header">
                    <img src="${item.image}" alt="${item.title}" class="update-image" />
                    <div class="update-meta">
                        <h3>${item.title}</h3>
                        <span class="update-date">${item.date}</span>
                    </div>
                </div>
                <p>${item.description}</p>
                ${item.creatorAvatar && item.creatorUsername ? `
                <div class="created-by">
                    <img src="${item.creatorAvatar}" alt="${item.creatorUsername}" class="creator-avatar" />
                    <span class="creator-name">${item.creatorUsername}</span>
                </div>
                ` : ''}
            `;
            // If user has HR role, add delete button
            const roles = JSON.parse(localStorage.getItem('roles') || '[]');
            if (config.discord.creatorRole && roles.includes(config.discord.creatorRole)) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'delete-btn';
                deleteBtn.textContent = '×';
                deleteBtn.onclick = async (e) => {
                    e.stopPropagation();
                    if (confirm('Are you sure you want to delete this update?')) {
                        try {
                            const resp = await fetch(`/.netlify/functions/updates/${item.id}`, {
                                method: 'DELETE',
                                headers: { 
                                    'Authorization': token
                                }
                            });
                            if (resp.ok) {
                                showToast('Update deleted');
                                loadUpdates();
                            } else {
                                console.error('Failed to delete update, status:', resp.status);
                                showToast('Failed to delete update', true);
                            }
                        } catch (err) {
                            console.error('Error deleting update', err);
                            showToast('Error deleting update', true);
                        }
                    }
                };
                bubble.appendChild(deleteBtn);
            }
            grid.appendChild(bubble);
        });
    } catch (err) {
        console.error('Failed to load updates', err);
        grid.innerHTML = '<p class="error-message">Failed to load updates. Please try again later.</p>';
    }
}

// If on updates page, load updates
if (window.location.pathname.endsWith('updates.html')) {
    document.addEventListener('DOMContentLoaded', loadUpdates);
}

// Request browser notification permission
function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
        showToast("Your browser doesn't support notifications", true);
        return;
    }
    
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        showToast("Requesting notification permission...");
        Notification.requestPermission().then(permission => {
            console.log("Notification permission:", permission);
            if (permission === "granted") {
                showToast("Notifications enabled!");
                checkForUpdates();
            } else {
                showToast("Notification permission denied", true);
            }
        });
    } else if (Notification.permission === "granted") {
        showToast("Notifications already enabled!");
        checkForUpdates();
    } else {
        showToast("Notifications are blocked. Please enable them in your browser settings.", true);
    }
}

// Function to test notifications with a sample update
function forceTestNotification() {
    console.log("Testing notification...");
    const testUpdate = {
        id: 999,
        title: "Test Notification",
        creatorAvatar: "apdlogo.png",
        creatorUsername: "System"
    };
    showUpdateNotification(testUpdate);
}

// Function to show notification with update details
function showUpdateNotification(update) {
    console.log("Showing notification for update:", update);
    if (Notification.permission !== "granted") {
        console.log("Cannot show notification: permission not granted");
        showToast("Cannot show notification: permission not granted", true);
        return;
    }
    
    // Play sound with user interaction workaround for Chrome
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        fetch('notification.mp3')
            .then(response => response.arrayBuffer())
            .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
            .then(audioBuffer => {
                const source = audioContext.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContext.destination);
                source.start(0);
                console.log("Sound played using AudioContext");
            })
            .catch(e => console.error("Error playing sound with AudioContext:", e));
    } catch (e) {
        console.error("AudioContext error:", e);
        // Fallback method
        const sound = new Audio('notification.mp3');
        sound.volume = 0.8;
        const playPromise = sound.play();
        if (playPromise) {
            playPromise.catch(e => console.error("Fallback sound failed:", e));
        }
    }
    
    // Create notification
    const title = "New Update";
    const options = {
        body: update.title,
        icon: update.creatorAvatar || 'apdlogo.png',
        badge: 'apdlogo.png',
        data: update
    };
    
    try {
        const notification = new Notification(title, options);
        
        notification.onclick = function() {
            window.open('updates.html', '_blank');
            notification.close();
        };
        console.log("Browser notification created successfully");
    } catch (error) {
        console.error("Error creating browser notification:", error);
        showToast("Error creating notification", true);
    }
    
    // Also show as a toast
    showUpdateToast(update);
}

// Function to create a toast with update info and creator profile
function showUpdateToast(update) {
    const updateToast = document.createElement('div');
    updateToast.className = 'update-toast';
    updateToast.innerHTML = `
        <div class="update-toast-header">
            <strong>New Update</strong>
            <span class="close-toast">&times;</span>
        </div>
        <div class="update-toast-body">
            <p>${update.title}</p>
            ${update.creatorAvatar && update.creatorUsername ? `
            <div class="update-creator">
                <img src="${update.creatorAvatar}" alt="${update.creatorUsername}" />
                <span>${update.creatorUsername}</span>
            </div>
            ` : ''}
        </div>
        <button class="play-sound-btn">🔊 Play Sound</button>
    `;
    
    document.body.appendChild(updateToast);
    
    // Add animation class after a small delay for the animation to trigger
    setTimeout(() => {
        updateToast.classList.add('show');
    }, 10);
    
    // Close button functionality
    const closeBtn = updateToast.querySelector('.close-toast');
    closeBtn.addEventListener('click', () => {
        updateToast.classList.remove('show');
        setTimeout(() => {
            updateToast.remove();
        }, 300);
    });
    
    // Play sound button (needs user interaction for Chrome)
    const playBtn = updateToast.querySelector('.play-sound-btn');
    playBtn.addEventListener('click', () => {
        const sound = new Audio('notification.mp3');
        sound.volume = 0.8;
        sound.play().catch(e => console.error("Sound button failed:", e));
    });
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        updateToast.classList.remove('show');
        setTimeout(() => {
            updateToast.remove();
        }, 300);
    }, 5000);
}

// Check for new updates
async function checkForUpdates() {
    try {
        // Get last viewed update time from localStorage
        const lastViewedTime = localStorage.getItem('last-update-time') || 0;
        console.log("Last viewed update time:", new Date(parseInt(lastViewedTime)));
        
        // Get updates
        const res = await fetch('/updates.json');
        const updates = await res.json();
        console.log("Retrieved updates:", updates);
        
        if (updates.length > 0) {
            // Sort by newest first (assuming id is incremental)
            updates.sort((a, b) => b.id - a.id);
            
            // Get newest update
            const latestUpdate = updates[0];
            console.log("Latest update:", latestUpdate);
            
            // Store current timestamp
            const currentTime = Date.now();
            
            // Check if it's a new update by timestamp or ID
            const timestamp = latestUpdate.timestamp || 0;
            const isNewUpdate = timestamp > lastViewedTime || 
                                (updates.length > 0 && !localStorage.getItem('last-update-id') ||
                                 parseInt(localStorage.getItem('last-update-id')) < latestUpdate.id);
                                 
            console.log("New update check:", { timestamp, lastViewedTime, 
                                              lastUpdateId: localStorage.getItem('last-update-id'),
                                              latestId: latestUpdate.id,
                                              isNewUpdate });
                                              
            if (isNewUpdate) {
                showUpdateNotification(latestUpdate);
                localStorage.setItem('last-update-time', currentTime);
                localStorage.setItem('last-update-id', latestUpdate.id);
                console.log("Notification triggered for latest update");
            } else {
                console.log("No new updates to notify about");
            }
        } else {
            console.log("No updates found");
        }
    } catch (err) {
        console.error('Failed to check for updates:', err);
        showToast("Error checking for updates", true);
    }
}

// Add real-time update polling
// Poll for updates
function startUpdatePolling() {
    // Initial check
    checkForUpdates();
    
    // Set up polling every 30 seconds
    setInterval(checkForUpdates, 30000);
    console.log("Update polling started");
    
    // Store poll start time in localStorage to coordinate across tabs/pages
    localStorage.setItem('polling-started', Date.now());
}

// Function to load recent updates on homepage
async function loadRecentUpdates() {
    const container = document.querySelector('.updates-bubble-container');
    if (!container) return; // Not on the homepage
    
    try {
        const token = localStorage.getItem('discord_token');
        const res = await fetch('/.netlify/functions/updates', {
            headers: {
                'Authorization': token
            }
        });
        if (!res.ok) throw new Error('Failed to load updates');
        const updates = await res.json();
        
        if (updates.length === 0) {
            container.innerHTML = '<p class="no-updates">No updates available</p>';
            return;
        }
        
        // Sort by newest first
        updates.sort((a, b) => b.timestamp - a.timestamp);
        
        // Take only the latest 4 updates
        const recentUpdates = updates.slice(0, 4);
        
        // Create one update per row
        const rows = [];
        for (let i = 0; i < recentUpdates.length; i++) {
            const row = document.createElement('div');
            row.className = 'update-bubble-row';
            
            // Add single update per row
            row.appendChild(createUpdateBubble(recentUpdates[i]));
            
            rows.push(row);
        }
        
        // Clear and append rows
        container.innerHTML = '';
        rows.forEach(row => container.appendChild(row));
        
    } catch (err) {
        console.error('Error loading recent updates:', err);
        container.innerHTML = '<p class="error-message">Failed to load updates</p>';
    }
}

// Helper function to create an update bubble
function createUpdateBubble(update) {
    const item = document.createElement('div');
    item.className = 'update-bubble-item';
    
    // Create the update layout with chat bubble style
    item.innerHTML = `
        <div class="update-bubble-icon">
            <img src="${update.image || 'apdlogo.png'}" alt="${update.title}">
        </div>
        
        <div class="update-bubble-content">
            <h3>${update.title}</h3>
            <p>${update.description}</p>
            ${update.creatorAvatar && update.creatorUsername ? `
            <div class="update-bubble-creator">
                <img src="${update.creatorAvatar}" alt="${update.creatorUsername}">
                <span>${update.creatorUsername}</span>
            </div>
            ` : ''}
        </div>
    `;
    
    // Make the entire bubble clickable to view the full update
    const contentBubble = item.querySelector('.update-bubble-content');
    contentBubble.style.cursor = 'pointer';
    contentBubble.addEventListener('click', () => {
        window.location.href = 'updates.html';
    });
    
    const iconBubble = item.querySelector('.update-bubble-icon');
    iconBubble.style.cursor = 'pointer';
    iconBubble.addEventListener('click', () => {
        window.location.href = 'updates.html';
    });
    
    return item;
}

// Connect to Server-Sent Events for real-time notifications
function connectToNotificationStream() {
    let retryCount = 0;
    const maxRetries = 5;
    const baseDelay = 1000; // Start with 1 second delay

    function connect() {
        try {
            const eventSource = new EventSource('/.netlify/functions/notifications', {
                withCredentials: false
            });
            
            eventSource.addEventListener('open', () => {
                console.log('SSE connection opened');
                retryCount = 0; // Reset retry count on successful connection
            });

            eventSource.addEventListener('message', (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('SSE message:', data);
                    
                    if (data.type === 'connected') {
                        console.log('Connected to notification stream');
                    } 
                    else if (data.type === 'new-update') {
                        showUpdateNotification(data.update);
                        console.log('Received new update notification from server');
                    }
                } catch (err) {
                    console.error('Error parsing SSE message:', err);
                }
            });
            
            eventSource.addEventListener('error', (err) => {
                console.error('EventSource error:', err);
                eventSource.close();
                
                // Implement exponential backoff for reconnection
                if (retryCount < maxRetries) {
                    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                    retryCount++;
                    console.log(`Reconnecting in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
                    setTimeout(connect, delay);
                } else {
                    console.error('Max retry attempts reached. Stopping reconnection.');
                }
            });
            
        } catch (error) {
            console.error('Failed to connect to notification stream:', error);
            if (retryCount < maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
                retryCount++;
                setTimeout(connect, delay);
            }
        }
    }

    // Start the initial connection
    connect();
}

// Theme initialization
function initializeTheme() {
    const theme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
}