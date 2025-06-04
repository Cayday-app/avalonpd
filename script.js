// Discord configuration
const config = {
    discord: {
        clientId: '1363747847039881347',
        guildId: '1363747433074655433',
        requiredRoles: ['1363749144266674267'],
        creatorRole: '1363771721177628692',
        redirectUri: 'https://avalonpd.netlify.app/auth/callback'
    }
};

// Role definitions
const ROLES = {
    HR: '1363771721177628692',
    OFFICER: '1363749144266674267',
    COMMAND: '1363747433074655435',
    DETECTIVE: '1363747433074655436',
    FTO: '1363747433074655437'
};

// Handle loading screen
document.addEventListener('readystatechange', () => {
    if (document.readyState === 'complete') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 500);
        }
    }
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
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

// Generate a random state string
function generateState() {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array, dec => ('0' + dec.toString(16)).slice(-2)).join('');
}

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

// Handle Discord auth
function handleDiscordAuth() {
    const scopes = encodeURIComponent('identify guilds.members.read guilds');
    const state = generateState();
    sessionStorage.setItem('discord_state', state);
    sessionStorage.setItem('login_redirect', window.location.href);
    
    const authUrl = `https://discord.com/oauth2/authorize` + 
        `?client_id=${config.discord.clientId}` +
        `&redirect_uri=${encodeURIComponent(config.discord.redirectUri)}` +
        `&response_type=token` +
        `&scope=${scopes}` +
        `&state=${state}` +
        `&prompt=consent`;
    
    window.location.href = authUrl;
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

        // Fetch user's guild member data
        const memberResponse = await fetch(`https://discord.com/api/users/@me/guilds/${config.discord.guildId}/member`, {
            headers: {
                'Authorization': `${tokenType} ${accessToken}`
            }
        });
        const memberData = await memberResponse.json();

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
        
        sessionStorage.setItem('discord_auth', JSON.stringify(authData));
        
        // Update UI
        updateLoginState();
        updateRestrictedNav();
        showToast('Successfully logged in!');
        
        // Redirect back to original page
        const redirectUrl = sessionStorage.getItem('login_redirect') || '/';
        sessionStorage.removeItem('login_redirect');
        window.location.href = redirectUrl;
        
        return true;
    } catch (error) {
        console.error('Auth error:', error);
        showToast(error.message || 'Authentication failed. Please try again.', true);
        window.location.href = '/';
        return false;
    }
}

function initializeAuth() {
    const authData = JSON.parse(sessionStorage.getItem('discord_auth') || '{}');
    updateLoginState();
    updateRestrictedNav();
}

// Update login button and user state
function updateLoginState() {
    const authData = JSON.parse(sessionStorage.getItem('discord_auth') || '{}');
    const loginBtn = document.querySelector('.login-btn');
    
    if (loginBtn) {
        if (authData.user) {
            loginBtn.innerHTML = `
                <img src="${authData.user.avatar}" 
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

// Handle logout
function handleLogout() {
    sessionStorage.removeItem('discord_auth');
    updateLoginState();
    updateRestrictedNav();
    showToast('Successfully logged out!');
    
    const restrictedPages = ['/roster.html', '/sop.html', '/group.html', '/shift-log.html'];
    if (restrictedPages.includes(window.location.pathname)) {
        window.location.href = '/';
    }
}

// Update restricted navigation visibility
function updateRestrictedNav() {
    const authData = JSON.parse(sessionStorage.getItem('discord_auth') || '{}');
    const userRoles = authData.user?.roles || [];
    
    const restrictedNav = document.querySelectorAll('.restricted-nav');
    const isOfficer = hasAnyRole(userRoles, [ROLES.OFFICER]);

    const restrictedCreate = document.querySelectorAll('.restricted-create');
    const isHR = hasRole(userRoles, ROLES.HR);

    restrictedNav.forEach(nav => {
        nav.style.display = isOfficer ? 'inline-block' : 'none';
    });

    restrictedCreate.forEach(nav => {
        nav.style.display = isHR ? 'inline-block' : 'none';
    });

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