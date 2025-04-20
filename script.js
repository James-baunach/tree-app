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

    // *** ADDED: Forestry Calculation Constant ***
    const BAF = 10; // Basal Area Factor (sq ft/acre/tree)

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
                    const lastEntry = recoveredData[recoveredData.length - 1];
                    if (lastEntry?.plotNumber) {
                        const lastPlot = parseInt(lastEntry.plotNumber, 10);
                        if (!isNaN(lastPlot) && lastPlot >= MIN_PLOT_NUMBER && lastPlot <= MAX_PLOT_NUMBER) {
                            currentPlotNumber = lastPlot;
                        }
                    }
                    const numEntries = recoveredData.length;
                    const entryWord = numEntries === 1 ? 'entry' : 'entries';
                    if (confirm(`Recover ${numEntries} ${entryWord} from the last session? (Last plot was ${currentPlotNumber})`)) {
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
        updatePlotDisplay();
        renderEntries();
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
        if (dbhValuesToResetLogs.includes(selectedDbh)) {
            if (logsSelect.value !== '0') {
                logsSelect.value = '0';
                console.log(`DBH is ${selectedDbh}. Logs forced to 0.`);
            }
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

                listItem.appendChild(detailsDiv);
                entriesList.appendChild(listItem);
            }
        }

        saveCsvBtn.disabled = !hasData;
        viewTallyBtn.disabled = !hasData;
        deleteBtn.disabled = !isAnyCheckboxChecked();
    }

    // --- Check if any checkbox is checked ---
    function isAnyCheckboxChecked() {
        return entriesList.querySelector('input[type="checkbox"]:checked') !== null;
    }

    // --- Show Visual Feedback ---
    function showFeedback(message, isError = false, duration = 2500) {
        if (feedbackTimeout) {
            clearTimeout(feedbackTimeout);
        }
        feedbackMsg.textContent = message;
        feedbackMsg.className = isError ? 'feedback-message error' : 'feedback-message';
        feedbackMsg.style.display = 'block';
        feedbackMsg.style.opacity = 1;

        feedbackTimeout = setTimeout(() => {
            feedbackMsg.style.opacity = 0;
            setTimeout(() => {
                feedbackMsg.style.display = 'none';
                feedbackTimeout = null;
            }, 500);
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
        locationStatus.style.color = '#555';
        getLocationBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            (position) => {
                currentLocation = {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                };
                const displayCoords = `(${currentLocation.lat.toFixed(4)}, ${currentLocation.lon.toFixed(4)})`;
                locationStatus.textContent = `Location Set ${displayCoords}`;
                locationStatus.title = `Location Set: Latitude ${currentLocation.lat}, Longitude ${currentLocation.lon}`;
                locationStatus.style.color = 'green';
                getLocationBtn.disabled = false;
            },
            (error) => {
                currentLocation = null;
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
                locationStatus.style.color = 'red';
                getLocationBtn.disabled = false;
                console.error(errorTitle, error);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    });

    // --- Submit Button Handler ---
    submitBtn.addEventListener('click', () => {
        checkAndSetLogsForDbh();

        const newEntry = {
            id: Date.now(),
            plotNumber: currentPlotNumber,
            dbh: dbhSelect.value,
            species: speciesSelect.value,
            logs: logsSelect.value,
            cutStatus: cutCheckbox.checked ? 'Yes' : 'No',
            notes: notesTextarea.value.trim(),
            location: currentLocation
        };

        collectedData.push(newEntry);
        renderEntries();
        saveSessionData();
        showFeedback("Entry Added!");

        cutCheckbox.checked = false;
        notesTextarea.value = '';
        currentLocation = null;
        locationStatus.textContent = 'Location not set';
        locationStatus.title = 'GPS Status';
        locationStatus.style.color = '#555';
    });

    // --- Tally Logic ---
    function generateTallyData() {
        const tally = {};
        collectedData.forEach(entry => {
            const { species, dbh, logs } = entry;
            if (!species || !dbh || !logs) {
                console.warn("Skipping entry in tally due to missing data:", entry);
                return;
            }
            if (!tally[species]) tally[species] = {};
            if (!tally[species][dbh]) tally[species][dbh] = {};
            if (!tally[species][dbh][logs]) tally[species][dbh][logs] = 0;
            tally[species][dbh][logs]++;
        });
        return tally;
    }

    function displayTallyResults(tallyData) {
        tallyResultsContainer.innerHTML = '';
        const speciesKeys = Object.keys(tallyData).sort();
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
            const dbhKeys = Object.keys(tallyData[species]).sort((a, b) => Number(a) - Number(b));
            dbhKeys.forEach(dbh => {
                const dbhHeading = document.createElement('h4');
                dbhHeading.textContent = `DBH: ${dbh}`;
                speciesDiv.appendChild(dbhHeading);
                const logKeys = Object.keys(tallyData[species][dbh]).sort((a, b) => {
                    if (a === 'Cull') return 1;
                    if (b === 'Cull') return -1;
                    return Number(a) - Number(b);
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

    // *** ADDED: Function to calculate forestry summary stats ***
    function calculateForestryStats(data, baf) {
        if (!data || data.length === 0) {
            return {
                avgDbh: 0,
                basalAreaPerAcre: 0,
                treesPerAcre: 0,
                numberOfPlots: 0,
                totalTrees: 0
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

        const avgDbh = totalTrees > 0 ? totalDbh / totalTrees : 0;
        const basalAreaPerAcre = numberOfPlots > 0 ? (totalTrees * baf) / numberOfPlots : 0;
        const treesPerAcre = numberOfPlots > 0 ? totalTpaContribution / numberOfPlots : 0;

        return {
            avgDbh: avgDbh,
            basalAreaPerAcre: basalAreaPerAcre,
            treesPerAcre: treesPerAcre,
            numberOfPlots: numberOfPlots,
            totalTrees: totalTrees
        };
    }


    // --- Save CSV Button Handler (MODIFIED) ---
    saveCsvBtn.addEventListener('click', () => {
        if (collectedData.length === 0) {
            showFeedback("No data to save.", true);
            return;
        }

        // 1. Generate Raw Data CSV Content
        let rawCsvContent = "PlotNumber,DBH,Species,Logs,Cut,Notes,Latitude,Longitude\n";
        collectedData.forEach(entry => {
            const notesSanitized = `"${(entry.notes || '').replace(/"/g, '""')}"`;
            const lat = entry.location ? entry.location.lat : '';
            const lon = entry.location ? entry.location.lon : '';
            const cut = entry.cutStatus || 'No';
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

        // *** ADDED: 3. Calculate and Generate Summary Stats CSV Content ***
        const stats = calculateForestryStats(collectedData, BAF);
        let summaryCsvContent = `\n\n--- SUMMARY STATISTICS (BAF=${BAF}) ---\n`;
        summaryCsvContent += "Metric,Value\n";
        summaryCsvContent += `Total Trees Counted,${stats.totalTrees}\n`;
        summaryCsvContent += `Number of Plots,${stats.numberOfPlots}\n`;
        summaryCsvContent += `Average DBH (in),${stats.avgDbh.toFixed(1)}\n`;
        summaryCsvContent += `Basal Area (sq ft/acre),${stats.basalAreaPerAcre.toFixed(1)}\n`;
        summaryCsvContent += `Trees Per Acre,${stats.treesPerAcre.toFixed(1)}\n`;

        // *** MODIFIED: 4. Combine All Sections and Create Blob ***
        const combinedCsvContent = rawCsvContent + tallyCsvContent + summaryCsvContent; // Added summary content
        const blob = new Blob([combinedCsvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        // *** MODIFIED: 5. Create Download Link and Trigger Click *** (Filename unchanged)
        const link = document.createElement("a");
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, "");
        // NOTE: Filename includes "WithTally" but now also contains summary stats
        link.setAttribute("href", url);
        link.setAttribute("download", `TreeData_WithTally_${timestamp}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();

        // *** MODIFIED: 6. Clean Up ***
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        // *** MODIFIED: 7. Show feedback and clear data ***
        showFeedback("CSV File with Tally & Summary Saved!");

        // 8. Clear temporary session data after successful save
        try {
            localStorage.removeItem(STORAGE_KEY);
            collectedData = []; // Clear in-memory data
            renderEntries(); // Update UI
            console.log('[Session] CSV saved. Cleared localStorage and in-memory data.');
        } catch (e) {
            console.error('[Session] Error clearing localStorage after save:', e);
        }
    });


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
            console.warn("Selected checkboxes found, but no valid IDs to delete.");
            return;
        }

        const numToDelete = idsToDelete.size;
        const entryWord = numToDelete === 1 ? 'entry' : 'entries';
        if (!confirm(`Are you sure you want to delete ${numToDelete} selected ${entryWord}?`)) {
            return; // User cancelled
        }

        collectedData = collectedData.filter(entry => !idsToDelete.has(entry.id));
        renderEntries();
        saveSessionData();
        showFeedback(`${numToDelete} ${entryWord} deleted.`);
    });

    // --- Enable/Disable Delete Button Based on Checkbox Clicks ---
    entriesList.addEventListener('change', (event) => {
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
    populateDbhOptions();
    populateLogsOptions();
    dbhSelect.addEventListener('change', checkAndSetLogsForDbh);
    checkAndSetLogsForDbh();
    console.log("Dropdowns initialized and initial log check performed.");
    loadAndPromptSessionData();
    console.log("Application initialization complete.");
});

// --- END OF FILE script.js ---
