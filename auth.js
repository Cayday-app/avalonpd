// Auth handling
document.addEventListener('DOMContentLoaded', function() {
    // Initialize auth
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

// Role definitions
const ROLES = {
    HR: '1363771721177628692',
    OFFICER: '1363747433074655434', // Officer role
    COMMAND: '1363747433074655435', // Command role
    DETECTIVE: '1363747433074655436', // Detective role
    FTO: '1363747433074655437' // FTO role
};

// Check if user has any of the specified roles
function hasAnyRole(userRoles, requiredRoles) {
    if (!userRoles || !Array.isArray(userRoles)) return false;
    return requiredRoles.some(role => userRoles.includes(role));
}

// Check if user has a specific role
function hasRole(userRoles, requiredRole) {
    if (!userRoles || !Array.isArray(userRoles)) return false;
    return userRoles.includes(requiredRole);
}

function initializeAuth() {
    const authData = JSON.parse(sessionStorage.getItem('discord_auth') || '{}');
    updateLoginState();
    updateRestrictedNav();
    
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
function updateLoginState() {
    const authData = JSON.parse(sessionStorage.getItem('discord_auth') || '{}');
    const loginBtn = document.querySelector('.login-btn');
    
    if (loginBtn) {
        if (authData.user) {
            loginBtn.innerHTML = `
                <img src="${authData.user.avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" 
                    alt="${authData.user.username}" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">
                ${authData.user.username}
            `;
            loginBtn.onclick = handleLogout;
        } else {
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
        `&response_type=token` +
        `&scope=${scopes}` +
        `&state=${state}` +
        `&prompt=consent`;
    
    window.location.href = authUrl;
}

// Handle logout
function handleLogout() {
    // Clear auth data
    sessionStorage.removeItem('discord_auth');
    
    // Update UI
    updateLoginState();
    updateRestrictedNav();
    
    // Show toast
    showToast('Successfully logged out!');
    
    // Redirect to home if on a restricted page
    const restrictedPages = ['/roster.html', '/sop.html', '/group.html', '/shift-log.html'];
    if (restrictedPages.includes(window.location.pathname)) {
        window.location.href = '/';
    }
}

// Update restricted navigation visibility
function updateRestrictedNav() {
    const authData = JSON.parse(sessionStorage.getItem('discord_auth') || '{}');
    const userRoles = authData.user?.roles || [];
    
    console.log('Current user roles:', userRoles);

    // Elements that require any officer role
    const restrictedNav = document.querySelectorAll('.restricted-nav');
    const isOfficer = hasAnyRole(userRoles, [
        ROLES.OFFICER,
        ROLES.COMMAND,
        ROLES.DETECTIVE,
        ROLES.FTO
    ]);

    // Elements that require HR role
    const restrictedCreate = document.querySelectorAll('.restricted-create');
    const isHR = hasRole(userRoles, ROLES.HR);

    // Update visibility based on roles
    restrictedNav.forEach(nav => {
        nav.style.display = isOfficer ? 'inline-block' : 'none';
    });

    restrictedCreate.forEach(nav => {
        nav.style.display = isHR ? 'inline-block' : 'none';
    });

    // If not an officer and on a restricted page, redirect to home
    const restrictedPages = ['/roster.html', '/sop.html', '/group.html', '/shift-log.html'];
    if (!isOfficer && restrictedPages.includes(window.location.pathname)) {
        window.location.href = '/';
        showToast('Access denied. Officer role required.', true);
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

        if (!memberData.roles || memberData.roles.length === 0) {
            throw new Error('You must be a member of the Avalon Police Department Discord server.');
        }

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
        sessionStorage.setItem('discord_auth', JSON.stringify(authData));
        
        // Update UI
        updateLoginState();
        updateRestrictedNav();
        
        // Show success message
        showToast('Successfully logged in!');
        
        // Redirect back to original page
        const redirectUrl = sessionStorage.getItem('login_redirect') || '/';
        sessionStorage.removeItem('login_redirect');
        window.location.href = redirectUrl;
    } catch (error) {
        console.error('Auth error:', error);
        showToast(error.message || 'Authentication failed. Please try again.', true);
        window.location.href = '/';
    }
} 