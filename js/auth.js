async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function updateNavForUser() {
  const user = await getUser();
  const authLink = document.getElementById('nav-auth-link');
  const messagesLink = document.getElementById('nav-messages-link');
  if (!authLink) return;
  if (user) {
    authLink.innerHTML = `<a href="account.html">My Account</a>`;
    if (messagesLink) {
      messagesLink.style.display = 'list-item';
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('read', false);
      const badge = count > 0 ? ` <span class="nav-badge">${count}</span>` : '';
      messagesLink.innerHTML = `<a href="account.html#messages">Messages${badge}</a>`;
    }
  } else {
    authLink.innerHTML = `<a href="auth.html">Sign In</a>`;
    if (messagesLink) messagesLink.style.display = 'none';
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
  }
})();
