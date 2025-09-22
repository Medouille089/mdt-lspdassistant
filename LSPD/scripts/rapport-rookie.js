document.addEventListener('DOMContentLoaded', async () => {
  const agentSelect = document.getElementById('agent');
  const officierInput = document.getElementById('officier');
  const gradeInput = document.getElementById('grade');
  const form = document.getElementById('sanctionForm');

  // 1️⃣ Récupérer les rookies
  const resRookies = await fetch('/api/rookies');
  const rookies = await resRookies.json();
  rookies.forEach(r => {
    const option = document.createElement('option');
    option.value = r.id;
    option.textContent = r.displayName;
    agentSelect.appendChild(option);
  });

  // 2️⃣ Récupérer l'agent rédacteur connecté
  const resMe = await fetch('/api/me');
  const me = await resMe.json();
  officierInput.value = me.displayName;
  gradeInput.value = me.grade;

  // 3️⃣ Submit du formulaire
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      rookieId: agentSelect.value,
      conduite: document.getElementById('conduite').value,
      radio: document.getElementById('radio').value,
      procedures: document.getElementById('procedures').value,
      ville: document.getElementById('ville').value,
      trello: document.getElementById('trello').value,
      mdt: document.getElementById('mdt').value,
      hierarchie: document.getElementById('hierarchie').value,
      attitude: document.querySelectorAll('textarea')[0].value,
      appreciation: document.querySelectorAll('textarea')[1].value,
      officier: officierInput.value,
      grade: gradeInput.value
    };

    const res = await fetch('/api/rapport-rookie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    alert(data.message);
  });
});
