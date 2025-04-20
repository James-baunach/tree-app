
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
    const logsSelect = document.getElementById('logsSelect');
    const cutCheckbox = document.getElementById('cutCheckbox');
    const notesTextarea = document.getElementById('notesTextarea');
    const getLocationBtn = document.getElementById('getLocationBtn');
    const locationStatus = document.getElementById('locationStatus');
    const submitBtn = document.getElementById('submitBtn');
    const saveCsvBtn = document.getElementById('saveCsvBtn');
    // const shareBtn = document.getElementById('shareBtn'); // REMOVED
    const deleteBtn = document.getElementById('deleteBtn');
    const entriesList = document.getElementById('entriesList');
    const entryCountSpan = document.getElementById('entryCount');
    const noEntriesMsg = document.getElementById('noEntriesMsg'); // Keep reference if needed later
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
                // Remove key if no data to save to prevent loading empty array later
                localStorage.removeItem(STORAGE_KEY);
            }
        } catch (e) {
            console.error('[Session] Error saving data to localStorage:', e);
            // Consider showing a user-facing error message here if critical
        }
    }

    // --- Function to load data from localStorage and prompt user ---
    function loadAndPromptSessionData() {
        try {
            const savedDataJSON = localStorage.getItem(STORAGE_KEY);
            if (savedDataJSON) {
                const recoveredData = JSON.parse(savedDataJSON);

                // Basic validation: Ensure it's an array and not empty
                if (Array.isArray(recoveredData) && recoveredData.length > 0) {

                    // Attempt to restore the last plot number
                    const lastEntry = recoveredData[recoveredData.length - 1];
                    if (lastEntry?.plotNumber) {
                        const lastPlot = parseInt(lastEntry.plotNumber, 10);
                        if (!isNaN(lastPlot) && lastPlot >= MIN_PLOT_NUMBER && lastPlot <= MAX_PLOT_NUMBER) {
                            currentPlotNumber = lastPlot;
                        }
                    }

                    // Prompt user for recovery
                    const numEntries = recoveredData.length;
                    const entryWord = numEntries === 1 ? 'entry' : 'entries';
                    if (confirm(`Recover ${numEntries} ${entryWord} from the last session? (Last plot was ${currentPlotNumber})`)) {
                        collectedData = recoveredData;
                        console.log('[Session] Data recovered from localStorage.');
                    } else {
                        localStorage.removeItem(STORAGE_KEY); // Clear storage if user declines
                        console.log('[Session] User declined recovery. Cleared localStorage.');
                    }
                } else {
                    // If data exists but is invalid (e.g., empty array, non-array), clear it
                    localStorage.removeItem(STORAGE_KEY);
                }
            }
        } catch (e) {
            console.error('[Session] Error loading or parsing data from localStorage:', e);
            // Clear potentially corrupted data
            localStorage.removeItem(STORAGE_KEY);
        }

        // Always update display and render entries, regardless of recovery outcome
        updatePlotDisplay();
        renderEntries();
    }

    // --- Populate Dropdowns ---
    function populateDbhOptions() {
        dbhSelect.innerHTML = ''; // Clear existing options
        console.log("Populating DBH options...");
        for (let i = 4; i <= 40; i += 2) {
            const option = document.createElement('option');
            option.value = String(i);
            option.textContent = String(i);
            dbhSelect.appendChild(option);
        }
        // Set default selection only if options were added
        if (dbhSelect.options.length > 0) {
            dbhSelect.selectedIndex = 0; // Default to '4'
        }
        console.log("DBH options populated. Current value:", dbhSelect.value);
    }

    function populateLogsOptions() {
        logsSelect.innerHTML = ''; // Clear existing options
        console.log("Populating Logs options...");
        const logValues = ["0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "Cull"];
        logValues.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            logsSelect.appendChild(option);
        });
        // Set default selection only if options were added
        if (logsSelect.options.length > 0) {
            logsSelect.selectedIndex = 0; // Default to '0'
        }
        console.log("Logs options populated. Current value:", logsSelect.value);
    }

    // --- Logic to set Logs based on DBH ---
    function checkAndSetLogsForDbh() {
        if (!dbhSelect || !logsSelect) {
            console.error("Cannot check Logs for DBH: Select elements not found.");
            return;
        }
        const selectedDbh = dbhSelect.value; // Already a string from select value
        const dbhValuesToResetLogs = ['4', '6', '8', '10'];

        if (dbhValuesToResetLogs.includes(selectedDbh)) {
            // Only update if the value is not already '0'
            if (logsSelect.value !== '0') {
                logsSelect.value = '0'; // This works if '0' exists as an option value
                console.log(`DBH is ${selectedDbh}. Logs forced to 0.`);
            }
        }
        // No 'else' needed - if DBH is not in the list, we don't modify Logs
    }


    // --- Plot Counter Logic ---
    function updatePlotDisplay() {
        plotNumberDisplay.textContent = currentPlotNumber;
        plotDecrementBtn.disabled = (currentPlotNumber <= MIN_PLOT_NUMBER);
        plotIncrementBtn.disabled = (currentPlotNumber >= MAX_PLOT_NUMBER);
    }

    plotDecrementBtn.addEventListener('click', () => {
        if (currentPlotNumber > MIN_PLOT_NUMBER) {
            currentPlotNumber--;
            updatePlotDisplay();
        }
    });

    plotIncrementBtn.addEventListener('click', () => {
        if (currentPlotNumber < MAX_PLOT_NUMBER) {
            currentPlotNumber++;
            updatePlotDisplay();
        }
    });

    // --- Render Entries List (Condensed View) ---
    function renderEntries() {
        entriesList.innerHTML = ''; // Clear current list
        entryCountSpan.textContent = collectedData.length;
        const hasData = collectedData.length > 0;

        // Toggle placeholder message visibility
        const placeholder = document.getElementById('noEntriesMsg');
        if (!hasData) {
            if (!placeholder) {
                // Create placeholder if it doesn't exist (e.g., first load)
                const newPlaceholder = document.createElement('li');
                newPlaceholder.id = 'noEntriesMsg';
                newPlaceholder.textContent = 'No data submitted yet.';
                Object.assign(newPlaceholder.style, { fontStyle: 'italic', color: '#6c757d', textAlign: 'center', border: 'none', backgroundColor: 'transparent', padding: '8px', margin: '0' });
                entriesList.appendChild(newPlaceholder);
            } else if (!entriesList.contains(placeholder)) {
                // Add it back if it was removed previously
                entriesList.appendChild(placeholder);
            }
        } else {
            // Remove placeholder if it exists and we have data
            if (placeholder) placeholder.remove();

            // Render entries in reverse chronological order (newest first)
            for (let i = collectedData.length - 1; i >= 0; i--) {
                const entry = collectedData[i];
                const listItem = document.createElement('li');

                // Checkbox for deletion
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = entry.id; // Use ID for tracking
                checkbox.setAttribute('data-id', entry.id); // Use data attribute for easy selection
                listItem.appendChild(checkbox);

                // Container for entry details
                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('entry-details');

                // Helper to add detail lines
                const addDetail = (label, value) => {
                    // Only add detail if value is meaningful (not undefined or null)
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

                // Add core details
                addDetail('Plot', entry.plotNumber);
                addDetail('DBH', entry.dbh);
                addDetail('Species', entry.species);
                addDetail('Logs', entry.logs);
                // Optionally add Cut, Notes, Location if desired in the list view
                // addDetail('Cut', entry.cutStatus);
                // addDetail('Notes', entry.notes);
                // if (entry.location) {
                //    addDetail('Loc', `(${entry.location.lat.toFixed(4)}, ${entry.location.lon.toFixed(4)})`);
                // }

                listItem.appendChild(detailsDiv);
                entriesList.appendChild(listItem);
            }
        }

        // Enable/disable action buttons based on data presence
        saveCsvBtn.disabled = !hasData;
        // shareBtn.disabled = !hasData; // REMOVED
        viewTallyBtn.disabled = !hasData;
        // Delete button state is handled separately based on checkbox selection
        deleteBtn.disabled = !isAnyCheckboxChecked();
    }

    // --- Check if any checkbox is checked ---
    function isAnyCheckboxChecked() {
        // More robust check: ensure the querySelector finds an element
        return entriesList.querySelector('input[type="checkbox"]:checked') !== null;
    }

    // --- Show Visual Feedback ---
    function showFeedback(message, isError = false, duration = 2500) {
        if (feedbackTimeout) {
            clearTimeout(feedbackTimeout); // Clear existing timeout
        }
        feedbackMsg.textContent = message;
        feedbackMsg.className = isError ? 'feedback-message error' : 'feedback-message'; // Add class for styling
        feedbackMsg.style.display = 'block';
        feedbackMsg.style.opacity = 1;

        feedbackTimeout = setTimeout(() => {
            feedbackMsg.style.opacity = 0;
            // Wait for fade out transition before hiding
            setTimeout(() => {
                feedbackMsg.style.display = 'none';
                feedbackTimeout = null;
            }, 500); // Should match CSS transition duration
        }, duration);
    }

    // --- Get Location Handler ---
    getLocationBtn.addEventListener('click', () => {
        if (!('geolocation' in navigator)) {
            locationStatus.textContent = 'Geolocation not supported';
            locationStatus.style.color = 'red';
            locationStatus.title = 'Geolocation not supported by this browser.';
            return;
        }

        // Update UI while fetching
        locationStatus.textContent = 'Fetching...';
        locationStatus.title = 'Attempting to get GPS coordinates...';
        locationStatus.style.color = '#555'; // Neutral color
        getLocationBtn.disabled = true; // Prevent multiple clicks

        navigator.geolocation.getCurrentPosition(
            // Success Callback
            (position) => {
                currentLocation = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                const displayCoords = `(${currentLocation.lat.toFixed(4)}, ${currentLocation.lon.toFixed(4)})`;
                locationStatus.textContent = `Location Set ${displayCoords}`;
                locationStatus.title = `Location Set: Latitude ${currentLocation.lat}, Longitude ${currentLocation.lon}`;
                locationStatus.style.color = 'green';
                getLocationBtn.disabled = false; // Re-enable button
            },
            // Error Callback
            (error) => {
                currentLocation = null; // Clear location on error
                let errorMsg = 'Error: ';
                let errorTitle = 'Error fetching location: ';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg += 'Denied';
                        errorTitle += 'Permission denied.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg += 'Unavailable';
                        errorTitle += 'Position unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMsg += 'Timeout';
                        errorTitle += 'Request timed out.';
                        break;
                    default:
                        errorMsg += 'Unknown';
                        errorTitle += 'Unknown error.';
                        break;
                }
                locationStatus.textContent = errorMsg;
                locationStatus.title = errorTitle;
                locationStatus.style.color = 'red';
                getLocationBtn.disabled = false; // Re-enable button
                console.error(errorTitle, error);
            },
            // Options
            {
                enableHighAccuracy: true, // Request more accurate position
                timeout: 15000, // Set timeout to 15 seconds
                maximumAge: 0 // Force fresh location data
            }
        );
    });

    // --- Submit Button Handler ---
    submitBtn.addEventListener('click', () => {
        // Ensure Logs value is correct based on DBH before saving
        checkAndSetLogsForDbh();

        // Create the new entry object
        const newEntry = {
            id: Date.now(), // Simple unique ID based on timestamp
            plotNumber: currentPlotNumber,
            dbh: dbhSelect.value,
            species: speciesSelect.value,
            logs: logsSelect.value,
            cutStatus: cutCheckbox.checked ? 'Yes' : 'No',
            notes: notesTextarea.value.trim(), // Trim whitespace from notes
            location: currentLocation // Will be null if not set or failed
        };

        // Add to data array
        collectedData.push(newEntry);

        // Update UI and save
        renderEntries();
        saveSessionData(); // Save after every submission
        showFeedback("Entry Added!");

        // Reset fields for next entry (except plot number and potentially DBH/Species)
        cutCheckbox.checked = false;
        notesTextarea.value = '';
        currentLocation = null; // Reset location for next entry
        locationStatus.textContent = 'Location not set';
        locationStatus.title = 'GPS Status';
        locationStatus.style.color = '#555'; // Reset color

        // speciesSelect.focus(); // Kept commented out as per previous request
    });

    // --- Tally Logic ---
    function generateTallyData() {
        const tally = {}; // { species: { dbh: { logs: count } } }

        collectedData.forEach(entry => {
            const { species, dbh, logs } = entry;
            // Basic validation: skip entries with missing core data
            if (!species || !dbh || !logs) {
                console.warn("Skipping entry in tally due to missing data:", entry);
                return;
            }

            // Initialize nested objects if they don't exist
            if (!tally[species]) {
                tally[species] = {};
            }
            if (!tally[species][dbh]) {
                tally[species][dbh] = {};
            }
            if (!tally[species][dbh][logs]) {
                tally[species][dbh][logs] = 0;
            }

            // Increment the count
            tally[species][dbh][logs]++;
        });
        return tally;
    }

    function displayTallyResults(tallyData) {
        tallyResultsContainer.innerHTML = ''; // Clear previous results

        const speciesKeys = Object.keys(tallyData).sort(); // Sort species alphabetically

        if (speciesKeys.length === 0) {
            const p = document.createElement('p');
            p.textContent = 'No data available to tally.';
            p.classList.add('no-tally-data');
            tallyResultsContainer.appendChild(p);
            return;
        }

        speciesKeys.forEach(species => {
            const speciesDiv = document.createElement('div');
            speciesDiv.classList.add('tally-species');

            const speciesHeading = document.createElement('h3');
            speciesHeading.textContent = species;
            speciesDiv.appendChild(speciesHeading);

            // Sort DBH numerically
            const dbhKeys = Object.keys(tallyData[species]).sort((a, b) => Number(a) - Number(b));

            dbhKeys.forEach(dbh => {
                const dbhHeading = document.createElement('h4');
                dbhHeading.textContent = `DBH: ${dbh}`;
                speciesDiv.appendChild(dbhHeading);

                // Sort Logs numerically, placing "Cull" last
                const logKeys = Object.keys(tallyData[species][dbh]).sort((a, b) => {
                    if (a === 'Cull') return 1; // Push Cull to the end
                    if (b === 'Cull') return -1; // Keep Cull at the end
                    return Number(a) - Number(b); // Numerical sort for others
                });

                logKeys.forEach(logs => {
                    const count = tallyData[species][dbh][logs];
                    const logItemDiv = document.createElement('div');
                    logItemDiv.classList.add('tally-log-item');

                    const labelSpan = document.createElement('span');
                    labelSpan.classList.add('log-label');
                    labelSpan.textContent = `Logs: ${logs} - `;

                    const countSpan = document.createElement('span');
                    countSpan.classList.add('log-count');
                    countSpan.textContent = `Count: ${count}`;

                    logItemDiv.appendChild(labelSpan);
                    logItemDiv.appendChild(countSpan);
                    speciesDiv.appendChild(logItemDiv);
                });
            });
            tallyResultsContainer.appendChild(speciesDiv);
        });
    }

    // --- Save CSV Button Handler ---
    saveCsvBtn.addEventListener('click', () => {
        if (collectedData.length === 0) {
            showFeedback("No data to save.", true); // Show error feedback
            return;
        }

        // 1. Generate Raw Data CSV Content
        let rawCsvContent = "PlotNumber,DBH,Species,Logs,Cut,Notes,Latitude,Longitude\n";
        collectedData.forEach(entry => {
            // Sanitize notes for CSV (escape double quotes)
            const notesSanitized = `"${(entry.notes || '').replace(/"/g, '""')}"`;
            const lat = entry.location ? entry.location.lat : '';
            const lon = entry.location ? entry.location.lon : '';
            const cut = entry.cutStatus || 'No'; // Default to 'No' if undefined

            rawCsvContent += `${entry.plotNumber},${entry.dbh},${entry.species},${entry.logs},${cut},${notesSanitized},${lat},${lon}\n`;
        });

        // 2. Generate Tally Data CSV Content
        const tallyData = generateTallyData();
        let tallyCsvContent = "\n\n--- TALLY DATA ---\n";
        tallyCsvContent += "Species,DBH,Logs,Count\n";
        const speciesKeys = Object.keys(tallyData).sort();
        speciesKeys.forEach(species => {
            const dbhKeys = Object.keys(tallyData[species]).sort((a, b) => Number(a) - Number(b));
            dbhKeys.forEach(dbh => {
                const logKeys = Object.keys(tallyData[species][dbh]).sort((a, b) => {
                    if (a === 'Cull') return 1;
                    if (b === 'Cull') return -1;
                    return Number(a) - Number(b);
                });
                logKeys.forEach(logs => {
                    const count = tallyData[species][dbh][logs];
                    tallyCsvContent += `${species},${dbh},${logs},${count}\n`;
                });
            });
        });

        // 3. Combine and Create Blob
        const combinedCsvContent = rawCsvContent + tallyCsvContent;
        const blob = new Blob([combinedCsvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        // 4. Create Download Link and Trigger Click
        const link = document.createElement("a");
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, ""); // YYYYMMDDHHMMSS format
        link.setAttribute("href", url);
        link.setAttribute("download", `TreeData_WithTally_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();

        // 5. Clean Up
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        showFeedback("CSV File with Tally Saved!");

        // 6. Clear temporary session data after successful save
        try {
            localStorage.removeItem(STORAGE_KEY);
            collectedData = []; // Clear in-memory data as well
            renderEntries(); // Update UI to reflect cleared data
            console.log('[Session] CSV saved. Cleared localStorage and in-memory data.');
        } catch (e) {
            console.error('[Session] Error clearing localStorage after save:', e);
            // Data remains in memory, user can try saving again or continue session
        }
    });

    // --- Share Button Handler ---  REMOVED ENTIRE BLOCK
    // shareBtn.addEventListener('click', async () => { ... });

    // --- Delete Button Handler ---
    deleteBtn.addEventListener('click', () => {
        const checkboxes = entriesList.querySelectorAll('input[type="checkbox"]:checked');
        if (checkboxes.length === 0) {
            showFeedback("No entries selected for deletion.", true);
            return;
        }

        const idsToDelete = new Set();
        checkboxes.forEach(cb => {
            const id = parseInt(cb.getAttribute('data-id'), 10);
            if (!isNaN(id)) {
                idsToDelete.add(id);
            }
        });

        if (idsToDelete.size === 0) {
            // Should not happen if checkboxes.length > 0, but good safeguard
            console.warn("Selected checkboxes found, but no valid IDs to delete.");
            return;
        }

        const numToDelete = idsToDelete.size;
        const entryWord = numToDelete === 1 ? 'entry' : 'entries';
        if (!confirm(`Are you sure you want to delete ${numToDelete} selected ${entryWord}?`)) {
            return; // User cancelled
        }

        // Filter out the entries to be deleted
        collectedData = collectedData.filter(entry => !idsToDelete.has(entry.id));

        // Update UI and save the modified data
        renderEntries(); // This will re-render the list and update button states
        saveSessionData(); // Save the data with deletions persisted
        showFeedback(`${numToDelete} ${entryWord} deleted.`);
    });

    // --- Enable/Disable Delete Button Based on Checkbox Clicks ---
    // Use event delegation on the list itself for efficiency
    entriesList.addEventListener('change', (event) => {
        // Ensure the event was triggered by a checkbox changing
        if (event.target.type === 'checkbox') {
            deleteBtn.disabled = !isAnyCheckboxChecked();
        }
    });

    // --- View Switching Logic ---
    viewTallyBtn.addEventListener('click', () => {
        const tallyData = generateTallyData();
        displayTallyResults(tallyData);
        entryView.style.display = 'none';
        tallyView.style.display = 'block';
    });

    backToEntryBtn.addEventListener('click', () => {
        tallyView.style.display = 'none';
        entryView.style.display = 'block';
    });


    // --- Initial Setup ---
    console.log("Initializing application...");

    // Populate dropdowns
    populateDbhOptions();
    populateLogsOptions();

    // Add event listener *after* dropdowns are populated
    dbhSelect.addEventListener('change', checkAndSetLogsForDbh);

    // Set initial Logs state based on initial DBH value *after* population
    checkAndSetLogsForDbh();
    console.log("Dropdowns initialized and initial log check performed.");

    // Attempt to load saved session data (this also calls renderEntries and updatePlotDisplay)
    loadAndPromptSessionData();

    console.log("Application initialization complete.");
});

// --- END OF FILE script.js ---
