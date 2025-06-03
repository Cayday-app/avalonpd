// Auth handling
document.addEventListener('DOMContentLoaded', function() {
    // Always check auth state on page load
    initializeAuth();
});

// Cookie helper functions
function setCookie(name, value, days = 7) {
    const expires = new Date(Date.now() + days * 864e5).toUTCString();
    document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/; secure; samesite=strict';
}

function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return decodeURIComponent(parts.pop().split(';').shift());
}

function deleteCookie(name) {
    document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; secure; samesite=strict';
}

function initializeAuth() {
    try {
        // Check if we have auth data in cookies
        const authData = getCookie('discord_auth') ? JSON.parse(getCookie('discord_auth')) : null;
        console.log('Auth data on init:', authData); // Debug log
        
        if (authData && authData.user) {
            // Validate token expiration
            const now = Date.now();
            if (authData.expiresAt && now < authData.expiresAt) {
                // Token is still valid
                console.log('Token valid, updating UI'); // Debug log
                updateLoginState(authData);
                updateRestrictedNav(authData);
            } else {
                // Token expired, clear auth
                console.log('Token expired, logging out'); // Debug log
                handleLogout();
            }
        } else {
            // No auth data, ensure logged out state
            console.log('No auth data, resetting UI'); // Debug log
            updateLoginState(null);
            updateRestrictedNav(null);
        }
    } catch (error) {
        console.error('Init auth error:', error);
        handleLogout();
    }
    
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
}

// Update login button and user state
function updateLoginState(authData = null) {
    try {
        if (!authData) {
            authData = getCookie('discord_auth') ? JSON.parse(getCookie('discord_auth')) : null;
        }
        
        const loginBtn = document.querySelector('.login-btn');
        console.log('Updating login state:', authData?.user); // Debug log
        
        if (loginBtn) {
            if (authData?.user) {
                // User is logged in
                const avatarUrl = authData.user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png';
                const username = authData.user.username || 'User';
                
                loginBtn.innerHTML = `
                    <img src="${avatarUrl}" 
                        alt="${username}" 
                        style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">
                    ${username}
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
    } catch (error) {
        console.error('Update login state error:', error);
        handleLogout();
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
    const clientId = '1363747847039881347';
    const redirectUri = 'https://avalonpd.netlify.app/auth/callback';
    const scopes = encodeURIComponent('identify guilds.members.read guilds');
    
    // Generate and store state for CSRF protection
    const state = generateState();
    sessionStorage.setItem('discord_state', state);
    
    // Save the current URL to return to after login
    sessionStorage.setItem('login_redirect', window.location.href);
    
    const authUrl = `https://discord.com/oauth2/authorize` + 
        `?client_id=${clientId}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=token` + // Using implicit grant flow
        `&scope=${scopes}` +
        `&state=${state}` +
        `&prompt=consent`;
    
    window.location.href = authUrl;
}

// Handle logout
function handleLogout() {
    try {
        // Clear auth data
        deleteCookie('discord_auth');
        
        // Update UI
        updateLoginState(null);
        updateRestrictedNav(null);
        
        // Show toast
        showToast('Successfully logged out!');
        
        // Redirect to home if on a restricted page
        const restrictedPages = ['/roster.html', '/sop.html', '/group.html', '/shift-log.html'];
        if (restrictedPages.includes(window.location.pathname)) {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Logout error:', error);
        // Force clear cookie and reload page
        deleteCookie('discord_auth');
        window.location.reload();
    }
}

// Update restricted navigation visibility
function updateRestrictedNav(authData = null) {
    try {
        if (!authData) {
            authData = getCookie('discord_auth') ? JSON.parse(getCookie('discord_auth')) : null;
        }
        
        const restrictedCreate = document.querySelectorAll('.restricted-create');
        const editButtons = document.querySelectorAll('.edit-btn');
        
        console.log('Current auth data:', authData); // Debug log
        
        // Check if user has HR role
        const isHR = authData?.user?.roles?.includes('1363771721177628692'); // HR role
        console.log('Is HR:', isHR); // Debug log
        
        // Update visibility
        restrictedCreate.forEach(nav => {
            nav.style.display = isHR ? 'inline-block' : 'none';
        });
        
        // Update edit button visibility
        editButtons.forEach(btn => {
            btn.style.display = isHR ? 'block' : 'none';
        });
    } catch (error) {
        console.error('Update restricted nav error:', error);
        // Hide all restricted elements on error
        document.querySelectorAll('.restricted-create, .edit-btn').forEach(el => {
            el.style.display = 'none';
        });
    }
}

// Toast notification
function showToast(message, isError = false) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    
    toast.className = isError ? 'toast error' : 'toast';
    toast.textContent = message;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
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
        clientId: '1363747847039881347',
        guildId: '1363747433074655433'
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

// Handle the OAuth callback
if (window.location.pathname === '/auth/callback') {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const [accessToken, tokenType] = [fragment.get('access_token'), fragment.get('token_type')];
    
    if (accessToken) {
        handleAuthToken(accessToken, tokenType);
    } else {
        console.error('No access token found in URL');
        window.location.href = '/';
    }
}

// Handle auth token and fetch user data
async function handleAuthToken(accessToken, tokenType) {
    try {
        // Fetch user data
        const userResponse = await fetch('https://discord.com/api/users/@me', {
            headers: {
                'Authorization': `${tokenType} ${accessToken}`
            }
        });
        const userData = await userResponse.json();
        console.log('User data:', userData);

        // Fetch user's guild member data
        const guildId = '1363747433074655433'; // APD server ID
        const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${guildId}/member`, {
            headers: {
                'Authorization': `${tokenType} ${accessToken}`
            }
        });
        const memberData = await memberResponse.json();
        console.log('Member data:', memberData);

        // Store auth data
        const authData = {
            token: accessToken,
            tokenType: tokenType,
            user: {
                ...userData,
                roles: memberData.roles || [],
                avatar: userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png',
                username: userData.username
            }
        };

        console.log('Storing auth data:', authData);
        localStorage.setItem('discord_auth', JSON.stringify(authData));
        
        // Update UI immediately
        updateLoginState();
        updateRestrictedNav();
        
        // Show success message
        showToast('Successfully logged in!');
        
        // Redirect back to original page
        const redirectUrl = localStorage.getItem('login_redirect') || '/';
        localStorage.removeItem('login_redirect');
        window.location.href = redirectUrl;
    } catch (error) {
        console.error('Auth error:', error);
        showToast('Authentication failed. Please try again.', true);
        window.location.href = '/';
    }
} 