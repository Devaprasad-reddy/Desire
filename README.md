# Desire - NEET PG Medical Counselling Data Explorer

A client-side web application designed to help medical aspirants search, filter, and analyze historical counselling data for both Telangana State Quota and All India Quota (AIQ). This tool provides a powerful and intuitive interface to explore admission trends, cutoff ranks, and seat allocation across various colleges, courses, and categories.

## ✨ Features

- **Dual Data Sources**: Seamlessly switch between **Telangana (CQ/MQ)** and **All India (AIQ)** counselling data. The UI and available filters dynamically adapt to the selected source.
- **Powerful Filtering**:
  - Filter by **Rank Range** (Minimum and Maximum).
  - Select specific **Years** of data.
  - Search and toggle specific **Colleges** and **Courses**.
  - Filter by **Admission Quota** (e.g., NS, MQ1, AIQ, Management).
  - Filter by **Candidate Category** (e.g., OC, BCA, SC, ST, EWS).
  - Apply special filters for **PH (Physically Handicapped)**, **Minority**, **Gender**, **Local/UNR Status**, and **MRC (Meritorious Reserved Candidate)**.
- **Instant Search**: A live search box allows you to quickly find and filter the lists of colleges and courses.
- **Smart Results Display**:
  - Results are grouped by college for easy reading.
  - Special admission details (like `FEM`, `MRC`, `PHO`) are highlighted directly in the results.
  - Results can be sorted by Rank, Year, or College.
- **Rank History**: Click on any rank in the results to open a modal showing the complete counselling journey for that rank in that year, from initial allotment to final upgrades.
- **Client-Side Caching**: Data is cached in the browser's `localStorage` for 24 hours, enabling near-instant loads on subsequent visits.
- **State Persistence**: Your filter selections are automatically saved and restored on page reload, allowing you to pick up right where you left off.
- **Easy Data Management**:
  - A **Refresh Data** button allows you to clear the cache and fetch the latest data from the server.
  - A **Clear Filters** button quickly resets all selections to their default state.

## 🚀 How to Use

1.  **Select Data Source**: Use the toggle at the top to choose between "Telangana" and "All India" data. The application will automatically load the relevant dataset.
2.  **Apply Filters**:
    - Enter a **Min/Max Rank** to narrow down the search.
    - Use the toggle buttons to select the **Years**, **Quotas**, **Categories**, and other attributes you are interested in.
    - For **Colleges** and **Courses**, you can use the search box above each list to quickly find items, then use the checkboxes to select them. Use the "Select All" / "Clear All" buttons for bulk actions.
3.  **Search**: Click the "Search" button to view the results.
4.  **Analyze Results**:
    - The results will appear below, grouped by college.
    - The number of results found is displayed at the top. For performance, a maximum of 200 results are shown at a time.
    - To see the history of a specific rank, simply click on the rank number.

## 🛠️ Technical Details

This is a pure client-side application built with **vanilla HTML, CSS, and JavaScript**. It does not require a backend server for its core logic.

- **Data Loading**: The application uses a `data_manifest.json` file to discover and load all the necessary counselling data files. This makes it easy to add new data just by updating the manifest and adding the corresponding JSON file.
- **Data Processing**: All data is loaded into memory, de-duplicated, and processed in the browser. The de-duplication logic prioritizes later counselling rounds (e.g., a Mop-Up round result for a rank will replace a Round 1 result for the same rank).
- **Local Server Requirement**: Because the application uses the `fetch()` API to load local JSON files, it must be run through a local web server (like VS Code's **Live Server** extension) to avoid CORS (Cross-Origin Resource Sharing) errors. Simply opening the `index.html` file directly from the filesystem will not work.

## 📁 Project Structure

```
/
├── index.html              # The main HTML file
├── style.css               # All styles for the application
├── script.js               # Core application logic, data processing, and UI handling
├── data_manifest.json      # Manifest file listing all data sources
└── data/                   # Directory containing all the JSON data files
    ├── ts_cq_23.json
    ├── ts_mq_23.json
    ├── aiq_r1_23.json
    └── ...                 # etc.
```

### `data_manifest.json` Format

This file is an array of objects, where each object describes a data file.

```json
[
  {
    "path": "data/ts_cq_23.json",
    "year": "23",
    "category": "CQ",
    "phase": "Phase 1"
  },
  {
    "path": "data/aiq_r1_23.json",
    "year": "23",
    "category": "AIQ",
    "phase": "R1"
  }
]
```

### Counselling Data Format

#### Telangana (CQ/MQ) Data (`.json`)

The Telangana data is an array of candidate objects.

```json
[
  {
    "rank": 1234,
    "college": "GAND(010) - GANDHI MEDICAL COLLEGE",
    "course": "ANA(001) - MD(ANAESTHESIOLOGY)",
    "adm_details": "NS-BCA-FEM-LOC-P1"
  }
]
```

#### All India (AIQ) Data (`.json`)

The AIQ data is also an array of candidate objects, but with a different structure. The `script.js` file normalizes this into the application's internal data model.

```json
[
  {
    "Rank": 5678,
    "AllottedCategory": "UR",
    "Institute": "Gandhi Medical College, Secunderabad",
    "Course": "MD (GENERAL MEDICINE)",
    "Quota": "All India",
    "Remarks": "Allotted in 1st Round"
  }
]
```