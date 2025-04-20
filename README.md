# Tree Data Collector PWA

A simple Progressive Web App (PWA) designed for offline-first collection of tree inventory data, including species, diameter at breast height (DBH), log count, cut status, optional notes, and GPS location.

## Purpose

This application allows users, such as foresters or researchers, to quickly record tree data in the field, even without an internet connection. The data is stored locally and can be exported as a CSV file when needed.

## Features

*   **Offline First:** Uses a Service Worker to cache application files, allowing it to load and function without network access.
*   **Data Entry:** Simple form with dropdowns for Species, DBH, and Logs, plus a checkbox for 'Cut' status and a textarea for notes.
*   **Plot Counter:** Easily increment/decrement the current plot number (1-99).
*   **GPS Location:** Capture the device's current latitude and longitude with a button press.
*   **Recent Entries List:** Displays submitted entries in reverse chronological order.
*   **Entry Deletion:** Select and delete unwanted entries from the list.
*   **Data Tally View:** Provides a summarized count of trees grouped by Species, DBH, and Logs.
*   **CSV Export:** Save all collected raw data *and* the summarized tally data into a single downloadable CSV file.
*   **Session Recovery:** If the browser/tab is closed unexpectedly, the app prompts to recover unsaved data from the previous session upon reopening (uses `localStorage`).

## Files

*   **`index.html`**: The main structure and content of the web application.
*   **`style.css`**: Stylesheet for the application's appearance and layout.
*   **`script.js`**: Contains all the JavaScript logic for:
    *   Populating dropdowns.
    *   Handling user input and form submissions.
    *   Managing the plot counter.
    *   Fetching GPS location.
    *   Displaying, deleting, and storing entry data (`localStorage`).
    *   Generating the data tally.
    *   Creating and downloading the CSV file.
    *   Switching between entry and tally views.
    *   Registering the Service Worker.
*   **`manifest.json`**: Web App Manifest file, enabling PWA features like "Add to Home Screen" and defining app metadata.
*   **`service-worker.js`**: Manages caching of app files for offline use and intercepts network requests.
*   **`icon.png`**: Application icon used in the manifest.

## How to Use

1.  **Load the App:** Open `index.html` in a modern web browser (Chrome, Firefox, Edge, Safari).
2.  **Install (Optional):** On supported browsers/devices, you may be prompted to "Add to Home Screen" or "Install App" for a more native-like experience.
3.  **Recover Data (If Prompted):** If unsaved data from a previous session is found, you'll be asked if you want to recover it.
4.  **Set Plot Number:** Use the `+` and `-` buttons to set the current plot number.
5.  **Enter Tree Data:**
    *   Select Species, DBH, and Logs from the dropdowns.
    *   *(Note: Logs will automatically be set to '0' if DBH is 10 or less).*
    *   Check the "Cut" box if applicable.
    *   Optionally, click "Get Location" to record GPS coordinates (requires location permission).
    *   Optionally, add notes in the text area.
6.  **Submit:** Click "Submit Entry". The entry will appear in the "Recent Entries" list.
7.  **View Tally:** Click "View Tally" to see a summary of the collected data. Click "Back to Data Entry" to return.
8.  **Delete Entries:** Check the box(es) next to entries in the list and click "Delete Selected". Confirm the deletion.
9.  **Save Data:** Click "Save CSV File". This will generate and download a `.csv` file containing both the raw entries and the tally summary. **Saving the CSV will also clear the current session data.**

## Notes

*   The "Share Data" functionality (using the Web Share API) was previously implemented but has been removed in the current version.
*   Session recovery relies on browser `localStorage`. Clearing browser data will remove any unsaved session information. Saving the CSV is the primary way to permanently store data.
*   GPS accuracy depends on the device and environmental factors.
