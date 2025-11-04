function showLoader(show = true) {
    const loader = document.getElementById("loaderOverlay");
    if (loader) loader.style.display = show ? "flex" : "none";
}

function showFeedback(message, isSuccess = true) {
    const feedback = document.getElementById("feedbackAnimation");
    if (!feedback) return;

    feedback.innerHTML = "";
    const content = document.createElement("div");
    content.className = "feedback-inner";

    if (isSuccess) {
        content.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
        <circle class="path circle" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-miterlimit="10" cx="65.1" cy="65.1" r="60"/>
        <polyline class="path check" fill="none" stroke="#0b1b5a" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" points="100.2,40.2 51.5,88.8 29.8,67.5 "/>
      </svg>
      <p class="success">${message}</p>
    `;
    } else {
        content.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 130.2 130.2">
        <circle class="path circle" fill="none" stroke="#D06079" stroke-width="8" stroke-miterlimit="10" cx="65.1" cy="65.1" r="60"/>
        <line class="path line" fill="none" stroke="#D06079" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" x1="34.4" y1="37.9" x2="95.8" y2="92.3"/>
        <line class="path line" fill="none" stroke="#D06079" stroke-width="8" stroke-linecap="round" stroke-miterlimit="10" x1="95.8" y1="38" x2="34.4" y2="92.2"/>
      </svg>
      <p class="error">${message}</p>
    `;
    }

    feedback.appendChild(content);
    feedback.style.display = "flex";

    setTimeout(() => {
        feedback.style.display = "none";
    }, 3000);
}

let comptabiliteData = [];

async function loadComptabilite() {
    showLoader(true);
    try {
        const res = await fetch("/api/comptabilite");
        if (!res.ok) {
            throw new Error("Erreur lors du chargement des données");
        }
        comptabiliteData = await res.json();
        renderTables();
    } catch (err) {
        console.error("Erreur chargement comptabilité:", err);
        showFeedback("Erreur lors du chargement des données", false);
    } finally {
        showLoader(false);
    }
}

function calculateTotal(data, week, primeRisque, remboursementVehicule) {
    const basePay = parseFloat(data[week].basePay) || 0;
    const hourlySalary = parseFloat(data[week].hourlySalary) || 0;
    const primeEssence = parseFloat(data[week].primeEssence) || 0;
    const primeRisqueAmount = primeRisque ? 5000 : 0;
    const remboursementAmount = remboursementVehicule ? 1000 : 0;

    return basePay + hourlySalary + primeEssence + primeRisqueAmount + remboursementAmount;
}

function formatMoney(amount) {
    return `${parseFloat(amount).toFixed(2)} $`;
}

function renderTables() {
    renderWeekTable("thisWeek", "tbody-this-week");
    renderWeekTable("lastWeek", "tbody-last-week");
}

