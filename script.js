// --- START OF FILE script.js ---

// --- Service Worker Registration ---
// This block registers the service worker script ('service-worker.js')
// It should be placed in the same directory as this script and index.html
if ('serviceWorker' in navigator) {
  // Wait until the page is fully loaded before registering the service worker
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then(registration => {
        // Registration was successful
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(err => {
        // Registration failed
        console.log('ServiceWorker registration failed: ', err);
      });
  });
} else {
    // Service workers are not supported by the browser
    console.log('Service Workers not supported by this browser.');
}
// --- End of Service Worker Registration ---


// --- Application Logic (Existing Code) ---
// Wait for the DOM to be fully loaded before running app logic
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
    // NOTE: This data is still only in memory. For true offline data persistence
    // (saving data even after closing the app), you'd need localStorage or IndexedDB.
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
        const logValues = ["0.5", "1", "1.5", "2", "2.5", "3", "3.5", "4", "Cull"];
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
            // Find the placeholder 'li' and ensure it's displayed correctly
            let placeholder = document.getElementById('noEntriesMsg');
            if (!placeholder) {
                placeholder = document.createElement('li');
                placeholder.id = 'noEntriesMsg';
                placeholder.textContent = 'No data submitted yet.';
                 // Add necessary styles if needed, like italic
                 placeholder.style.fontStyle = 'italic';
                 placeholder.style.color = '#6c757d';
                 placeholder.style.textAlign = 'center';
                 placeholder.style.border = 'none';
                 placeholder.style.backgroundColor = 'transparent';
            }
            // Ensure the placeholder is the only thing in the list
            entriesList.innerHTML = ''; // Clear again just in case
            entriesList.appendChild(placeholder);

            saveCsvBtn.disabled = true;
            deleteBtn.disabled = true;
        } else {
             // Ensure the placeholder is removed if present
             const placeholder = document.getElementById('noEntriesMsg');
             if (placeholder) {
                 placeholder.remove();
             }

            // Display entries in reverse chronological order (newest first)
            for (let i = collectedData.length - 1; i >= 0; i--) {
                const entry = collectedData[i];
                const listItem = document.createElement('li');

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = entry.id; // Use ID for potential deletion tracking
                checkbox.setAttribute('data-id', entry.id); // Store id in data attribute

                // Display entry details
                const textNode = document.createTextNode(` Plot: ${entry.plotNumber}, DBH: ${entry.dbh}, Species: ${entry.species}, Logs: ${entry.logs}`);

                listItem.appendChild(checkbox);
                listItem.appendChild(textNode);
                entriesList.appendChild(listItem);
            }
            saveCsvBtn.disabled = false;
            // Disable delete button initially until a checkbox is checked
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
            id: Date.now(), // Use timestamp as a simple unique ID
            plotNumber: plotNumberSelect.value,
            dbh: dbhSelect.value,
            species: speciesSelect.value,
            logs: logsSelect.value
        };

        collectedData.push(newEntry);
        renderEntries(); // Update the list display

        // Optional: Log to console for debugging
        console.log("Entry Added:", newEntry);
        console.log("Collected Data:", collectedData);
    });

    // --- Save CSV Button Handler ---
    saveCsvBtn.addEventListener('click', () => {
        if (collectedData.length === 0) {
            alert("No data to save.");
            return;
        }

        // Define CSV header
        let csvContent = "PlotNumber,DBH,Species,Logs\n"; // Updated CSV Header

        // Add each data entry as a row
        collectedData.forEach(entry => {
            csvContent += `${entry.plotNumber},${entry.dbh},${entry.species},${entry.logs}\n`;
        });

        // Create a Blob and download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        // Generate timestamp for filename
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[-T:]/g, "");
        link.setAttribute("href", url);
        link.setAttribute("download", `TreeData_${timestamp}.csv`);
        link.style.visibility = 'hidden';

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Clean up URL object
    });

    // --- Delete Button Handler ---
    deleteBtn.addEventListener('click', () => {
        const checkboxes = entriesList.querySelectorAll('input[type="checkbox"]:checked');
        const idsToDelete = new Set(); // Use a Set for efficient lookup

        checkboxes.forEach(cb => {
            // Get the ID stored in the data-id attribute
            const id = parseInt(cb.getAttribute('data-id'), 10);
            if (!isNaN(id)) { // Ensure it's a valid number
                 idsToDelete.add(id);
            }
        });

        if (idsToDelete.size === 0) {
            alert("No entries selected for deletion.");
            return;
        }

        // Filter out the entries whose IDs are in the Set
        collectedData = collectedData.filter(entry => !idsToDelete.has(entry.id));
        renderEntries(); // Update the list display

        console.log("Entries deleted. Remaining data:", collectedData);
    });

     // --- Enable/Disable Delete Button Based on Checkbox Clicks ---
     // Use event delegation on the list itself for efficiency
     entriesList.addEventListener('change', (event) => {
         // Check if the changed element was a checkbox
         if (event.target.type === 'checkbox') {
             // Enable delete button only if at least one checkbox is checked
             deleteBtn.disabled = !isAnyCheckboxChecked();
         }
     });

    // --- Initial Setup ---
    // Populate dropdowns when the DOM is ready
    populatePlotNumberOptions();
    populateDbhOptions();
    populateLogsOptions();
    // Render the initial state of the entries list (likely empty)
    renderEntries();
});

// --- END OF FILE script.js ---
