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
    if (messagesLink) messagesLink.style.display = 'list-item';
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