function renderWeekTable(week, tbodyId) {
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = "";

    let totalHours = 0;
    let totalBasePay = 0;
    let totalHourlySalary = 0;
    let totalPrimeEssence = 0;
    let grandTotal = 0;

    comptabiliteData.forEach((agent, index) => {
        const hours = parseFloat(agent[week].hours) || 0;
        const basePay = parseFloat(agent[week].basePay) || 0;
        const hourlySalary = parseFloat(agent[week].hourlySalary) || 0;
        const primeEssence = parseFloat(agent[week].primeEssence) || 0;

        const tr = document.createElement("tr");
        tr.dataset.index = index;
        tr.dataset.week = week;

        const total = calculateTotal(agent, week, false, false);

        tr.innerHTML = `
      <td>${agent.displayName}</td>
      <td>${agent.grade}</td>
      <td>${hours.toFixed(2)} h</td>
      <td class="amount">${formatMoney(basePay)}</td>
      <td class="amount">${formatMoney(hourlySalary)}</td>
      <td class="checkbox-cell">
        <input type="checkbox" 
               class="prime-risque-checkbox" 
               data-index="${index}" 
               data-week="${week}">
      </td>
      <td class="checkbox-cell">
        <input type="checkbox" 
               class="remboursement-checkbox" 
               data-index="${index}" 
               data-week="${week}">
      </td>
      <td class="amount">${formatMoney(primeEssence)}</td>
      <td class="total-value amount">${formatMoney(total)}</td>
      <td class="checkbox-cell">
        <input type="checkbox" 
               class="paid-checkbox" 
               data-index="${index}" 
               data-week="${week}">
      </td>
    `;

        tbody.appendChild(tr);

        // Accumuler les totaux
        totalHours += hours;
        totalBasePay += basePay;
        totalHourlySalary += hourlySalary;
        totalPrimeEssence += primeEssence;
        grandTotal += total;
    });

    // Ajouter la ligne de totaux
    const totalRow = document.createElement("tr");
    totalRow.className = "total-row";
    totalRow.innerHTML = `
      <td colspan="2" style="text-align: right; font-weight: bold;">TOTAL</td>
      <td style="font-weight: bold;">${totalHours.toFixed(2)} h</td>
      <td class="amount" style="font-weight: bold;">${formatMoney(totalBasePay)}</td>
      <td class="amount" style="font-weight: bold;">${formatMoney(totalHourlySalary)}</td>
      <td></td>
      <td></td>
      <td class="amount" style="font-weight: bold;">${formatMoney(totalPrimeEssence)}</td>
      <td class="total-value amount" style="font-weight: bold;">${formatMoney(grandTotal)}</td>
      <td></td>
    `;
    tbody.appendChild(totalRow);

    attachCheckboxListeners();
}

function attachCheckboxListeners() {
    document.querySelectorAll(".prime-risque-checkbox, .remboursement-checkbox").forEach(checkbox => {
        checkbox.addEventListener("change", updateTotal);
    });

    // Ajouter listener pour la checkbox "Payée"
    document.querySelectorAll(".paid-checkbox").forEach(checkbox => {
        checkbox.addEventListener("change", togglePaidStatus);
    });
}

// Fonction pour changer la couleur de la ligne quand elle est payée
function togglePaidStatus(event) {
    const checkbox = event.target;
    const row = checkbox.closest("tr");

    if (checkbox.checked) {
        row.classList.add("paid-row");
    } else {
        row.classList.remove("paid-row");
    }
}

function updateTotal(event) {
    const checkbox = event.target;
    const index = parseInt(checkbox.dataset.index);
    const week = checkbox.dataset.week;
    const row = checkbox.closest("tr");

    const primeRisqueCheckbox = row.querySelector(".prime-risque-checkbox");
    const remboursementCheckbox = row.querySelector(".remboursement-checkbox");

    const primeRisque = primeRisqueCheckbox.checked;
    const remboursementVehicule = remboursementCheckbox.checked;

    const agent = comptabiliteData[index];
    const newTotal = calculateTotal(agent, week, primeRisque, remboursementVehicule);

    const totalCell = row.querySelector(".total-value");
    totalCell.textContent = formatMoney(newTotal);

    // Recalculer la ligne de totaux
    updateTotalRow(week);
}

