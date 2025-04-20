// --- START OF FILE script.js ---

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./service-worker.js') // Using the dynamically caching version
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
    const deleteBtn = document.getElementById('deleteBtn');
    const deleteAllBtn = document.getElementById('deleteAllBtn'); // Reference for the new button
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
        try {
            const savedDataJSON = localStorage.getItem(STORAGE_KEY);
            if (savedDataJSON) {
                const recoveredData = JSON.parse(savedDataJSON);
                if (Array.isArray(recoveredData) && recoveredData.length > 0) {
                    const lastEntry = recoveredData[recoveredData.length - 1];
                    // Attempt to restore the plot number from the last entry
                    if (lastEntry?.plotNumber) {
                        const lastPlot = parseInt(lastEntry.plotNumber, 10);
                        if (!isNaN(lastPlot) && lastPlot >= MIN_PLOT_NUMBER && lastPlot <= MAX_PLOT_NUMBER) {
                            currentPlotNumber = lastPlot;
                        } else {
                           currentPlotNumber = 1; // Default if recovered plot number is invalid
                        }
                    } else {
                        currentPlotNumber = 1; // Default if no plot number in last entry
                    }

                    const numEntries = recoveredData.length;
                    const entryWord = numEntries === 1 ? 'entry' : 'entries';
                    if (confirm(`Recover ${numEntries} ${entryWord} from the last session? (Last plot was ${currentPlotNumber})`)) {
                        collectedData = recoveredData;
                        console.log('[Session] Data recovered from localStorage.');
                    } else {
                        localStorage.removeItem(STORAGE_KEY);
                        console.log('[Session] User declined recovery. Cleared localStorage.');
                        currentPlotNumber = 1; // Reset plot number if recovery declined
                    }
                } else {
                    localStorage.removeItem(STORAGE_KEY); // Clear invalid data
                     currentPlotNumber = 1;
                }
            } else {
                 currentPlotNumber = 1; // Default plot number if no saved data
            }
        } catch (e) {
            console.error('[Session] Error loading or parsing data from localStorage:', e);
            localStorage.removeItem(STORAGE_KEY);
            currentPlotNumber = 1; // Reset on error
        }
        updatePlotDisplay(); // Update display based on loaded/default plot number
        renderEntries(); // Render any loaded data and set initial button states
    }

    // --- Populate Dropdowns ---
    function populateDbhOptions() {
        dbhSelect.innerHTML = '';
        console.log("Populating DBH options...");
        for (let i = 4; i <= 40; i += 2) {
            const option = document.createElement('option');
            option.value = String(i);
            option.textContent = String(i);
            dbhSelect.appendChild(option);
        }
        if (dbhSelect.options.length > 0) {
            dbhSelect.selectedIndex = 0;
        }
        console.log("DBH options populated. Current value:", dbhSelect.value);
    }

    function populateLogsOptions() {
        logsSelect.innerHTML = '';
        console.log("Populating Logs options...");
        const logValues = ["0", "0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "Cull"];
        logValues.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            logsSelect.appendChild(option);
        });
        if (logsSelect.options.length > 0) {
            logsSelect.selectedIndex = 0;
        }
        console.log("Logs options populated. Current value:", logsSelect.value);
    }

    // --- Logic to set Logs based on DBH ---
    function checkAndSetLogsForDbh() {
        if (!dbhSelect || !logsSelect) {
            console.error("Cannot check Logs for DBH: Select elements not found.");
            return;
        }
        const selectedDbh = dbhSelect.value;
        const dbhValuesToResetLogs = ['4', '6', '8', '10'];
        // Check if DBH is one of the small values AND current logs is not '0'
        if (dbhValuesToResetLogs.includes(selectedDbh) && logsSelect.value !== '0') {
             logsSelect.value = '0'; // Force logs to 0
             console.log(`DBH is ${selectedDbh}. Logs forced to 0.`);
        }
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

        const placeholder = document.getElementById('noEntriesMsg');
        if (!hasData) {
             if (!placeholder) { // If placeholder doesn't exist at all, create it
                const newPlaceholder = document.createElement('li');
                newPlaceholder.id = 'noEntriesMsg';
                newPlaceholder.textContent = 'No data submitted yet.';
                Object.assign(newPlaceholder.style, { fontStyle: 'italic', color: '#6c757d', textAlign: 'center', border: 'none', backgroundColor: 'transparent', padding: '8px', margin: '0' });
                entriesList.appendChild(newPlaceholder);
            } else if (!entriesList.contains(placeholder)) { // If it exists but isn't in the list, add it
                entriesList.appendChild(placeholder);
            }
        } else {
             if (placeholder) placeholder.remove(); // Remove placeholder if data exists

            // Loop through data REVERSELY to show newest first
            for (let i = collectedData.length - 1; i >= 0; i--) {
                const entry = collectedData[i];
                const listItem = document.createElement('li');

                // Checkbox for selection
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = entry.id; // Use ID for value
                checkbox.setAttribute('data-id', entry.id); // Store ID in data attribute
                listItem.appendChild(checkbox);

                // Container for entry details
                const detailsDiv = document.createElement('div');
                detailsDiv.classList.add('entry-details');

                // Helper function to add detail lines
                const addDetail = (label, value) => {
                    // Only add if value is meaningful
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

                // Add the details you want to display in the list
                addDetail('Plot', entry.plotNumber);
                addDetail('DBH', entry.dbh);
                addDetail('Species', entry.species);
                addDetail('Logs', entry.logs);
                // Optional: Add Cut status or Notes snippet if desired
                // addDetail('Cut', entry.cutStatus);
                // addDetail('Notes', entry.notes ? entry.notes.substring(0, 20) + (entry.notes.length > 20 ? '...' : '') : '');

                listItem.appendChild(detailsDiv);
                entriesList.appendChild(listItem); // Add the new list item
            }
        }

        // Update button states based on whether data exists or checkboxes are checked
        saveCsvBtn.disabled = !hasData;
        viewTallyBtn.disabled = !hasData;
        deleteAllBtn.disabled = !hasData; // Disable "Delete All" if no data
        deleteBtn.disabled = !isAnyCheckboxChecked(); // Disable "Delete Selected" if nothing checked

    }

    // --- Check if any checkbox is checked ---
    function isAnyCheckboxChecked() {
        // Find the first checked checkbox within the entries list
        return entriesList.querySelector('input[type="checkbox"]:checked') !== null;
    }

    // --- Show Visual Feedback ---
    function showFeedback(message, isError = false, duration = 2500) {
        if (feedbackTimeout) {
            clearTimeout(feedbackTimeout); // Clear any existing timeout
        }
        feedbackMsg.textContent = message;
        // Set class based on error status for styling
        feedbackMsg.className = isError ? 'feedback-message error' : 'feedback-message';
        feedbackMsg.style.display = 'block'; // Make it visible
        // Force reflow to ensure transition starts correctly after display: block
        void feedbackMsg.offsetWidth;
        feedbackMsg.style.opacity = 1; // Fade in

        // Set timeout to fade out and hide
        feedbackTimeout = setTimeout(() => {
            feedbackMsg.style.opacity = 0;
            // Wait for fade out transition to complete before hiding
            setTimeout(() => {
                feedbackMsg.style.display = 'none';
                feedbackTimeout = null; // Clear the timeout ID
            }, 500); // Matches CSS transition duration
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

        locationStatus.textContent = 'Fetching...';
        locationStatus.title = 'Attempting to get GPS coordinates...';
        locationStatus.style.color = '#555'; // Neutral color while fetching
        getLocationBtn.disabled = true; // Disable button while fetching

        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLocation = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                const displayCoords = `(${currentLocation.lat.toFixed(4)}, ${currentLocation.lon.toFixed(4)})`;
                locationStatus.textContent = `Location Set ${displayCoords}`;
                locationStatus.title = `Location Set: Latitude ${currentLocation.lat}, Longitude ${currentLocation.lon}`;
                locationStatus.style.color = 'green'; // Success color
                getLocationBtn.disabled = false; // Re-enable button
            },
            (error) => {
                currentLocation = null; // Clear location on error
                let errorMsg = 'Error: ';
                let errorTitle = 'Error fetching location: ';
                switch (error.code) {
                    case error.PERMISSION_DENIED: errorMsg += 'Denied'; errorTitle += 'Permission denied.'; break;
                    case error.POSITION_UNAVAILABLE: errorMsg += 'Unavailable'; errorTitle += 'Position unavailable.'; break;
                    case error.TIMEOUT: errorMsg += 'Timeout'; errorTitle += 'Request timed out.'; break;
                    default: errorMsg += 'Unknown'; errorTitle += 'Unknown error.'; break;
                }
                locationStatus.textContent = errorMsg;
                locationStatus.title = errorTitle;
                locationStatus.style.color = 'red'; // Error color
                getLocationBtn.disabled = false; // Re-enable button
                console.error(errorTitle, error);
            },
            // Options for getCurrentPosition
            {
                enableHighAccuracy: true, // Request more accurate position
                timeout: 15000, // Maximum time allowed to get position (15 seconds)
                maximumAge: 0 // Force fresh position, don't use cached location
            }
        );
    });

    // --- Submit Button Handler ---
    submitBtn.addEventListener('click', () => {
        // Ensure logs are 0 for small DBH values *before* creating the entry
        checkAndSetLogsForDbh();

        // Create a new entry object
        const newEntry = {
            id: Date.now(), // Unique ID based on timestamp
            plotNumber: currentPlotNumber,
            dbh: dbhSelect.value,
            species: speciesSelect.value,
            logs: logsSelect.value,
            cutStatus: cutCheckbox.checked ? 'Yes' : 'No',
            notes: notesTextarea.value.trim(), // Trim whitespace from notes
            location: currentLocation // Store captured location (or null)
        };

        collectedData.push(newEntry); // Add to the main data array
        renderEntries(); // Update the displayed list and button states
        saveSessionData(); // Save the updated data to localStorage
        showFeedback("Entry Added!"); // Show success message

        // Reset fields for the next entry (except plot number)
        cutCheckbox.checked = false;
        notesTextarea.value = '';
        currentLocation = null; // Clear location for next entry
        locationStatus.textContent = 'Location not set';
        locationStatus.title = 'GPS Status';
        locationStatus.style.color = '#555'; // Reset location status color
    });

    // --- Tally Logic ---
    function generateTallyData() {
        const tally = {}; // { species: { dbh: { logs: count } } }
        collectedData.forEach(entry => {
            const { species, dbh, logs } = entry;
            // Basic validation - skip if essential data is missing
            if (!species || !dbh || !logs) {
                console.warn("Skipping entry in tally due to missing data:", entry);
                return;
            }
            // Build nested structure
            if (!tally[species]) tally[species] = {};
            if (!tally[species][dbh]) tally[species][dbh] = {};
            if (!tally[species][dbh][logs]) tally[species][dbh][logs] = 0;
            tally[species][dbh][logs]++; // Increment count
        });
        return tally;
    }

    function displayTallyResults(tallyData) {
        tallyResultsContainer.innerHTML = ''; // Clear previous results
        const speciesKeys = Object.keys(tallyData).sort(); // Sort species alphabetically

        if (speciesKeys.length === 0) {
            const p = document.createElement('p');
            p.textContent = 'No data available to tally.';
            p.classList.add('no-tally-data'); // For styling
            tallyResultsContainer.appendChild(p);
            return;
        }

        speciesKeys.forEach(species => {
            const speciesDiv = document.createElement('div');
            speciesDiv.classList.add('tally-species'); // For styling

            const speciesHeading = document.createElement('h3');
            speciesHeading.textContent = species;
            speciesDiv.appendChild(speciesHeading);

            // Sort DBH numerically
            const dbhKeys = Object.keys(tallyData[species]).sort((a, b) => Number(a) - Number(b));

            dbhKeys.forEach(dbh => {
                const dbhHeading = document.createElement('h4');
                dbhHeading.textContent = `DBH: ${dbh}`;
                speciesDiv.appendChild(dbhHeading);

                // Sort logs numerically, handle 'Cull' specifically
                const logKeys = Object.keys(tallyData[species][dbh]).sort((a, b) => {
                    if (a === 'Cull') return 1; // 'Cull' always last
                    if (b === 'Cull') return -1;
                    return Number(a) - Number(b); // Sort others numerically
                });

                logKeys.forEach(logs => {
                    const count = tallyData[species][dbh][logs];
                    const logItemDiv = document.createElement('div');
                    logItemDiv.classList.add('tally-log-item'); // For styling

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

    // --- Forestry Stats Calculation ---
    function calculateForestryStats(data, baf) {
        if (!data || data.length === 0) {
            return {
                avgDbh: 0, basalAreaPerAcre: 0, treesPerAcre: 0,
                numberOfPlots: 0, totalTrees: 0
            };
        }

        const plotNumbers = new Set(data.map(entry => entry.plotNumber));
        const numberOfPlots = plotNumbers.size;
        const totalTrees = data.length;

        let totalDbh = 0;
        let totalTpaContribution = 0;
        const BA_CONSTANT = 0.005454; // Constant for BA calculation (sq ft)

        data.forEach(entry => {
            const dbh = parseFloat(entry.dbh);
            if (!isNaN(dbh)) {
                totalDbh += dbh;

                // Calculate TPA contribution only for valid DBH > 0
                if (dbh > 0) {
                    const baTree = BA_CONSTANT * Math.pow(dbh, 2);
                    if (baTree > 0) {
                        const tpaTree = baf / baTree; // TPA represented by this single tree
                        totalTpaContribution += tpaTree;
                    }
                }
            } else {
                console.warn("Skipping entry in stats calculation due to invalid DBH:", entry);
            }
        });

        // Calculate averages, handle division by zero
        const avgDbh = totalTrees > 0 ? totalDbh / totalTrees : 0;
        // BA/acre = (Total Trees Counted * BAF) / Number of Plots
        const basalAreaPerAcre = numberOfPlots > 0 ? (totalTrees * baf) / numberOfPlots : 0;
        // TPA = Sum of (TPA represented by each tree) / Number of Plots
        const treesPerAcre = numberOfPlots > 0 ? totalTpaContribution / numberOfPlots : 0;

        return {
            avgDbh: avgDbh,
            basalAreaPerAcre: basalAreaPerAcre,
            treesPerAcre: treesPerAcre,
            numberOfPlots: numberOfPlots,
            totalTrees: totalTrees
        };
    }


    // --- Save CSV Button Handler ---
    saveCsvBtn.addEventListener('click', () => {
        if (collectedData.length === 0) {
            showFeedback("No data to save.", true);
            return;
        }

        // 1. Generate Raw Data CSV Content
        let rawCsvContent = "PlotNumber,DBH,Species,Logs,Cut,Notes,Latitude,Longitude\n";
        collectedData.forEach(entry => {
            // Sanitize notes for CSV (handle commas and quotes)
            const notesSanitized = `"${(entry.notes || '').replace(/"/g, '""')}"`;
            const lat = entry.location ? entry.location.lat : '';
            const lon = entry.location ? entry.location.lon : '';
            const cut = entry.cutStatus || 'No'; // Default to No if undefined
            rawCsvContent += `${entry.plotNumber},${entry.dbh},"${entry.species}",${entry.logs},${cut},${notesSanitized},${lat},${lon}\n`;
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
                    if (a === 'Cull') return 1; if (b === 'Cull') return -1; return Number(a) - Number(b);
                });
                logKeys.forEach(logs => {
                    const count = tallyData[species][dbh][logs];
                    tallyCsvContent += `"${species}",${dbh},${logs},${count}\n`;
                });
            });
        });

        // 3. Calculate and Generate Summary Stats CSV Content
        const stats = calculateForestryStats(collectedData, BAF);
        let summaryCsvContent = `\n\n--- SUMMARY STATISTICS (BAF=${BAF}) ---\n`;
        summaryCsvContent += "Metric,Value\n";
        summaryCsvContent += `Total Trees Counted,${stats.totalTrees}\n`;
        summaryCsvContent += `Number of Plots,${stats.numberOfPlots}\n`;
        summaryCsvContent += `Average DBH (in),${stats.avgDbh.toFixed(1)}\n`;
        summaryCsvContent += `Basal Area (sq ft/acre),${stats.basalAreaPerAcre.toFixed(1)}\n`;
        summaryCsvContent += `Trees Per Acre,${stats.treesPerAcre.toFixed(1)}\n`;

        // 4. Combine All Sections and Create Blob
        const combinedCsvContent = rawCsvContent + tallyCsvContent + summaryCsvContent;
        const blob = new Blob([combinedCsvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        // 5. Create Download Link and Trigger Click
        const link = document.createElement("a");
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, "");
        // Update filename to be more generic
        link.setAttribute("href", url);
        link.setAttribute("download", `TreeData_Export_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();

        // 6. Clean Up
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // 7. Show feedback
        showFeedback("CSV File with Tally & Summary Saved!");

        // 8. IMPORTANT: Clear temporary session data after successful save
        try {
            collectedData = []; // Clear in-memory data
            localStorage.removeItem(STORAGE_KEY); // Clear persisted data
            renderEntries(); // Update UI (disables buttons, shows "No data")
            console.log('[Session] CSV saved. Cleared localStorage and in-memory data.');
        } catch (e) {
            console.error('[Session] Error clearing localStorage after save:', e);
            // Data might still be in memory, but session persistence is gone
        }
    });


    // --- Delete Selected Button Handler ---
    deleteBtn.addEventListener('click', () => {
        const checkboxes = entriesList.querySelectorAll('input[type="checkbox"]:checked');
        if (checkboxes.length === 0) {
            showFeedback("No entries selected for deletion.", true);
            return;
        }

        // Collect IDs to delete from checked checkboxes
        const idsToDelete = new Set();
        checkboxes.forEach(cb => {
            const id = parseInt(cb.getAttribute('data-id'), 10);
            if (!isNaN(id)) {
                idsToDelete.add(id);
            }
        });

        if (idsToDelete.size === 0) {
            console.warn("Selected checkboxes found, but no valid IDs to delete.");
            showFeedback("Could not identify entries to delete.", true);
            return;
        }

        const numToDelete = idsToDelete.size;
        const entryWord = numToDelete === 1 ? 'entry' : 'entries';
        // Standard confirmation prompt
        if (!confirm(`Are you sure you want to delete ${numToDelete} selected ${entryWord}?`)) {
            return; // User cancelled
        }

        // Filter out the entries to be deleted
        collectedData = collectedData.filter(entry => !idsToDelete.has(entry.id));
        renderEntries(); // Update the UI
        saveSessionData(); // Save the modified data
        showFeedback(`${numToDelete} ${entryWord} deleted.`);
    });

    // --- Delete All Button Handler ---
    deleteAllBtn.addEventListener('click', () => {
        if (collectedData.length === 0) {
            showFeedback("No data to delete.", true);
            return; // Should be disabled anyway, but safety check
        }

        // Use a more prominent confirmation for this destructive action!
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
            // Attempt to continue UI update even if localStorage fails
        }

        renderEntries(); // Update the UI (will show "No data..." and disable buttons)
        showFeedback('All data has been deleted.');

        // Optional: Reset location status as well
        currentLocation = null;
        locationStatus.textContent = 'Location not set';
        locationStatus.title = 'GPS Status';
        locationStatus.style.color = '#555';
    });


    // --- Enable/Disable Delete Selected Button Based on Checkbox Clicks ---
    entriesList.addEventListener('change', (event) => {
        // Check if the event target was a checkbox within the list
        if (event.target.type === 'checkbox') {
            // Re-evaluate if the "Delete Selected" button should be enabled/disabled
            deleteBtn.disabled = !isAnyCheckboxChecked();
        }
    });

    // --- View Switching Logic ---
    viewTallyBtn.addEventListener('click', () => {
        const tallyData = generateTallyData(); // Generate tally from current data
        displayTallyResults(tallyData); // Populate the tally view
        entryView.style.display = 'none'; // Hide entry form
        tallyView.style.display = 'block'; // Show tally view
    });

    backToEntryBtn.addEventListener('click', () => {
        tallyView.style.display = 'none'; // Hide tally view
        entryView.style.display = 'block'; // Show entry form
    });

    // --- Initial Setup ---
    console.log("Initializing application...");
    populateDbhOptions(); // Populate DBH dropdown
    populateLogsOptions(); // Populate Logs dropdown
    dbhSelect.addEventListener('change', checkAndSetLogsForDbh); // Add listener for DBH changes
    checkAndSetLogsForDbh(); // Run initial check in case default DBH requires log adjustment
    console.log("Dropdowns initialized and initial log check performed.");
    loadAndPromptSessionData(); // Load existing data, prompt user, render initial state
    console.log("Application initialization complete.");
});

// --- END OF FILE script.js ---
