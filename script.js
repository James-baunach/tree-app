// --- START OF FILE script.js ---

// ... (keep existing service worker registration) ...

// --- Application Logic ---
document.addEventListener('DOMContentLoaded', () => {

    // --- Get DOM Elements ---
    const dbhSelect = document.getElementById('dbhSelect');
    const speciesSelect = document.getElementById('speciesSelect');
    const logsSelect = document.getElementById('logsSelect');
    const cutCheckbox = document.getElementById('cutCheckbox');
    const notesTextarea = document.getElementById('notesTextarea');
    const getLocationBtn = document.getElementById('getLocationBtn');
    const locationStatus = document.getElementById('locationStatus');
    const submitBtn = document.getElementById('submitBtn');
    const saveCsvBtn = document.getElementById('saveCsvBtn');
    const deleteBtn = document.getElementById('deleteBtn');
    const deleteAllBtn = document.getElementById('deleteAllBtn'); // *** ADDED ***
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

    // *** ADDED: Forestry Calculation Constant ***
    const BAF = 10; // Basal Area Factor (sq ft/acre/tree)

    // --- Function to save current data to localStorage ---
    function saveSessionData() {
        try {
            if (collectedData.length > 0) {
                localStorage.setItem(STORAGE_KEY, JSON.stringify(collectedData));
            } else {
                localStorage.removeItem(STORAGE_KEY); // Ensure removal if data becomes empty
            }
        } catch (e) {
            console.error('[Session] Error saving data to localStorage:', e);
        }
    }

    // --- Function to load data from localStorage and prompt user ---
    function loadAndPromptSessionData() {
        // ... (keep existing loadAndPromptSessionData function body) ...
        updatePlotDisplay(); // Keep this call
        renderEntries(); // Keep this call
    }

    // --- Populate Dropdowns ---
    // ... (keep existing populateDbhOptions and populateLogsOptions) ...

    // --- Logic to set Logs based on DBH ---
    // ... (keep existing checkAndSetLogsForDbh) ...

    // --- Plot Counter Logic ---
    // ... (keep existing updatePlotDisplay and plot counter event listeners) ...

    // --- Render Entries List (Condensed View) ---
    function renderEntries() {
        entriesList.innerHTML = ''; // Clear current list
        entryCountSpan.textContent = collectedData.length;
        const hasData = collectedData.length > 0;

        const placeholder = document.getElementById('noEntriesMsg');
        if (!hasData) {
             if (!placeholder) {
                const newPlaceholder = document.createElement('li');
                newPlaceholder.id = 'noEntriesMsg';
                newPlaceholder.textContent = 'No data submitted yet.';
                Object.assign(newPlaceholder.style, { fontStyle: 'italic', color: '#6c757d', textAlign: 'center', border: 'none', backgroundColor: 'transparent', padding: '8px', margin: '0' });
                entriesList.appendChild(newPlaceholder);
            } else if (!entriesList.contains(placeholder)) {
                entriesList.appendChild(placeholder);
            }
        } else {
             if (placeholder) placeholder.remove();

            // ... (keep the loop to create list items) ...
             for (let i = collectedData.length - 1; i >= 0; i--) {
                const entry = collectedData[i];
                const listItem = document.createElement('li');

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = entry.id;
                checkbox.setAttribute('data-id', entry.id);
                listItem.appendChild(checkbox);

                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('entry-details');

                const addDetail = (label, value) => {
                    if (value !== undefined && value !== null && value !== '') {
                        const div = document.createElement('div');
                        const labelSpan = document.createElement('span');
                        labelSpan.classList.add('detail-label');
                        labelSpan.textContent = `${label}: `;
                        const valueSpan = document.createElement('span');
                        valueSpan.classList.add('detail-value');
                        valueSpan.textContent = value;
                        div.appendChild(labelSpan);
                        div.appendChild(valueSpan);
                        detailsDiv.appendChild(div);
                    }
                };

                addDetail('Plot', entry.plotNumber);
                addDetail('DBH', entry.dbh);
                addDetail('Species', entry.species);
                addDetail('Logs', entry.logs);
                 // Optional: Add Cut status or Notes snippet if desired in the list
                 // addDetail('Cut', entry.cutStatus);
                 // addDetail('Notes', entry.notes ? entry.notes.substring(0, 20) + (entry.notes.length > 20 ? '...' : '') : '');


                listItem.appendChild(detailsDiv);
                entriesList.appendChild(listItem);
            }
        }

        // Update button states
        saveCsvBtn.disabled = !hasData;
        viewTallyBtn.disabled = !hasData;
        deleteAllBtn.disabled = !hasData; // *** ADDED disable logic ***
        deleteBtn.disabled = !isAnyCheckboxChecked(); // Keep this check separate

    }

    // --- Check if any checkbox is checked ---
    // ... (keep existing isAnyCheckboxChecked) ...

    // --- Show Visual Feedback ---
    // ... (keep existing showFeedback) ...

    // --- Get Location Handler ---
    // ... (keep existing getLocationBtn listener) ...

    // --- Submit Button Handler ---
    // ... (keep existing submitBtn listener) ...

    // --- Tally Logic ---
    // ... (keep existing generateTallyData, displayTallyResults, calculateForestryStats) ...

    // --- Save CSV Button Handler ---
    // ... (keep existing saveCsvBtn listener, remember it clears data) ...

    // --- Delete Button Handler ---
    // ... (keep existing deleteBtn listener) ...

    // *** ADDED: Delete All Button Handler ***
    deleteAllBtn.addEventListener('click', () => {
        if (collectedData.length === 0) {
            showFeedback("No data to delete.", true);
            return; // Should be disabled anyway, but good practice
        }

        // Use a more prominent confirmation!
        if (!confirm('WARNING: This will delete ALL collected data permanently. This action cannot be undone. Are you absolutely sure?')) {
            return; // User cancelled
        }

        // Proceed with deletion
        collectedData = []; // Clear the in-memory array
        try {
            localStorage.removeItem(STORAGE_KEY); // Clear the persisted session data
            console.log('[Session] All data cleared by user.');
        } catch (e) {
            console.error('[Session] Error clearing localStorage during Delete All:', e);
        }

        renderEntries(); // Update the UI (will show "No data..." and disable buttons)
        showFeedback('All data has been deleted.');

        // Optional: Reset location status as well, if desired after clearing all
        currentLocation = null;
        locationStatus.textContent = 'Location not set';
        locationStatus.title = 'GPS Status';
        locationStatus.style.color = '#555';
    });
    // *** END Delete All Button Handler ***


    // --- Enable/Disable Delete Button Based on Checkbox Clicks ---
    // ... (keep existing entriesList listener for 'change') ...

    // --- View Switching Logic ---
    // ... (keep existing viewTallyBtn and backToEntryBtn listeners) ...

    // --- Initial Setup ---
    console.log("Initializing application...");
    populateDbhOptions();
    populateLogsOptions();
    dbhSelect.addEventListener('change', checkAndSetLogsForDbh);
    checkAndSetLogsForDbh();
    console.log("Dropdowns initialized and initial log check performed.");
    loadAndPromptSessionData(); // This now calls renderEntries which handles initial button states
    console.log("Application initialization complete.");
});

// --- END OF FILE script.js ---