// Fonction pour mettre à jour la ligne de totaux
function updateTotalRow(week) {
    const tbodyId = week === "thisWeek" ? "tbody-this-week" : "tbody-last-week";
    const tbody = document.getElementById(tbodyId);
    const totalRow = tbody.querySelector(".total-row");

    if (!totalRow) return;

    let totalHours = 0;
    let totalBasePay = 0;
    let totalHourlySalary = 0;
    let totalPrimeEssence = 0;
    let grandTotal = 0;

    // Parcourir toutes les lignes sauf la ligne de totaux
    const rows = tbody.querySelectorAll("tr:not(.total-row)");
    rows.forEach((row) => {
        const index = parseInt(row.dataset.index);
        const agent = comptabiliteData[index];

        const hours = parseFloat(agent[week].hours) || 0;
        const basePay = parseFloat(agent[week].basePay) || 0;
        const hourlySalary = parseFloat(agent[week].hourlySalary) || 0;
        const primeEssence = parseFloat(agent[week].primeEssence) || 0;

        const primeRisqueCheckbox = row.querySelector(".prime-risque-checkbox");
        const remboursementCheckbox = row.querySelector(".remboursement-checkbox");

        const primeRisque = primeRisqueCheckbox ? primeRisqueCheckbox.checked : false;
        const remboursementVehicule = remboursementCheckbox ? remboursementCheckbox.checked : false;

        const rowTotal = calculateTotal(agent, week, primeRisque, remboursementVehicule);

        totalHours += hours;
        totalBasePay += basePay;
        totalHourlySalary += hourlySalary;
        totalPrimeEssence += primeEssence;
        grandTotal += rowTotal;
    });

    // Mettre à jour la ligne de totaux
    totalRow.innerHTML = `
        <td colspan="2" style="text-align: right; font-weight: bold;">TOTAL</td>
        <td style="font-weight: bold;">${totalHours.toFixed(2)} h</td>
        <td class="amount" style="font-weight: bold;">${formatMoney(totalBasePay)}</td>
        <td class="amount" style="font-weight: bold;">${formatMoney(totalHourlySalary)}</td>
        <td></td>
        <td></td>
        <td class="amount" style="font-weight: bold;">${formatMoney(totalPrimeEssence)}</td>
        <td class="total-value amount" style="font-weight: bold;">${formatMoney(grandTotal)}</td>
        <td></td>
    `;
}

function exportToExcel() {
    try {
        const wb = XLSX.utils.book_new();

        const thisWeekData = createWeekDataForExcel("thisWeek", "Semaine en cours");
        const wsThisWeek = XLSX.utils.aoa_to_sheet(thisWeekData);
        XLSX.utils.book_append_sheet(wb, wsThisWeek, "Semaine en cours");

        const lastWeekData = createWeekDataForExcel("lastWeek", "Semaine précédente");
        const wsLastWeek = XLSX.utils.aoa_to_sheet(lastWeekData);
        XLSX.utils.book_append_sheet(wb, wsLastWeek, "Semaine précédente");

        // Générer le fichier
        const today = new Date().toISOString().split("T")[0];
        const filename = `Comptabilite_Pointeuse_${today}.xlsx`;
        XLSX.writeFile(wb, filename);

        showFeedback("Export Excel réussi !", true);
    } catch (err) {
        console.error("Erreur export Excel:", err);
        showFeedback("Erreur lors de l'export Excel", false);
    }
}

