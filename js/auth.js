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
      messagesLink.innerHTML = `<a href="account.html#messages">Messages${badge}</a>`;
    }
    if (ordersLink) ordersLink.style.display = 'list-item';
  } else {
    authLink.innerHTML = `<a href="auth.html">Sign In</a>`;
    if (messagesLink) messagesLink.style.display = 'none';
    if (ordersLink) ordersLink.style.display = 'none';
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

(function randomizeNavBtn() {
  const btn = document.querySelector('.btn-nav');
  if (!btn) return;
  if (Math.random() < 0.5) {
    btn.textContent = '+ Buy Gear';
    btn.href = 'browse.html';
    const li = btn.parentElement;
    li.classList.add('nav-dropdown');
    const menu = document.createElement('ul');
    menu.className = 'nav-dropdown-menu';
    menu.innerHTML = '<li><a href="post.html">+ Sell Gear</a></li>';
    li.appendChild(menu);
  }
})();
