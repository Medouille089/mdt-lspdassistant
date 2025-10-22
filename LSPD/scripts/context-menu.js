// context-menu.js
// Ajoute un menu clic droit personnalisé sur tout le site

const MENU_ITEMS = [
  { label: 'Retour', shortcut: 'Alt+Gauche', action: () => history.back() },
  { label: 'Avancer', shortcut: 'Alt+Droite', action: () => history.forward() },
  { label: 'Actualiser', shortcut: 'Ctrl+R', action: () => location.reload() },
  { separator: true },
  { label: 'Copier', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
  { label: 'Couper', shortcut: 'Ctrl+X', action: cutHandler, id: 'cut-item' },
  { label: 'Coller', shortcut: 'Ctrl+V', action: pasteHandler, id: 'paste-item' },
  { separator: true },
  { label: 'Imprimer...', shortcut: 'Ctrl+P', action: () => window.print() }
];

let lastActiveInput = null;
let is_active = true;

function pasteHandler() {
  if (navigator.clipboard) {
    navigator.clipboard.readText().then(text => {
      let target = null;
      let start = 0;
      let end = 0;
      if (lastActiveInput && lastActiveInput.el) {
        target = lastActiveInput.el;
        start = lastActiveInput.start;
        end = lastActiveInput.end;
      } else {
        const active = document.activeElement;
        if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
          target = active;
          start = active.selectionStart;
          end = active.selectionEnd;
        }
      }
      if (target) {
        const value = target.value;
        target.value = value.slice(0, start) + text + value.slice(end);
        target.selectionStart = target.selectionEnd = start + text.length;
        target.focus();
      } else {
        alert('Placez le curseur dans un champ texte pour coller.');
      }
    });
  }
}

function cutHandler() {
  let target = null;
  if (lastActiveInput && lastActiveInput.el) {
    target = lastActiveInput.el;
  } else {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
      target = active;
    }
  }
  if (target) {
    // Sélectionne tout le texte si rien n'est sélectionné
    if (target.selectionStart === target.selectionEnd) {
      target.selectionStart = 0;
      target.selectionEnd = target.value.length;
    }
    document.execCommand('cut');
  } else {
    alert('Placez le curseur dans un champ texte pour couper.');
  }
}

function createContextMenu(x, y) {
  removeContextMenu();
  const menu = document.createElement('div');
  menu.className = 'context-menu';
  menu.style.top = y + 'px';
  menu.style.left = x + 'px';

  MENU_ITEMS.forEach(item => {
    if (item.separator) {
      const sep = document.createElement('div');
      sep.className = 'context-menu__separator';
      menu.appendChild(sep);
      return;
    }
    const div = document.createElement('div');
    div.className = 'context-menu__item';
    div.textContent = item.label;
    if (item.shortcut) {
      const shortcut = document.createElement('span');
      shortcut.className = 'context-menu__shortcut';
      shortcut.textContent = item.shortcut;
      div.appendChild(shortcut);
    }
    if (item.id) div.id = item.id;
    div.onclick = (e) => {
      e.stopPropagation();
      removeContextMenu();
      if (!div.classList.contains('disabled')) item.action && item.action();
    };
    menu.appendChild(div);
  });

  document.body.appendChild(menu);

  // Gérer l'état du bouton "Coller"
  const pasteItem = document.getElementById('paste-item');
  if (pasteItem && navigator.clipboard) {
    navigator.clipboard.readText().then(text => {
      if (!text) {
        pasteItem.classList.add('disabled');
        pasteItem.style.opacity = '0.5';
        pasteItem.style.pointerEvents = 'none';
      } else {
        pasteItem.classList.remove('disabled');
        pasteItem.style.opacity = '';
        pasteItem.style.pointerEvents = '';
      }
    });
  }

  document.body.appendChild(menu);
}

function removeContextMenu() {
  const existing = document.querySelector('.context-menu');
  if (existing) existing.remove();
}

document.addEventListener('contextmenu', function (e) {
  if (!is_active) return;
  // Mémorise le champ actif si c'est un input ou textarea
  const active = document.activeElement;
  if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
    lastActiveInput = {
      el: active,
      start: active.selectionStart,
      end: active.selectionEnd
    };
  } else {
    lastActiveInput = null;
  }
  e.preventDefault();
  createContextMenu(e.clientX, e.clientY);
});
document.addEventListener('click', removeContextMenu);
document.addEventListener('scroll', removeContextMenu);
