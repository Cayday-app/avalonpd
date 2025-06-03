// Auth handling
document.addEventListener('DOMContentLoaded', function() {
    // Initialize auth
    initializeAuth();
});

function initializeAuth() {
    // Check login state
    const token = localStorage.getItem('discord_token');
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    
    // Update UI based on login state
    updateLoginState();
    
    // Update restricted nav visibility
    updateRestrictedNav();
    
    // Hide loading overlay
    const loadingOverlay = document.getElementById('loading-overlay');
    if (loadingOverlay) {
        setTimeout(() => {
            loadingOverlay.style.opacity = 0;
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 300);
        }, 500);
    }
    
    // Handle OAuth code if present
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const state = urlParams.get('state');
    const storedState = localStorage.getItem('discord_state');
    
    if (code) {
        // Verify state to prevent CSRF attacks
        if (state && state === storedState) {
            handleAuthCode(code).catch(error => {
                console.error('Auth error:', error);
                showToast(error.message || 'Authentication failed', true);
            });
        } else {
            console.error('State mismatch');
            showToast('Authentication failed: Invalid state', true);
        }
        // Clean up state
        localStorage.removeItem('discord_state');
    }
}

// Update login button
function updateLoginState() {
    const token = localStorage.getItem('discord_token');
    const userData = JSON.parse(localStorage.getItem('user_data') || '{}');
    const loginBtn = document.querySelector('.login-btn');
    
    if (loginBtn) {
        if (token && userData.username) {
            // User is logged in
            loginBtn.innerHTML = `
                <img src="${userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                    alt="${userData.username}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">
                ${userData.username}
            `;
            loginBtn.onclick = handleLogout;
        } else {
            // User is not logged in
            loginBtn.innerHTML = `
                <i class="fab fa-discord"></i>
                LOGIN WITH DISCORD
            `;
            loginBtn.onclick = handleDiscordAuth;
        }
    }
}

// Generate a random state string
function generateState() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).slice(-2)).join('');
}

// Handle Discord auth
function handleDiscordAuth() {
    // Get environment variables from window.ENV (injected by Netlify)
    const clientId = window.ENV?.DISCORD_CLIENT_ID || '1363747847039881347';
    const redirectUri = encodeURIComponent(window.location.origin + '/auth/callback');
    const scopes = encodeURIComponent('identify guilds guilds.members.read');
    const guildId = window.ENV?.DISCORD_GUILD_ID || '1363747433074655433';
    
    // Generate and store state for CSRF protection
    const state = generateState();
    localStorage.setItem('discord_state', state);
    
    // Save the current URL to return to after login
    localStorage.setItem('login_redirect', window.location.href);
    
    const authUrl = `https://discord.com/oauth2/authorize` + 
        `?client_id=${clientId}` +
        `&redirect_uri=${redirectUri}` +
        `&response_type=code` +
        `&scope=${scopes}` +
        `&state=${state}` +
        `&guild_id=${guildId}` +
        `&prompt=consent`;
    
    window.location.href = authUrl;
}

// Handle the authorization code from Discord
async function handleAuthCode(code) {
    try {
        showToast('Authenticating...');
        
        console.log('Starting authentication process...');
        const response = await fetch('/.netlify/functions/discord-auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                code,
                redirectUri: window.location.origin + '/auth/callback'
            })
        });
        
        if (!response.ok) {
            const text = await response.text();
            console.error('Auth response error:', {
                status: response.status,
                statusText: response.statusText,
                body: text
            });
            throw new Error(text || 'Authentication failed');
        }
        
        const data = await response.json();
        console.log('Authentication response received');
        
        if (!data.token || !data.userData) {
            console.error('Invalid response data:', data);
            throw new Error('Invalid authentication response');
        }
        
        // Store the data
        localStorage.setItem('discord_token', data.token);
        localStorage.setItem('user_data', JSON.stringify(data.userData));
        localStorage.setItem('roles', JSON.stringify(data.roles));
        localStorage.setItem('has_access', data.hasAccess ? 'true' : 'false');
        localStorage.setItem('creator_role', data.creatorRole);
        
        // Update UI
        updateLoginState();
        updateRestrictedNav();
        
        // Remove the code from the URL without refreshing
        const url = new URL(window.location.href);
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        window.history.replaceState({}, document.title, url.toString());
        
        showToast('Successfully logged in!');
        
        // Get the redirect URL and remove it from storage
        const redirectUrl = localStorage.getItem('login_redirect') || '/';
        localStorage.removeItem('login_redirect');
        
        // Only redirect if we're not already on the target page
        if (window.location.pathname !== redirectUrl) {
            window.location.href = redirectUrl;
        }
        
    } catch (error) {
        console.error('Authentication error:', error);
        showToast(error.message || 'Authentication failed', true);
        clearAuthData();
        throw error;
    }
}

// Clear all auth data
function clearAuthData() {
    localStorage.removeItem('discord_token');
    localStorage.removeItem('user_data');
    localStorage.removeItem('roles');
    localStorage.removeItem('has_access');
    localStorage.removeItem('creator_role');
    localStorage.removeItem('login_redirect');
}

// Handle logout
function handleLogout() {
    if (confirm('Are you sure you want to log out?')) {
        clearAuthData();
        updateLoginState();
        updateRestrictedNav();
        showToast('Successfully logged out');
        window.location.reload();
    }
}

