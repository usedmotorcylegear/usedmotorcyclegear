async function getUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

async function updateNavForUser() {
  const user = await getUser();
  const link = document.getElementById('nav-auth-link');
  if (!link) return;
  if (user) {
    link.innerHTML = `<a href="account.html">My Account</a></li><li><a href="account.html#messages">Messages</a>`;
  } else {
    link.innerHTML = `<a href="auth.html">Sign In</a>`;
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
