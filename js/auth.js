// Hide nav links on desktop so they don't flash while auth resolves
(function() {
  if (window.matchMedia('(max-width: 768px)').matches) return;
  const links = document.querySelector('.nav-links');
  if (links) links.style.opacity = '0';
})();

async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function updateNavForUser() {
  const user = await getUser();
  const authLink = document.getElementById('nav-auth-link');
  const messagesLink = document.getElementById('nav-messages-link');
  if (!authLink) return;
  const ordersLink = document.getElementById('nav-orders-link');
  if (user) {
    authLink.innerHTML = `<a href="account.html">My Account</a>`;
    if (messagesLink) {
      messagesLink.style.display = 'list-item';
      const { data: unread } = await supabase
        .from('messages')
        .select('id')
        .eq('recipient_id', user.id)
        .eq('read', false);
      const unreadCount = unread ? unread.length : 0;
      const badge = unreadCount > 0 ? ` <span class="nav-badge">${unreadCount}</span>` : '';
      messagesLink.innerHTML = `<a href="inbox.html">Messages${badge}</a>`;
    }
    if (ordersLink) ordersLink.style.display = 'list-item';
  } else {
    authLink.innerHTML = `<a href="auth.html">Sign In</a>`;
    if (messagesLink) messagesLink.style.display = 'none';
    if (ordersLink) ordersLink.style.display = 'none';
  }

  if (!window.matchMedia('(max-width: 768px)').matches) {
    const links = document.querySelector('.nav-links');
    if (links) {
      links.style.transition = 'opacity 0.15s';
      links.style.opacity = '1';
    }
  }

  if (window.matchMedia('(max-width: 768px)').matches) {
    const btn = document.querySelector('.btn-nav');
    if (btn) {
      if (user) {
        btn.textContent = 'Sell Gear';
        btn.href = 'post.html';
      } else {
        btn.textContent = 'Buy / Sell Gear';
        btn.href = 'browse.html';
      }
    }
  }
}

async function requireAuth() {
  const user = await getUser();
  if (!user) {
    window.location.href = 'auth.html?next=' + encodeURIComponent(window.location.pathname);
  }
  return user;
}

updateNavForUser();

// Hamburger menu toggle
(function() {
  const hamburger = document.getElementById('nav-hamburger');
  if (!hamburger) return;
  const nav = document.querySelector('nav');
  hamburger.addEventListener('click', function(e) {
    e.stopPropagation();
    nav.classList.toggle('nav-open');
  });
  document.addEventListener('click', function(e) {
    if (nav.classList.contains('nav-open') && !nav.contains(e.target)) {
      nav.classList.remove('nav-open');
    }
  });
  document.querySelectorAll('.nav-links a').forEach(function(link) {
    link.addEventListener('click', function() {
      nav.classList.remove('nav-open');
    });
  });
})();

(function randomizeNavBtn() {
  const btn = document.querySelector('.btn-nav');
  if (!btn) return;
  const li = btn.parentElement;
  li.classList.add('nav-dropdown');
  const menu = document.createElement('ul');
  menu.className = 'nav-dropdown-menu';
  if (Math.random() < 0.5) {
    btn.textContent = '+ Buy Gear';
    btn.href = 'browse.html';
    menu.innerHTML = '<li><a href="post.html">+ Sell Gear</a></li>';
  } else {
    menu.innerHTML = '<li><a href="browse.html">+ Buy Gear</a></li>';
  }
  li.appendChild(menu);
})();