// Update restricted nav visibility
function updateRestrictedNav() {
    const token = localStorage.getItem('discord_token');
    const hasAccess = localStorage.getItem('has_access') === 'true';
    const userRoles = JSON.parse(localStorage.getItem('roles') || '[]');
    
    const restrictedNavItems = document.querySelectorAll('.restricted-nav');
    restrictedNavItems.forEach(item => {
        item.style.display = (token && hasAccess) ? 'block' : 'none';
    });
    
    const restrictedCreateItems = document.querySelectorAll('.restricted-create');
    const hasCreatorRole = userRoles.includes(localStorage.getItem('creator_role'));
    restrictedCreateItems.forEach(item => {
        item.style.display = (token && hasCreatorRole) ? 'block' : 'none';
    });
}

// Toast notification helper
function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }, 100);
}

// Add event listener to theme button
const themeBtn = document.getElementById('theme-btn');
const themeModal = document.getElementById('theme-modal');

if (themeBtn && themeModal) {
    themeBtn.addEventListener('click', function() {
        themeModal.style.display = 'flex';
    });
    
    // Close theme modal
    const closeThemeModal = document.getElementById('close-theme-modal');
    if (closeThemeModal) {
        closeThemeModal.addEventListener('click', function() {
            themeModal.style.display = 'none';
        });
    }
    
    // Apply theme
    const applyThemeBtn = document.getElementById('apply-theme-btn');
    if (applyThemeBtn) {
        applyThemeBtn.addEventListener('click', function() {
            const color1 = document.getElementById('theme-color1').value;
            const color2 = document.getElementById('theme-color2').value;
            const themeType = document.querySelector('input[name="theme-type"]:checked').value;
            
            updateTheme(color1, color2, themeType);
            themeModal.style.display = 'none';
        });
    }
}

// Load saved theme
loadSavedTheme();

// Update theme
function updateTheme(color1, color2, themeType) {
    const root = document.documentElement;
    
    if (themeType === 'solid') {
        root.style.setProperty('--primary', color1);
        root.style.setProperty('--accent', color2);
        root.style.setProperty('--background', darkenColor(color1, 20));
    } else {
        // Gradient theme
        root.style.setProperty('--primary', color1);
        root.style.setProperty('--accent', color2);
        root.style.setProperty('--background', `linear-gradient(135deg, ${color1}, ${darkenColor(color1, 20)})`);
    }
    
    // Save theme
    localStorage.setItem('theme', JSON.stringify({
        color1,
        color2,
        themeType
    }));
}

// Load saved theme
function loadSavedTheme() {
    const savedTheme = JSON.parse(localStorage.getItem('theme') || 'null');
    
    if (savedTheme) {
        updateTheme(savedTheme.color1, savedTheme.color2, savedTheme.themeType);
        
        // Update theme picker
        const color1Input = document.getElementById('theme-color1');
        const color2Input = document.getElementById('theme-color2');
        const themeTypeInputs = document.querySelectorAll('input[name="theme-type"]');
        
        if (color1Input) color1Input.value = savedTheme.color1;
        if (color2Input) color2Input.value = savedTheme.color2;
        
        themeTypeInputs.forEach(input => {
            if (input.value === savedTheme.themeType) {
                input.checked = true;
            }
        });
    }
}

// Helper: Darken color
function darkenColor(color, percent) {
    let R = parseInt(color.substring(1, 3), 16);
    let G = parseInt(color.substring(3, 5), 16);
    let B = parseInt(color.substring(5, 7), 16);

    R = Math.floor(R * (100 - percent) / 100);
    G = Math.floor(G * (100 - percent) / 100);
    B = Math.floor(B * (100 - percent) / 100);

    R = (R < 255) ? R : 255;
    G = (G < 255) ? G : 255;
    B = (B < 255) ? B : 255;

    const RR = ((R.toString(16).length === 1) ? '0' + R.toString(16) : R.toString(16));
    const GG = ((G.toString(16).length === 1) ? '0' + G.toString(16) : G.toString(16));
    const BB = ((B.toString(16).length === 1) ? '0' + B.toString(16) : B.toString(16));

    return '#' + RR + GG + BB;
}

// Debug helper function
function debugAuth() {
    const debugInfo = {
        token: localStorage.getItem('discord_token') ? 'Present' : 'Not present',
        userData: JSON.parse(localStorage.getItem('user_data') || '{}'),
        roles: JSON.parse(localStorage.getItem('roles') || '[]'),
        hasAccess: localStorage.getItem('has_access'),
        creatorRole: localStorage.getItem('creator_role'),
        currentUrl: window.location.href,
        redirectUri: window.location.origin,
        clientId: window.ENV?.DISCORD_CLIENT_ID || '1363747847039881347',
        guildId: window.ENV?.DISCORD_GUILD_ID || '1363747433074655433'
    };

    console.log('Auth Debug Info:', debugInfo);
    return debugInfo;
}

// Add debug button to debug panel
document.addEventListener('DOMContentLoaded', function() {
    const debugPanel = document.getElementById('debug-panel');
    if (debugPanel) {
        const debugAuthBtn = document.createElement('button');
        debugAuthBtn.textContent = 'Debug Auth';
        debugAuthBtn.style.marginLeft = '10px';
        debugAuthBtn.onclick = () => {
            const info = debugAuth();
            document.getElementById('debug-info').innerHTML = '<pre>' + JSON.stringify(info, null, 2) + '</pre>';
        };
        document.getElementById('check-config').after(debugAuthBtn);
    }
}); 