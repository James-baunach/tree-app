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
    const dbhSelect = document.getElementById('dbhSelect');
    const speciesSelect = document.getElementById('speciesSelect');
    const logsSelect = document.getElementById('logsSelect'); // Ensure this ID matches your HTML
    const cutCheckbox = document.getElementById('cutCheckbox');
    const notesTextarea = document.getElementById('notesTextarea');
    const getLocationBtn = document.getElementById('getLocationBtn');
    const locationStatus = document.getElementById('locationStatus');
    const submitBtn = document.getElementById('submitBtn');
    const saveCsvBtn = document.getElementById('saveCsvBtn');
    const shareBtn = document.getElementById('shareBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const entriesList = document.getElementById('entriesList');
    const entryCountSpan = document.getElementById('entryCount');
    const noEntriesMsg = document.getElementById('noEntriesMsg');
    const feedbackMsg = document.getElementById('feedbackMsg');

    // --- Plot Counter Elements ---
    const plotDecrementBtn = document.getElementById('plotDecrementBtn');
    const plotIncrementBtn = document.getElementById('plotIncrementBtn');
    const plotNumberDisplay = document.getElementById('plotNumberDisplay');

    // --- View Switching Elements ---
    const entryView = document.getElementById('entryView');
    const tallyView = document.getElementById('tallyView');
    const viewTallyBtn = document.getElementById('viewTallyBtn');
    const backToEntryBtn = document.getElementById('backToEntryBtn');
    const tallyResultsContainer = document.getElementById('tallyResults');

    // --- Data Storage ---
    let collectedData = [];
    const STORAGE_KEY = 'treeDataTempSession';
    let currentLocation = null;
    let feedbackTimeout = null;

    // --- Plot Counter State ---
    let currentPlotNumber = 1;
    const MIN_PLOT_NUMBER = 1;
    const MAX_PLOT_NUMBER = 99;

    // --- Function to save current data to localStorage ---
    function saveSessionData() {
        try {
            if (collectedData.length > 0) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(collectedData));
            } else {
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch (e) {
            console.error('[Session] Error saving data to localStorage:', e);
        }
    }

    // --- Function to load data from localStorage and prompt user ---
    function loadAndPromptSessionData() {
        try {
            const savedDataJSON = localStorage.getItem(STORAGE_KEY);
            if (savedDataJSON) {
                const recoveredData = JSON.parse(savedDataJSON);
                if (Array.isArray(recoveredData) && recoveredData.length > 0) {
                     if (recoveredData[recoveredData.length - 1]?.plotNumber) {
                        let lastPlot = parseInt(recoveredData[recoveredData.length - 1].plotNumber, 10);
                        if (!isNaN(lastPlot) && lastPlot >= MIN_PLOT_NUMBER && lastPlot <= MAX_PLOT_NUMBER) {
                            currentPlotNumber = lastPlot;
                        }
                    }
                    if (confirm(`Recover ${recoveredData.length} entr${recoveredData.length === 1 ? 'y' : 'ies'} from the last session? (Last plot was ${currentPlotNumber})`)) {
                        collectedData = recoveredData;
                        console.log('[Session] Data recovered from localStorage.');
                    } else {
                        localStorage.removeItem(STORAGE_KEY);
                        console.log('[Session] User declined recovery. Cleared localStorage.');
                    }
                } else {
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (e) {
            console.error('[Session] Error loading or parsing data from localStorage:', e);
            localStorage.removeItem(STORAGE_KEY);
        }
        updatePlotDisplay(); // Set plot display based on loaded/default data
        renderEntries(); // Render list based on loaded/empty data
    }

    // --- Populate Dropdowns ---
    function populateDbhOptions() {
        // Store current value *before* clearing if needed for complex persistence (not strictly needed here)
        // const currentVal = dbhSelect.value;
        dbhSelect.innerHTML = ''; // Clear existing options first
        console.log("Populating DBH options..."); // Debug log
        for (let i = 4; i <= 40; i += 2) {
            const option = document.createElement('option');
            option.value = String(i); // Ensure value is string
            option.textContent = String(i);
            dbhSelect.appendChild(option);
        }
        // Set default selection (e.g., first item) if no prior value restored
         if (dbhSelect.options.length > 0) {
             dbhSelect.selectedIndex = 0; // Default to the first option (4)
         }
         console.log("DBH options populated. Current value:", dbhSelect.value); // Debug log
    }

    function populateLogsOptions() {
        // const currentVal = logsSelect.value; // Store before clearing if needed
        logsSelect.innerHTML = ''; // Clear existing options first
        console.log("Populating Logs options..."); // Debug log
        const logValues = ["0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "Cull"];
        logValues.forEach(value => {
            const option = document.createElement('option');
            option.value = value; // Values are already strings
            option.textContent = value;
            logsSelect.appendChild(option);
        });
         // Set default selection (e.g., first item '0')
        if (logsSelect.options.length > 0) {
             logsSelect.selectedIndex = 0; // Default to '0'
        }
        console.log("Logs options populated. Current value:", logsSelect.value); // Debug log
    }

    // --- Logic to set Logs based on DBH ---
    function checkAndSetLogsForDbh() {
        // Ensure elements exist before proceeding
        if (!dbhSelect || !logsSelect) {
            console.error("Cannot check Logs for DBH: Select elements not found.");
            return;
        }
        const selectedDbh = dbhSelect.value;
        const dbhValuesToResetLogs = ['4', '6', '8', '10']; // Compare against string values
        const zeroLogOption = logsSelect.querySelector('option[value="0"]');

        if (dbhValuesToResetLogs.includes(selectedDbh)) {
            if (zeroLogOption) {
                 // Check if the value is already '0' to avoid unnecessary logging/updates
                 if (logsSelect.value !== '0') {
                    logsSelect.value = '0';
                    console.log(`DBH is ${selectedDbh}. Logs forced to 0.`); // Log the change
                 }
            } else {
                 console.warn("Could not find '0' option in Logs dropdown to set.");
            }
        }
        // No 'else' needed - if DBH is not in the list, we don't force Logs to 0
    }


     // --- Plot Counter Logic ---
    function updatePlotDisplay() {
        plotNumberDisplay.textContent = currentPlotNumber;
        plotDecrementBtn.disabled = currentPlotNumber <= MIN_PLOT_NUMBER;
        plotIncrementBtn.disabled = currentPlotNumber >= MAX_PLOT_NUMBER;
    }
    plotDecrementBtn.addEventListener('click', () => { if (currentPlotNumber > MIN_PLOT_NUMBER) { currentPlotNumber--; updatePlotDisplay(); } });
    plotIncrementBtn.addEventListener('click', () => { if (currentPlotNumber < MAX_PLOT_NUMBER) { currentPlotNumber++; updatePlotDisplay(); } });

    // --- Render Entries List (Condensed View) ---
    function renderEntries() {
        entriesList.innerHTML = ''; entryCountSpan.textContent = collectedData.length; const hasData = collectedData.length > 0;
        if (!hasData) { let placeholder = document.getElementById('noEntriesMsg'); if (!placeholder) { placeholder = document.createElement('li'); placeholder.id = 'noEntriesMsg'; placeholder.textContent = 'No data submitted yet.'; Object.assign(placeholder.style, { fontStyle: 'italic', color: '#6c757d', textAlign: 'center', border: 'none', backgroundColor: 'transparent' }); entriesList.appendChild(placeholder); } else if (!entriesList.contains(placeholder)) { entriesList.appendChild(placeholder); } }
        else { const placeholder = document.getElementById('noEntriesMsg'); if (placeholder) placeholder.remove();
            for (let i = collectedData.length - 1; i >= 0; i--) { const entry = collectedData[i]; const listItem = document.createElement('li'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = entry.id; checkbox.setAttribute('data-id', entry.id); listItem.appendChild(checkbox); const detailsDiv = document.createElement('div'); detailsDiv.classList.add('entry-details'); const addDetail = (label, value) => { if (value !== undefined && value !== null) { const div = document.createElement('div'); const labelSpan = document.createElement('span'); labelSpan.classList.add('detail-label'); labelSpan.textContent = `${label}: `; const valueSpan = document.createElement('span'); valueSpan.classList.add('detail-value'); valueSpan.textContent = value; div.appendChild(labelSpan); div.appendChild(valueSpan); detailsDiv.appendChild(div); } }; addDetail('Plot', entry.plotNumber); addDetail('DBH', entry.dbh); addDetail('Species', entry.species); addDetail('Logs', entry.logs); listItem.appendChild(detailsDiv); entriesList.appendChild(listItem); } }
        saveCsvBtn.disabled = !hasData; shareBtn.disabled = !hasData; viewTallyBtn.disabled = !hasData; deleteBtn.disabled = !isAnyCheckboxChecked();
    }

    // --- Check if any checkbox is checked ---
    function isAnyCheckboxChecked() { return entriesList.querySelector('input[type="checkbox"]:checked') !== null; }

    // --- Show Visual Feedback ---
    function showFeedback(message, duration = 2500) {
        if (feedbackTimeout) clearTimeout(feedbackTimeout); feedbackMsg.textContent = message; feedbackMsg.style.display = 'block'; feedbackMsg.style.opacity = 1; feedbackTimeout = setTimeout(() => { feedbackMsg.style.opacity = 0; setTimeout(() => { feedbackMsg.style.display = 'none'; }, 500); feedbackTimeout = null; }, duration);
    }

    // --- Get Location Handler ---
    getLocationBtn.addEventListener('click', () => { if (!('geolocation' in navigator)) { locationStatus.textContent = 'Geolocation not supported'; locationStatus.style.color = 'red'; locationStatus.title = 'Geolocation not supported by this browser.'; return; } locationStatus.textContent = 'Fetching...'; locationStatus.title = 'Attempting to get GPS coordinates...'; locationStatus.style.color = '#555'; getLocationBtn.disabled = true; navigator.geolocation.getCurrentPosition( (position) => { currentLocation = { lat: position.coords.latitude, lon: position.coords.longitude }; const displayCoords = `(${currentLocation.lat.toFixed(4)}, ${currentLocation.lon.toFixed(4)})`; locationStatus.textContent = `Location Set ${displayCoords}`; locationStatus.title = `Location Set: Latitude ${currentLocation.lat}, Longitude ${currentLocation.lon}`; locationStatus.style.color = 'green'; getLocationBtn.disabled = false; }, (error) => { currentLocation = null; let errorMsg = 'Error: '; let errorTitle = 'Error fetching location: '; switch (error.code) { case error.PERMISSION_DENIED: errorMsg += 'Denied'; errorTitle += 'Permission denied.'; break; case error.POSITION_UNAVAILABLE: errorMsg += 'Unavailable'; errorTitle += 'Position unavailable.'; break; case error.TIMEOUT: errorMsg += 'Timeout'; errorTitle += 'Request timed out.'; break; default: errorMsg += 'Unknown'; errorTitle += 'Unknown error.'; break; } locationStatus.textContent = errorMsg; locationStatus.title = errorTitle; locationStatus.style.color = 'red'; getLocationBtn.disabled = false; console.error(errorTitle, error); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }); });

    // --- Submit Button Handler ---
    submitBtn.addEventListener('click', () => { checkAndSetLogsForDbh(); const newEntry = { id: Date.now(), plotNumber: currentPlotNumber, dbh: dbhSelect.value, species: speciesSelect.value, logs: logsSelect.value, cutStatus: cutCheckbox.checked ? 'Yes' : 'No', notes: notesTextarea.value.trim(), location: currentLocation }; collectedData.push(newEntry); renderEntries(); saveSessionData(); showFeedback("Entry Added!"); cutCheckbox.checked = false; notesTextarea.value = ''; currentLocation = null; locationStatus.textContent = 'Location not set'; locationStatus.title = 'GPS Status'; locationStatus.style.color = '#555'; speciesSelect.focus(); });

    // --- Tally Logic ---
    function generateTallyData() { const tally = {}; collectedData.forEach(entry => { const { species, dbh, logs } = entry; if (!species || !dbh || !logs) return; if (!tally[species]) tally[species] = {}; if (!tally[species][dbh]) tally[species][dbh] = {}; if (!tally[species][dbh][logs]) tally[species][dbh][logs] = 0; tally[species][dbh][logs]++; }); return tally; }
    function displayTallyResults(tallyData) { tallyResultsContainer.innerHTML = ''; const speciesKeys = Object.keys(tallyData).sort(); if (speciesKeys.length === 0) { const p = document.createElement('p'); p.textContent = 'No data available to tally.'; p.classList.add('no-tally-data'); tallyResultsContainer.appendChild(p); return; } speciesKeys.forEach(species => { const speciesDiv = document.createElement('div'); speciesDiv.classList.add('tally-species'); const speciesHeading = document.createElement('h3'); speciesHeading.textContent = species; speciesDiv.appendChild(speciesHeading); const dbhKeys = Object.keys(tallyData[species]).sort((a, b) => Number(a) - Number(b)); dbhKeys.forEach(dbh => { const dbhHeading = document.createElement('h4'); dbhHeading.textContent = `DBH: ${dbh}`; speciesDiv.appendChild(dbhHeading); const logKeys = Object.keys(tallyData[species][dbh]).sort((a, b) => { if (a === 'Cull') return 1; if (b === 'Cull') return -1; return Number(a) - Number(b); }); logKeys.forEach(logs => { const count = tallyData[species][dbh][logs]; const logItemDiv = document.createElement('div'); logItemDiv.classList.add('tally-log-item'); const labelSpan = document.createElement('span'); labelSpan.classList.add('log-label'); labelSpan.textContent = `Logs: ${logs} - `; const countSpan = document.createElement('span'); countSpan.classList.add('log-count'); countSpan.textContent = `Count: ${count}`; logItemDiv.appendChild(labelSpan); logItemDiv.appendChild(countSpan); speciesDiv.appendChild(logItemDiv); }); }); tallyResultsContainer.appendChild(speciesDiv); }); }

    // --- Save CSV Button Handler ---
    saveCsvBtn.addEventListener('click', () => { if (collectedData.length === 0) { alert("No data to save."); return; } let rawCsvContent = "PlotNumber,DBH,Species,Logs,Cut,Notes,Latitude,Longitude\n"; collectedData.forEach(entry => { const notesSanitized = `"${(entry.notes || '').replace(/"/g, '""')}"`; const lat = entry.location ? entry.location.lat : ''; const lon = entry.location ? entry.location.lon : ''; const cut = entry.cutStatus || 'No'; rawCsvContent += `${entry.plotNumber},${entry.dbh},${entry.species},${entry.logs},${cut},${notesSanitized},${lat},${lon}\n`; }); const tallyData = generateTallyData(); let tallyCsvContent = "\n\n--- TALLY DATA ---\n"; tallyCsvContent += "Species,DBH,Logs,Count\n"; const speciesKeys = Object.keys(tallyData).sort(); speciesKeys.forEach(species => { const dbhKeys = Object.keys(tallyData[species]).sort((a, b) => Number(a) - Number(b)); dbhKeys.forEach(dbh => { const logKeys = Object.keys(tallyData[species][dbh]).sort((a, b) => { if (a === 'Cull') return 1; if (b === 'Cull') return -1; return Number(a) - Number(b); }); logKeys.forEach(logs => { const count = tallyData[species][dbh][logs]; tallyCsvContent += `${species},${dbh},${logs},${count}\n`; }); }); }); const combinedCsvContent = rawCsvContent + tallyCsvContent; const blob = new Blob([combinedCsvContent], { type: 'text/csv;charset=utf-8;' }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, ""); link.setAttribute("href", url); link.setAttribute("download", `TreeData_WithTally_${timestamp}.csv`); link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url); showFeedback("CSV File with Tally Saved!"); try { localStorage.removeItem(STORAGE_KEY); console.log('[Session] CSV saved. Cleared localStorage.'); } catch (e) { console.error('[Session] Error clearing localStorage after save:', e); } });

    // --- Share Button Handler ---
    shareBtn.addEventListener('click', async () => { if (collectedData.length === 0) { alert("No data to share."); return; } let shareText = "Tree Data Entries:\n------------------\n"; collectedData.forEach(entry => { shareText += `Plot: ${entry.plotNumber}, DBH: ${entry.dbh}, Species: ${entry.species}, Logs: ${entry.logs}\n`; }); if (navigator.share) { try { await navigator.share({ title: 'Collected Tree Data', text: shareText }); showFeedback("Data Shared!"); } catch (err) { console.error('Error sharing data:', err); if (err.name !== 'AbortError') showFeedback("Error sharing data.", 3000); } } else { try { await navigator.clipboard.writeText(shareText); alert('Web Share not supported. Data copied to clipboard!'); } catch (err) { alert('Web Share not supported, and clipboard copy failed. Use "Save CSV File" instead.'); } } });

    // --- Delete Button Handler ---
    deleteBtn.addEventListener('click', () => { const checkboxes = entriesList.querySelectorAll('input[type="checkbox"]:checked'); const idsToDelete = new Set(); checkboxes.forEach(cb => { const id = parseInt(cb.getAttribute('data-id'), 10); if (!isNaN(id)) idsToDelete.add(id); }); if (idsToDelete.size === 0) { alert("No entries selected for deletion."); return; } const numToDelete = idsToDelete.size; if (!confirm(`Are you sure you want to delete ${numToDelete} selected entr${numToDelete === 1 ? 'y' : 'ies'}?`)) return; collectedData = collectedData.filter(entry => !idsToDelete.has(entry.id)); renderEntries(); saveSessionData(); showFeedback(`${numToDelete} entr${numToDelete === 1 ? 'y' : 'ies'} deleted.`); });

    // --- Enable/Disable Delete Button Based on Checkbox Clicks ---
    entriesList.addEventListener('change', (event) => { if (event.target.type === 'checkbox') deleteBtn.disabled = !isAnyCheckboxChecked(); });

    // --- View Switching Logic ---
    viewTallyBtn.addEventListener('click', () => { const tallyData = generateTallyData(); displayTallyResults(tallyData); entryView.style.display = 'none'; tallyView.style.display = 'block'; });
    backToEntryBtn.addEventListener('click', () => { tallyView.style.display = 'none'; entryView.style.display = 'block'; });


    // --- Initial Setup ---
    console.log("Initializing dropdowns..."); // Debug log
    populateDbhOptions();       // Populate DBH first
    populateLogsOptions();      // Populate Logs second

    // Add event listener AFTER dropdowns are populated
    dbhSelect.addEventListener('change', checkAndSetLogsForDbh);

    // Set initial Logs state based on initial DBH value AFTER population
    checkAndSetLogsForDbh();
    console.log("Dropdowns initialized and initial log check performed."); // Debug log

    // Load any saved session data (which also calls renderEntries and updatePlotDisplay)
    loadAndPromptSessionData();

});

// --- END OF FILE script.js ---