function exportWeekToExcel(week, weekTitle) {
    try {
        const wb = XLSX.utils.book_new();
        const weekData = createWeekDataForExcel(week, weekTitle);
        const ws = XLSX.utils.aoa_to_sheet(weekData);
        XLSX.utils.book_append_sheet(wb, ws, weekTitle);

        function getISOWeekNumber(d) {
            const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            const dayNum = date.getUTCDay() || 7;
            date.setUTCDate(date.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
            return Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
        }

        const now = new Date();
        if (week === "lastWeek") {
            now.setDate(now.getDate() - 7);
        }
        const weekNumber = getISOWeekNumber(now);
        const filename = `LSPD_SEMAINEN°${weekNumber}.xlsx`;
        XLSX.writeFile(wb, filename);

        showFeedback(`Export ${weekTitle} réussi !`, true);
    } catch (err) {
        console.error("Erreur export Excel:", err);
        showFeedback("Erreur lors de l'export Excel", false);
    }
}

function createWeekDataForExcel(week, weekTitle) {
    const data = [];

    data.push([weekTitle]);
    data.push([]);
    data.push([
        "Nom Agent",
        "Grade",
        "Heures effectuées",
        "Paie de base (3h+)",
        "Salaire horaire (300$/h)",
        "Prime risque",
        "Remboursement véhicule",
        "Prime essence (333$/h)",
        "Total",
        "Payée"
    ]);

    let totalHours = 0;
    let totalBasePay = 0;
    let totalHourlySalary = 0;
    let totalPrimeRisque = 0;
    let totalRemboursement = 0;
    let totalPrimeEssence = 0;
    let grandTotal = 0;

    comptabiliteData.forEach((agent, index) => {
        const hours = parseFloat(agent[week].hours) || 0;
        const basePay = parseFloat(agent[week].basePay) || 0;
        const hourlySalary = parseFloat(agent[week].hourlySalary) || 0;
        const primeEssence = parseFloat(agent[week].primeEssence) || 0;

        const tbodyId = week === "thisWeek" ? "tbody-this-week" : "tbody-last-week";
        const row = document.querySelector(`#${tbodyId} tr[data-index="${index}"]`);

        let primeRisque = 0;
        let remboursementVehicule = 0;
        let isPaid = false;

        if (row) {
            const primeRisqueCheckbox = row.querySelector(".prime-risque-checkbox");
            const remboursementCheckbox = row.querySelector(".remboursement-checkbox");
            const paidCheckbox = row.querySelector(".paid-checkbox");

            primeRisque = primeRisqueCheckbox && primeRisqueCheckbox.checked ? 5000 : 0;
            remboursementVehicule = remboursementCheckbox && remboursementCheckbox.checked ? 1000 : 0;
            isPaid = paidCheckbox && paidCheckbox.checked;
        }

        const total = basePay + hourlySalary + primeEssence + primeRisque + remboursementVehicule;

        data.push([
            agent.displayName,
            agent.grade,
            parseFloat(hours.toFixed(2)),
            parseFloat(basePay.toFixed(2)),
            parseFloat(hourlySalary.toFixed(2)),
            parseFloat(primeRisque.toFixed(2)),
            parseFloat(remboursementVehicule.toFixed(2)),
            parseFloat(primeEssence.toFixed(2)),
            parseFloat(total.toFixed(2)),
            isPaid ? "Oui" : "Non"
        ]);

        // Accumuler les totaux
        totalHours += hours;
        totalBasePay += basePay;
        totalHourlySalary += hourlySalary;
        totalPrimeRisque += primeRisque;
        totalRemboursement += remboursementVehicule;
        totalPrimeEssence += primeEssence;
        grandTotal += total;
    });

    // Ajouter la ligne de totaux
    data.push([]);
    data.push([
        "TOTAL",
        "",
        parseFloat(totalHours.toFixed(2)),
        parseFloat(totalBasePay.toFixed(2)),
        parseFloat(totalHourlySalary.toFixed(2)),
        parseFloat(totalPrimeRisque.toFixed(2)),
        parseFloat(totalRemboursement.toFixed(2)),
        parseFloat(totalPrimeEssence.toFixed(2)),
        parseFloat(grandTotal.toFixed(2)),
        ""
    ]);

    return data;
}

(function () {
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

    function init() {
        const btn = document.getElementById("backlinkBtn");
        if (!btn) return;

        btn.addEventListener("click", function (e) {
            e.preventDefault();
            if (window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = "/menu-admin-salons";
            }
        });
    }
})();

document.addEventListener("DOMContentLoaded", () => {
    const exportBtn = document.getElementById("exportExcelBtn");
    if (exportBtn) {
        exportBtn.addEventListener("click", exportToExcel);
    }

    const exportThisWeekBtn = document.getElementById("exportThisWeekBtn");
    if (exportThisWeekBtn) {
        exportThisWeekBtn.addEventListener("click", () => exportWeekToExcel("thisWeek", "Semaine en cours"));
    }

    const exportLastWeekBtn = document.getElementById("exportLastWeekBtn");
    if (exportLastWeekBtn) {
        exportLastWeekBtn.addEventListener("click", () => exportWeekToExcel("lastWeek", "Semaine précédente"));
    }

    loadComptabilite();
});
