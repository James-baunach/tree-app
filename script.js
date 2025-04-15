document.addEventListener('DOMContentLoaded', () => {
    // --- Get DOM Elements ---
    const plotNumberSelect = document.getElementById('plotNumberSelect'); // Added
    const dbhSelect = document.getElementById('dbhSelect');
    const speciesSelect = document.getElementById('speciesSelect');
    const logsSelect = document.getElementById('logsSelect');
    const submitBtn = document.getElementById('submitBtn');
    const saveCsvBtn = document.getElementById('saveCsvBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const entriesList = document.getElementById('entriesList');
    const entryCountSpan = document.getElementById('entryCount');
    const noEntriesMsg = document.getElementById('noEntriesMsg');

    // --- Data Storage ---
    let collectedData = []; // Array to hold submitted entry objects

    // --- Populate Dropdowns ---
    function populatePlotNumberOptions() { // Added function
        for (let i = 1; i <= 20; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            plotNumberSelect.appendChild(option);
        }
    }

    function populateDbhOptions() {
        for (let i = 4; i <= 40; i += 2) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = i;
            dbhSelect.appendChild(option);
        }
    }

    function populateLogsOptions() {
        const logValues = ["0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5"];
        logValues.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            logsSelect.appendChild(option);
        });
    }

    // --- Render Entries List ---
    function renderEntries() {
        entriesList.innerHTML = ''; // Clear current list
        entryCountSpan.textContent = collectedData.length;

        if (collectedData.length === 0) {
            entriesList.appendChild(noEntriesMsg);
            saveCsvBtn.disabled = true;
            deleteBtn.disabled = true;
        } else {
            for (let i = collectedData.length - 1; i >= 0; i--) {
                const entry = collectedData[i];
                const listItem = document.createElement('li');

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = entry.id;
                checkbox.setAttribute('data-id', entry.id);

                // --- MODIFICATION: Added Plot Number to display text ---
                const textNode = document.createTextNode(` Plot: ${entry.plotNumber}, DBH: ${entry.dbh}, Species: ${entry.species}, Logs: ${entry.logs}`);

                listItem.appendChild(checkbox);
                listItem.appendChild(textNode);
                entriesList.appendChild(listItem);
            }
            saveCsvBtn.disabled = false;
            deleteBtn.disabled = !isAnyCheckboxChecked();
        }
    }

    // --- Check if any checkbox is checked ---
    function isAnyCheckboxChecked() {
        const checkboxes = entriesList.querySelectorAll('input[type="checkbox"]');
        for (let checkbox of checkboxes) {
            if (checkbox.checked) {
                return true;
            }
        }
        return false;
    }

    // --- Submit Button Handler ---
    submitBtn.addEventListener('click', () => {
        const newEntry = {
            id: Date.now(),
            plotNumber: plotNumberSelect.value, // Added plot number
            dbh: dbhSelect.value,
            species: speciesSelect.value,
            logs: logsSelect.value
        };

        collectedData.push(newEntry);
        renderEntries();

        console.log("Entry Added:", newEntry);
        console.log("Collected Data:", collectedData);
    });

    // --- Save CSV Button Handler ---
    saveCsvBtn.addEventListener('click', () => {
        if (collectedData.length === 0) {
            alert("No data to save.");
            return;
        }

        // --- MODIFICATION: Added Plot Number to CSV Header ---
        let csvContent = "PlotNumber,DBH,Species,Logs\n"; // Updated CSV Header

        collectedData.forEach(entry => {
            // --- MODIFICATION: Added Plot Number to CSV row ---
            csvContent += `${entry.plotNumber},${entry.dbh},${entry.species},${entry.logs}\n`;
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, "");
        link.setAttribute("href", url);
        link.setAttribute("download", `TreeData_${timestamp}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });

    // --- Delete Button Handler ---
    deleteBtn.addEventListener('click', () => {
        const checkboxes = entriesList.querySelectorAll('input[type="checkbox"]:checked');
        const idsToDelete = new Set();

        checkboxes.forEach(cb => {
            const id = parseInt(cb.getAttribute('data-id'), 10);
            if (!isNaN(id)) {
                 idsToDelete.add(id);
            }
        });

        if (idsToDelete.size === 0) {
            alert("No entries selected for deletion.");
            return;
        }

        collectedData = collectedData.filter(entry => !idsToDelete.has(entry.id));
        renderEntries();
        console.log("Entries deleted. Remaining data:", collectedData);
    });

     // --- Enable/Disable Delete Button Based on Checkbox Clicks ---
     entriesList.addEventListener('change', (event) => {
         if (event.target.type === 'checkbox') {
             deleteBtn.disabled = !isAnyCheckboxChecked();
         }
     });

    // --- Initial Setup ---
    populatePlotNumberOptions(); // Added call
    populateDbhOptions();
    populateLogsOptions();
    renderEntries(); // Initial render
});