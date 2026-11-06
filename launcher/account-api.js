// Optional accounts API adapter.
//
// The launchpad works entirely on localStorage by default. When a Pretzel
// backend answers /api/status (same origin, or an origin configured through
// window.PRETZEL_API_BASE / localStorage "pretzel.apiBase"), accounts, friends
// and cosmetics go through the server instead.
(function () {
  'use strict';

  var TOKEN_KEY = 'pretzel.token.v1';
  var BASE_KEY = 'pretzel.apiBase';
  var probe = null;
  var enabledCache = null;

  function base() {
    var configured = (typeof window !== 'undefined' && window.PRETZEL_API_BASE) || '';
    if (configured) return String(configured).replace(/\/+$/, '');
    try {
      var stored = localStorage.getItem(BASE_KEY);
      if (stored) return String(stored).replace(/\/+$/, '');
    } catch (e) { /* ignore */ }
    return '';
  }

  function token() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch (e) { return ''; }
  }

  function setToken(value) {
    try {
      if (value) localStorage.setItem(TOKEN_KEY, value);
      else localStorage.removeItem(TOKEN_KEY);
    } catch (e) { /* ignore */ }
  }

  async function request(path, options) {
    var opts = Object.assign({ method: 'GET', headers: {} }, options || {});
    var bearer = token();
    if (bearer) opts.headers.Authorization = 'Bearer ' + bearer;
    if (opts.body && typeof opts.body !== 'string') {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    var res = await fetch(base() + path, opts);
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      var message = data && data.error ? data.error : 'Request failed (' + res.status + ')';
      var error = new Error(message);
      error.status = res.status;
      throw error;
    }
    return data || {};
  }

  function enabled() {
    if (enabledCache !== null) return Promise.resolve(enabledCache);
    if (probe) return probe;
    probe = fetch(base() + '/api/status', { cache: 'no-store' })
      .then(function (res) {
        enabledCache = res.ok;
        return enabledCache;
      })
      .catch(function () {
        enabledCache = false;
        return false;
      })
      .then(function (value) {
        probe = null;
        return value;
      });
    return probe;
  }

  function adopt(payload) {
    if (payload && payload.token) setToken(payload.token);
    return payload || {};
  }

  window.PretzelAccountApi = {
    base: base,
    token: token,
    enabled: enabled,

    signup: function (username, email, password) {
      return request('/api/signup', { method: 'POST', body: { username: username, email: email, password: password } }).then(adopt);
    },
    login: function (username, password) {
      return request('/api/login', { method: 'POST', body: { username: username, password: password } }).then(adopt);
    },
    me: function () {
      return request('/api/me');
    },
    presence: function () {
      return request('/api/presence', { method: 'POST' });
    },
    friends: function () {
      return request('/api/friends');
    },
    requestFriend: function (username) {
      return request('/api/friends/request', { method: 'POST', body: { username: username } });
    },
    acceptFriend: function (username) {
      return request('/api/friends/accept', { method: 'POST', body: { username: username } });
    },
    removeFriend: function (username) {
      return request('/api/friends/' + encodeURIComponent(username), { method: 'DELETE' });
    },
    loadCosmetics: function () {
      return request('/api/cosmetics');
    },
    saveCosmetics: function (owned, equipped) {
      return request('/api/cosmetics', { method: 'PUT', body: { owned: owned || [], equipped: equipped || {} } });
    },
    signOut: function () {
      setToken('');
    }
  };
})();
