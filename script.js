// --- START OF FILE script.js ---

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(err => {
        console.log('ServiceWorker registration failed: ', err);
      });
  });
} else {
    console.log('Service Workers not supported by this browser.');
}
// --- End of Service Worker Registration ---


// --- Application Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // --- Get DOM Elements ---
    const plotNumberSelect = document.getElementById('plotNumberSelect');
    const dbhSelect = document.getElementById('dbhSelect');
    const speciesSelect = document.getElementById('speciesSelect');
    const logsSelect = document.getElementById('logsSelect');
    const cutCheckbox = document.getElementById('cutCheckbox');
    const submitBtn = document.getElementById('submitBtn');
    const saveCsvBtn = document.getElementById('saveCsvBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const entriesList = document.getElementById('entriesList');
    const entryCountSpan = document.getElementById('entryCount');
    const noEntriesMsg = document.getElementById('noEntriesMsg');

    // --- Data Storage ---
    let collectedData = []; // Array to hold submitted entry objects
    const STORAGE_KEY = 'treeDataTempSession'; // Key for localStorage

    // --- Function to save current data to localStorage ---
    function saveSessionData() {
        try {
            // Only save if there's actually data to prevent empty saves overwriting
            if (collectedData.length > 0) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(collectedData));
                console.log('[Session] Data saved to localStorage.');
            } else {
                // If collectedData is empty, clear any lingering temp data
                localStorage.removeItem(STORAGE_KEY);
                console.log('[Session] Data empty, cleared localStorage.');
            }
        } catch (e) {
            console.error('[Session] Error saving data to localStorage:', e);
            // Handle potential storage full errors or other issues
        }
    }

    // --- Function to load data from localStorage and prompt user ---
    function loadAndPromptSessionData() {
        try {
            const savedDataJSON = localStorage.getItem(STORAGE_KEY);
            if (savedDataJSON) {
                const recoveredData = JSON.parse(savedDataJSON);
                // Check if there's actually data in the recovered array
                if (Array.isArray(recoveredData) && recoveredData.length > 0) {
                    // Prompt the user
                    if (confirm(`Recover ${recoveredData.length} entries from the last session?`)) {
                        collectedData = recoveredData; // Restore the data
                        console.log('[Session] Data recovered from localStorage.');
                        // Optional: Clear storage after successful recovery if you don't
                        // want to be prompted again on the *next* refresh without new changes.
                        // localStorage.removeItem(STORAGE_KEY);
                    } else {
                        // User chose not to recover, clear the stored data
                        localStorage.removeItem(STORAGE_KEY);
                        console.log('[Session] User declined recovery. Cleared localStorage.');
                    }
                } else {
                    // If storage contained empty array or invalid data, clear it
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (e) {
            console.error('[Session] Error loading or parsing data from localStorage:', e);
            // Clear potentially corrupted data
            localStorage.removeItem(STORAGE_KEY);
        }
        // Always render, either with recovered data or empty state
        renderEntries();
    }

    // --- Populate Dropdowns ---
    function populatePlotNumberOptions() {
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
        const logValues = ["0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "Cull"];
        logValues.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            logsSelect.appendChild(option);
        });
    }

    // --- Render Entries List ---
    function renderEntries() {
        entriesList.innerHTML = '';
        entryCountSpan.textContent = collectedData.length;

        if (collectedData.length === 0) {
            let placeholder = document.getElementById('noEntriesMsg');
            if (!placeholder) {
                placeholder = document.createElement('li');
                placeholder.id = 'noEntriesMsg';
                placeholder.textContent = 'No data submitted yet.';
                 placeholder.style.fontStyle = 'italic';
                 placeholder.style.color = '#6c757d';
                 placeholder.style.textAlign = 'center';
                 placeholder.style.border = 'none';
                 placeholder.style.backgroundColor = 'transparent';
            }
            entriesList.innerHTML = '';
            entriesList.appendChild(placeholder);
            saveCsvBtn.disabled = true;
            deleteBtn.disabled = true;
        } else {
             const placeholder = document.getElementById('noEntriesMsg');
             if (placeholder) {
                 placeholder.remove();
             }
            for (let i = collectedData.length - 1; i >= 0; i--) {
                const entry = collectedData[i];
                const listItem = document.createElement('li');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = entry.id;
                checkbox.setAttribute('data-id', entry.id);

                const textNode = document.createTextNode(
                    ` Plot: ${entry.plotNumber}, DBH: ${entry.dbh}, Species: ${entry.species}, Logs: ${entry.logs}, Cut: ${entry.cutStatus}`
                );

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
            plotNumber: plotNumberSelect.value,
            dbh: dbhSelect.value,
            species: speciesSelect.value,
            logs: logsSelect.value,
            cutStatus: cutCheckbox.checked ? 'Yes' : 'No'
        };

        collectedData.push(newEntry);
        renderEntries();
        saveSessionData(); // <-- Save data after adding

        cutCheckbox.checked = false; // Optional: Reset checkbox

        console.log("Entry Added:", newEntry);
    });

    // --- Save CSV Button Handler ---
    saveCsvBtn.addEventListener('click', () => {
        if (collectedData.length === 0) {
            alert("No data to save.");
            return;
        }

        let csvContent = "PlotNumber,DBH,Species,Logs,Cut\n";
        collectedData.forEach(entry => {
            csvContent += `${entry.plotNumber},${entry.dbh},${entry.species},${entry.logs},${entry.cutStatus}\n`;
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

        // --- Clear temporary data after successful save ---
        try {
            localStorage.removeItem(STORAGE_KEY);
            console.log('[Session] CSV saved. Cleared localStorage.');
        } catch (e) {
            console.error('[Session] Error clearing localStorage after save:', e);
        }
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
        saveSessionData(); // <-- Save data after deleting

        console.log("Entries deleted. Remaining data:", collectedData);
    });

     // --- Enable/Disable Delete Button Based on Checkbox Clicks ---
     entriesList.addEventListener('change', (event) => {
         if (event.target.type === 'checkbox') {
             deleteBtn.disabled = !isAnyCheckboxChecked();
         }
     });

    // --- Initial Setup ---
    populatePlotNumberOptions();
    populateDbhOptions();
    populateLogsOptions();

    // --- Load session data and render ---
    loadAndPromptSessionData(); // <-- Check for saved data *before* initial render

    // Optional: Add a fallback save just before the page unloads
    // Note: This is less reliable than saving on action, especially on mobile.
    // window.addEventListener('beforeunload', saveSessionData);

});

// --- END OF FILE script.js ---
