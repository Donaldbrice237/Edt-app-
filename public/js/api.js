const Api = (() => {
  function token() {
    return localStorage.getItem('edt_token');
  }

  async function call(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const t = token();
    if (t) headers.Authorization = `Bearer ${t}`;

    const res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    let data = null;
    try { data = await res.json(); } catch (e) { /* réponse vide */ }

    if (!res.ok) {
      const message = (data && data.error) || `Erreur (${res.status})`;
      throw new Error(message);
    }
    return data;
  }

  return {
    get: (path) => call('GET', path),
    post: (path, body) => call('POST', path, body),
    put: (path, body) => call('PUT', path, body),
    del: (path) => call('DELETE', path),
    setToken: (t) => localStorage.setItem('edt_token', t),
    clearToken: () => localStorage.removeItem('edt_token'),
    hasToken: () => !!token(),
  };
})();
