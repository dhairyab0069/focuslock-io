/* FocusLock page: tiny DOM helpers shared by the page modules. */
(function (root) {
  'use strict';
  var UI = {
    $: function (id) { return document.getElementById(id); },
    el: function (tag, attrs, kids) {
      var n = document.createElement(tag);
      Object.keys(attrs || {}).forEach(function (k) {
        if (k === 'text') n.textContent = attrs[k];
        else if (k === 'on') Object.keys(attrs.on).forEach(function (e) { n.addEventListener(e, attrs.on[e]); });
        else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
      });
      (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
      return n;
    },
    restart: function (node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); },
    later: function (fn, ms) { return setTimeout(fn, ms); },
    announce: function (t) { var a = document.getElementById('announce'); if (a) a.textContent = t; },
    save: function (k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} },
    load: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    loadJSON: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    forget: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  root.FLUI = UI;
})(window);
