// Widerspruch gegen die Reichweitenmessung (Rybbit) auf der Datenschutz-Seite.
// Rybbit prüft beim Laden, ob der Schlüssel „disable-rybbit“ im Local Storage existiert.

const KEY = 'disable-rybbit';
const button = document.getElementById('optout') as HTMLButtonElement | null;

function isOptedOut(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

function render() {
  if (!button) return;
  button.textContent = isOptedOut()
    ? 'Statistik ist in diesem Browser deaktiviert – wieder aktivieren'
    : 'Statistik in diesem Browser deaktivieren';
}

button?.addEventListener('click', () => {
  try {
    if (isOptedOut()) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, 'true');
  } catch {
    /* Local Storage gesperrt – dann gibt es auch keine Messung */
  }
  render();
});

render();
