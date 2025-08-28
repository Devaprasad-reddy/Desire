let allData = [];
let isDataLoaded = false;
let currentDataSource = 'telangana'; // 'telangana' or 'aiq'

// Load all JSON files using manifest
async function loadDataInternal() {
    // Check for cached data first
    const cached = localStorage.getItem(`desireDataCache_${currentDataSource}`);
    if (cached) {
        try {
            const cacheData = JSON.parse(cached);
            const cacheAge = Date.now() - cacheData.timestamp;
            
            // Use cache if less than 24 hours old
            if (cacheAge < 24 * 60 * 60 * 1000) {
                allData = cacheData.data; // This will be specific to the cached source
                isDataLoaded = true;
                populateDropdowns();
                loadSearchState();
                document.getElementById('dataContent').innerHTML = '<div class="loading">Data loaded from cache! Use filters above to search.</div>';
                return;
            }
        } catch (e) {
            console.log('Cache invalid, loading fresh data');
        }
    }
    
    // Show loading spinner
    showLoadingSpinner();
    
    const dataContent = document.getElementById('dataContent');
    dataContent.innerHTML = '<div class="loading">Loading counselling data...</div>';
    
    try {
        // Load manifest with error handling for GitHub Pages
        const manifestResponse = await fetch('./data_manifest.json');
        if (!manifestResponse.ok) {
            throw new Error(`Failed to load manifest: ${manifestResponse.status}`);
        }
        const manifest = await manifestResponse.json();
        
        // Load counselling data with cache busting
        const filesToLoad = manifest.counsellingFiles.filter(file => 
            currentDataSource === 'telangana' ? (file.category === 'CQ' || file.category === 'MQ') : file.category === 'AIQ'
        );
        const cacheBuster = Date.now(); // Cache buster for fresh load
        for (const fileInfo of filesToLoad) {
            try {
                const response = await fetch(`./${fileInfo.path}?v=${cacheBuster}`);
                if (response.ok) {
                    const data = await response.json();
                    processData(data, fileInfo);
                }
            } catch (error) {
                console.log(`Could not load ${fileInfo.path}:`, error);
            }
        }
        
        // Remove duplicates after all files are loaded
        const uniqueData = [];
        const seen = new Set();
        
        // Sort by phase descending to prioritize later phases
        allData.sort((a, b) => {
            const phaseA = getPhaseValue(a.phase);
            const phaseB = getPhaseValue(b.phase);
            return phaseB - phaseA; // Higher phase value first
        });
        
        for (const candidate of allData) {
            // A candidate is unique by their rank in a given year.
            const key = `${candidate.rank}_${candidate.year}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueData.push(candidate);
            }
        }
        
        allData = uniqueData;
        console.log(`Loaded ${allData.length} unique candidates after deduplication`);
        
        // Debug rank 19566 after deduplication
        const rank19566 = allData.filter(c => c.rank === 19566);
        console.log(`Rank 19566 instances after deduplication:`, rank19566.length);
        rank19566.forEach(c => {
            console.log(`  ${c.year} ${c.category}: ${c.college} -> ${c.course} (${c.phase})`);
        });
        
        isDataLoaded = true;
        populateDropdowns();
        
        // Cache data in localStorage for faster subsequent loads
        try {
            localStorage.setItem(`desireDataCache_${currentDataSource}`, JSON.stringify({
                data: allData,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.log('Could not cache data:', e);
        }
        
        // Restore last search state
        loadSearchState();
        
        dataContent.innerHTML = '<div class="loading">Data loaded successfully! Use filters above to search.</div>';
        
        // Hide loading spinner
        hideLoadingSpinner();
        
    } catch (error) {
        console.error('Could not load manifest:', error);
        dataContent.innerHTML = '<div class="error">Could not load data. Please ensure data_manifest.json exists.</div>';
        
        // Hide loading spinner on error
        hideLoadingSpinner();
    }
}

async function toggleDataSource(source) {
    currentDataSource = source;
    
    // Update active class on labels and toggle switch
    document.getElementById('telanganaLabel').classList.toggle('active', source === 'telangana');
    document.getElementById('allIndiaLabel').classList.toggle('active', source === 'aiq');
    document.getElementById('dataSourceToggle').classList.toggle('active', source === 'aiq');
 
    // Clear existing data and results
    allData = [];
    isDataLoaded = false;
    document.getElementById('dataContent').innerHTML = '';
    document.getElementById('resultCount').textContent = '';
 
    // Adjust filter visibility
    document.getElementById('specialFilter').style.display = 'block';
    document.getElementById('minCheckbox').parentElement.style.display = source === 'telangana' ? 'flex' : 'none';
    document.getElementById('phCheckbox').parentElement.style.display = 'flex';
    document.getElementById('femaleQuotaFilter').style.display = source === 'telangana' ? 'block' : 'none';
    // Show new filters only for Telangana data
    document.getElementById('localStatusFilter').style.display = source === 'telangana' ? 'block' : 'none';
    document.getElementById('meritStatusFilter').style.display = source === 'telangana' ? 'block' : 'none';

    document.getElementById('courseTypeSection').style.display = source === 'aiq' ? 'block' : 'none';
    
    // Category filters are now dynamic, so we always show the section
    document.getElementById('categoryFilterSection').style.display = 'block';
 
    // Clear and repopulate dynamic filters
    document.getElementById('quotaToggles').innerHTML = '';
    document.getElementById('collegeToggles').innerHTML = '';
    document.getElementById('courseToggles').innerHTML = '';
    document.getElementById('categoryToggles').innerHTML = ''; // Clear dynamic categories
    
    // Reset search inputs
    document.getElementById('collegeSearch').value = '';
    document.getElementById('courseSearch').value = '';
    
    // Load data for the selected source
    await loadDataInternal();
    
    loadSearchState(); // Load state after dropdowns are populated and data source is set
    saveSearchState(); // Save the new data source state
}

function showLoadingSpinner() {
    const spinner = document.createElement('div');
    spinner.id = 'loadingSpinner';
    spinner.innerHTML = `
        <div class="spinner-overlay">
            <div class="spinner"></div>
            <p>Loading counselling data...</p>
        </div>
    `;
    document.body.appendChild(spinner);
}

function hideLoadingSpinner() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        spinner.remove();
    }
}

function normalizeCourse(courseName) {
    // Extract course code and normalize based on it
    const codeMatch = courseName.match(/^([A-Z]+)\s*\((\d+)\)/);
    if (!codeMatch) return courseName;
    
    const [, code, number] = codeMatch;
    const courseKey = `${code}(${number.padStart(3, '0')})`;
    
    const normalizedNames = {
        'ENT(017)': 'ENT (017) - MS(ENT)',
        'PM(004)': 'PM (004) - MD(PULMONARY MEDICINE)', 
        'SPM(030)': 'SPM (030) - MD(SPM)',
        'TM(036)': 'TM (036) - MD(TRANSFUSION MEDICINE)',
        'RT(033)': 'RT (033) - MD(RADIO THERAPY)'
    };
    
    return normalizedNames[courseKey] || courseName;
}

function getPhaseValue(phase) {
    if (!phase) return 0;
    const phaseUpper = phase.toUpperCase();
    // Higher number = later phase
    if (phaseUpper.includes('STRAY')) return 5;
    if (phaseUpper.includes('MOPUP') || phaseUpper.includes('MOP UP')) return 4;
    if (phaseUpper.includes('R3') || phaseUpper.includes('P3')) return 3;
    if (phaseUpper.includes('R2') || phaseUpper.includes('P2')) return 2;
    if (phaseUpper.includes('R1') || phaseUpper.includes('P1')) return 1;
    const num = parseInt(phaseUpper.replace(/\D/g, ''));
    return isNaN(num) ? 0 : num;
}

function parseAdmDetails(detailsStr) {
    const parts = detailsStr.split('-');
    const result = {
        admissionType: 'Unknown',
        phase: 'Unknown',
        allottedCategory: 'OC', // Default to OC
        gender: 'M', // Default
        isPH: false,
        isMIN: false,
        isMRC: false,
        isLocal: false
    };

    if (!detailsStr || parts.length === 0) return result;

    // First part is admission type
    result.admissionType = parts.shift();

    // Last part is phase
    if (parts.length > 0) {
        result.phase = parts.pop();
    }

    // Handle MQ cases first
    if (result.admissionType.startsWith('MQ')) {
        if (parts.includes('MSM')) {
            result.isMIN = true;
            result.allottedCategory = 'MIN';
        }
        return result;
    }

    // Process remaining parts for NS/S
    const remainingParts = new Set(parts);
    
    // Extract flags and remove them
    if (remainingParts.has('PHO')) {
        result.isPH = true;
        remainingParts.delete('PHO');
    }
    if (remainingParts.has('MSM')) {
        result.isMIN = true;
        remainingParts.delete('MSM');
    }
    if (remainingParts.has('MRC')) {
        result.isMRC = true;
        remainingParts.delete('MRC');
    }
    if (remainingParts.has('LOC')) {
        result.isLocal = true;
        remainingParts.delete('LOC');
    }
    
    // Extract gender and remove
    if (remainingParts.has('FEM')) {
        result.gender = 'F';
        remainingParts.delete('FEM');
    } else if (remainingParts.has('GEN')) {
        result.gender = 'M';
        remainingParts.delete('GEN');
    }

    // What's left in the set should be the category.
    const knownCategories = ['BCA', 'BCB', 'BCC', 'BCD', 'BCE', 'SC', 'ST', 'MIN'];
    let foundCategory = null;
    for (const cat of knownCategories) {
        if (remainingParts.has(cat)) {
            foundCategory = cat;
            break; // Find first specific category
        }
    }

    if (foundCategory) {
        result.allottedCategory = foundCategory;
    } else if (remainingParts.has('OPEN') || remainingParts.has('UNR')) {
        result.allottedCategory = 'OC';
    }

    return result;
}

function processData(jsonData, fileInfo) {
    if (fileInfo.category === 'AIQ') {
        // Handle AIQ flat array structure
        if (!Array.isArray(jsonData)) return; // Guard against wrong format
        for (const candidate of jsonData) {
            const candidateData = {};

            // Map AIQ fields to our internal model
            candidateData.rank = candidate.Rank;
            candidateData.college = candidate.Institute;
            candidateData.course = normalizeCourse(candidate.Course);
            candidateData.admissionType = (candidate.Quota || '').replace('Managemen t', 'Management'); // Fix typo
            candidateData.remarks = candidate.Remarks;
            candidateData.allottedCategory = candidate.AllottedCategory;
             candidateData.year = fileInfo.year;
            candidateData.category = fileInfo.category; // 'AIQ'
            candidateData.fileName = fileInfo.path;
             let phase = '';
            const remarkMatch = candidate.Remarks?.match(/(\d+)(?:st|nd|rd|th) Round/i);
            if (remarkMatch) {
                phase = `R${remarkMatch[1]}`;
            } else if (candidate.Remarks?.toUpperCase().includes('UPGRADED')) {
                phase = 'Upgraded';
            }
            if (!phase) {
                const fileMatch = fileInfo.path.match(/(R\d+|MOPUP|STRAY)/i);
                if (fileMatch) {
                    phase = fileMatch[0].toUpperCase();
                }
            }
            candidateData.phase = phase;
             const allottedCat = (candidate.AllottedCategory || '').toUpperCase();
            candidateData.isPH = allottedCat.includes('PWD');
            candidateData.isMIN = false; // Not applicable for AIQ
            candidateData.gender = 'M'; // Not available in AIQ data
             candidateData.candidateCategory = allottedCat.replace('-PWD', '').trim();

            allData.push(candidateData);
        }
    } else if (fileInfo.category === 'CQ' || fileInfo.category === 'MQ') {
        // Handle Telangana flat array structure
        if (!Array.isArray(jsonData)) return; // Guard against wrong format
        for (const candidate of jsonData) {
            const parsedDetails = parseAdmDetails(candidate.adm_details);

            const candidateData = {
                rank: candidate.rank,
                college: candidate.college,
                course: normalizeCourse(candidate.course),
                adm_details: candidate.adm_details, // Store the original string
                year: fileInfo.year,
                category: fileInfo.category,
                fileName: fileInfo.path,
                ...parsedDetails // Spread the parsed details
            };
            
            // The `allottedCategory` from the parser is now the `candidateCategory`
            candidateData.candidateCategory = candidateData.allottedCategory;

            allData.push(candidateData);
        }
    }
}

let allColleges = [];
let allCourses = [];
let allCategories = [];

function getQuotaDescription(admissionType) {
    const descriptions = {
        'NS': 'NS (Regular)',
        'S': 'S (In-Service)',
        'MQ1': 'MQ1 (B Category)',
        'MQ2': 'MQ2 (C Category)',
        'MQ3': 'MQ3 (NRI/Institutional)'
    };
    return descriptions[admissionType] || admissionType;
}

function getGenderDisplay(gender) {
    if (gender === 'F') return 'FEM';
    return 'GEN'; // Default for 'M' or undefined
}

function getCollegeAbbreviation(collegeName) {
    // Extract abbreviation from college name like "GAND(010) - GANDHI MEDICAL COLLEGE"
    const match = collegeName.match(/^([A-Z]+)\(\d+\)/);
    return match ? match[1] : collegeName.substring(0, 4).toUpperCase();
}

function populateDropdowns() {
    // Get unique colleges, courses, and admission types
    allColleges = [...new Set(allData.map(item => item.college))].sort();
    
    allCourses = [...new Set(allData.map(item => item.course))].sort((a, b) => {
        const codeA = a.match(/\((\d+)\)/)?.[1] || '999';
        const codeB = b.match(/\((\d+)\)/)?.[1] || '999';
        return parseInt(codeA) - parseInt(codeB);
    });
    
    // Get unique categories from the data itself
    // Filter out 'MIN' as it has its own special filter
    allCategories = [...new Set(allData.map(item => item.candidateCategory).filter(cat => cat && cat !== 'MIN'))].sort((a, b) => {
        if (a === 'OC') return -1; // 'OC' (OPEN) always comes first
        if (b === 'OC') return 1;
        return a.localeCompare(b); // Alphabetical for the rest
    });
    const admissionTypes = [...new Set(allData.map(item => item.admissionType).filter(type => type))].sort();
    
    populateToggles('college', allColleges);
    populateToggles('course', allCourses); // This will populate for both AIQ and Telangana

    // Populate category toggles directly, like quotas, for a plain layout
    const categoryContainer = document.getElementById('categoryToggles');
    categoryContainer.innerHTML = ''; // Clear previous categories
    allCategories.forEach(cat => {
        const label = document.createElement('label');
        label.className = 'toggle';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = cat;
        checkbox.className = 'categoryCheckbox';
        checkbox.checked = true; // Default to checked
        const slider = document.createElement('span');
        slider.className = 'slider';
        // Display 'OPEN' for the 'OC' category value
        const text = document.createTextNode(cat === 'OC' ? 'OPEN' : cat);
        label.appendChild(checkbox);
        label.appendChild(slider);
        label.appendChild(text);
        categoryContainer.appendChild(label);
    });

    // Populate quota toggles with descriptions, NS first
    const quotaContainer = document.getElementById('quotaToggles');
    // Clear previous quotas before populating
    quotaContainer.innerHTML = ''; 
    
    const quotaDescriptions = {
        'NS': 'NS (Regular)',
        'S': 'S (In-Service)',
        'MQ1': 'MQ1 (B Category)',
        'MQ2': 'MQ2 (C Category)', 
        'MQ3': 'MQ3 (NRI/Institutional)'
    };
    
    // Sort to put NS first
    const sortedTypes = admissionTypes.sort((a, b) => {
        if (a === 'NS') return -1;
        if (b === 'NS') return 1;
        return a.localeCompare(b);
    });
    
    sortedTypes.forEach(type => {
        const label = document.createElement('label');
        label.className = 'toggle';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = type;
        checkbox.className = 'quotaCheckbox';
        
        // Check NS by default
        if (type === 'NS') {
            checkbox.checked = true;
        }
        
        const slider = document.createElement('span');
        slider.className = 'slider';
        
        const text = document.createTextNode(quotaDescriptions[type] || type);
        
        label.appendChild(checkbox);
        label.appendChild(slider);
        label.appendChild(text);
        quotaContainer.appendChild(label);
    });
    
    // Initialize event listeners for search inputs only once
    // Check if listeners are already attached to avoid duplicates
    if (!document.getElementById('collegeSearch')._hasEventListener) {
        document.getElementById('collegeSearch').addEventListener('input', (e) => {
            filterCheckboxes('college', e.target.value);
        });
        document.getElementById('collegeSearch')._hasEventListener = true;
    }
    if (!document.getElementById('courseSearch')._hasEventListener) {
        document.getElementById('courseSearch').addEventListener('input', (e) => {
            filterCheckboxes('course', e.target.value);
        });
        document.getElementById('courseSearch')._hasEventListener = true;
    }
}

function populateToggles(type, items) {
    const container = document.getElementById(`${type}Toggles`);
    
    // Add select/clear all buttons
    container.innerHTML = `
        <button class="select-all-btn" onclick="selectAll('${type}')">Select All</button>
        <button class="clear-all-btn" onclick="clearAll('${type}')">Clear All</button>
        <div id="${type}ToggleList"></div>
    `;
    
    const toggleList = document.getElementById(`${type}ToggleList`);
    
    items.forEach(item => {
        const label = document.createElement('label');
        label.className = 'toggle';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = item;
        checkbox.className = `${type}Checkbox`;
        checkbox.checked = true; // Check all by default
        
        const slider = document.createElement('span');
        slider.className = 'slider';
        
        const text = document.createTextNode(item);
        
        label.appendChild(checkbox);
        label.appendChild(slider);
        label.appendChild(text);
        toggleList.appendChild(label);
    });
}

function filterCheckboxes(type, searchTerm) {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const toggleList = document.getElementById(`${type}ToggleList`);
    const labels = toggleList.getElementsByTagName('label');

    Array.from(labels).forEach(label => {
        const itemText = label.textContent || label.innerText;
        if (itemText.toLowerCase().includes(lowerCaseSearchTerm)) {
            label.style.display = 'flex';
        } else {
            label.style.display = 'none';
        }
    });
}

function selectAll(type) {
    document.querySelectorAll(`.${type}Checkbox`).forEach(cb => cb.checked = true);
}

function clearAll(type) {
    document.querySelectorAll(`.${type}Checkbox`).forEach(cb => cb.checked = false);
}

function saveSearchState() {
    const searchState = {
        minRank: document.getElementById('minRank').value,
        maxRank: document.getElementById('maxRank').value,
        years: Array.from(document.querySelectorAll('.yearCheckbox:checked')).map(cb => cb.value),
        quotas: Array.from(document.querySelectorAll('.quotaCheckbox:checked')).map(cb => cb.value),
        categories: Array.from(document.querySelectorAll('.categoryCheckbox:checked')).map(cb => cb.value),
        genders: Array.from(document.querySelectorAll('.genderCheckbox:checked')).map(cb => cb.value),
        minFilter: document.getElementById('minCheckbox').checked,
        phFilter: document.getElementById('phCheckbox').checked,
        // Save new filter states
        localFilter: document.getElementById('localCheckbox').checked,
        unrFilter: document.getElementById('unrCheckbox').checked,
        mrcFilter: document.getElementById('mrcCheckbox').checked,
        sortBy: document.getElementById('sortSelect').value,
        currentDataSource: currentDataSource, // Save current data source
    };
    localStorage.setItem('desireSearchState', JSON.stringify(searchState));
}

function loadSearchState() {
    const saved = localStorage.getItem('desireSearchState');
    if (saved) {
        const state = JSON.parse(saved);
        document.getElementById('minRank').value = state.minRank || '';
        document.getElementById('maxRank').value = state.maxRank || '';
        
        // Restore checkboxes
        document.querySelectorAll('.yearCheckbox').forEach(cb => cb.checked = state.years.includes(cb.value));
        document.querySelectorAll('.quotaCheckbox').forEach(cb => cb.checked = state.quotas.includes(cb.value));
        document.querySelectorAll('.categoryCheckbox').forEach(cb => cb.checked = state.categories.includes(cb.value));
        document.querySelectorAll('.genderCheckbox').forEach(cb => cb.checked = state.genders.includes(cb.value));
        
        document.getElementById('minCheckbox').checked = state.minFilter || false;
        document.getElementById('phCheckbox').checked = state.phFilter || false;
        document.getElementById('sortSelect').value = state.sortBy || 'rank-asc';

        // Restore new filters, defaulting to true if not saved previously
        document.getElementById('localCheckbox').checked = state.localFilter !== false;
        document.getElementById('unrCheckbox').checked = state.unrFilter !== false;
        document.getElementById('mrcCheckbox').checked = state.mrcFilter !== false;
    }
    // Always start with hamburger filters off
    document.getElementById('showOnlyPH').checked = false;
    document.getElementById('showOnlyMIN').checked = false;
}

function searchData() {
    if (!isDataLoaded) {
        alert('Data is still loading. Please wait...');
        return;
    }

    // Grab hamburger filter state at the beginning of the search
    const showOnlyPH = document.getElementById('showOnlyPH').checked;
    const showOnlyMIN = document.getElementById('showOnlyMIN').checked;
    
    saveSearchState();
    
    const minRank = parseInt(document.getElementById('minRank').value) || 0;
    const maxRank = parseInt(document.getElementById('maxRank').value) || Infinity;
    
    // Get selected filters
    const selectedYears = Array.from(document.querySelectorAll('.yearCheckbox:checked')).map(cb => cb.value);
    const selectedQuotas = Array.from(document.querySelectorAll('.quotaCheckbox:checked')).map(cb => cb.value);
    const selectedColleges = Array.from(document.querySelectorAll('.collegeCheckbox:checked')).map(cb => cb.value);
    const selectedCourses = Array.from(document.querySelectorAll('.courseCheckbox:checked')).map(cb => cb.value);
    let selectedCategories = Array.from(document.querySelectorAll('.categoryCheckbox:checked')).map(cb => cb.value);
    
    // Get special filters
    const minFilter = document.getElementById('minCheckbox').checked;
    const phFilter = document.getElementById('phCheckbox').checked;
    const showGen = document.querySelector('.genderCheckbox[value="M"]').checked;
    const showFem = document.querySelector('.genderCheckbox[value="F"]').checked;

    // Get new filter states
    const localFilter = document.getElementById('localCheckbox').checked;
    const unrFilter = document.getElementById('unrCheckbox').checked;
    const mrcFilter = document.getElementById('mrcCheckbox').checked;
    
    // If the MIN special filter is checked, we should also consider candidates
    // with the 'MIN' category. This effectively adds 'MIN' to the list of
    // selected categories for the purpose of this search.
    if (minFilter) {
        selectedCategories.push('MIN');
    }

    let filteredData = allData.filter(candidate => {
        // "Opt-in" filtering: if a filter group has no selections, no results should pass.
        if (selectedYears.length === 0) return false;
        if (!selectedYears.includes(candidate.year)) return false;

        if (selectedQuotas.length === 0) return false;
        if (!selectedQuotas.includes(candidate.admissionType)) return false;

        if (candidate.rank < minRank || candidate.rank > maxRank) return false;

        if (selectedColleges.length === 0) return false;
        if (!selectedColleges.includes(candidate.college)) return false;

        if (selectedCourses.length === 0) return false;
        if (!selectedCourses.includes(candidate.course)) return false;

        const isMQ = ['MQ1', 'MQ2', 'MQ3'].includes(candidate.admissionType);

        if (!isMQ) {
            // Category Check (now includes 'MIN' if minFilter is checked)
            if (selectedCategories.length === 0) return false;
            if (!selectedCategories.includes(candidate.candidateCategory)) return false;

            // Gender Check
            const selectedGenders = [];
            if (showGen) selectedGenders.push('M');
            if (showFem) selectedGenders.push('F');
            if (selectedGenders.length === 0) return false;
            if (candidate.gender && !selectedGenders.includes(candidate.gender)) return false;

            // Special Status Check: A candidate with a special status is only shown if that filter is checked.
            if (candidate.isMIN && !minFilter) return false;
            if (candidate.isPH && !phFilter) return false;
            if (candidate.isMRC && !mrcFilter) return false;

            // Local/UNR Check
            const selectedLocalStatus = [];
            if (localFilter) selectedLocalStatus.push(true);
            if (unrFilter) selectedLocalStatus.push(false);
            if (selectedLocalStatus.length === 0) return false;
            // candidate.isLocal is true for LOC, false for UNR
            if (!selectedLocalStatus.includes(candidate.isLocal)) return false;
        }

        return true;
    });
    
    // Apply hamburger menu filters only if the corresponding main filter is active
    if (showOnlyPH && phFilter && showOnlyMIN && minFilter) {
        filteredData = filteredData.filter(c => c.isPH || c.isMIN);
    } else if (showOnlyPH && phFilter) {
        filteredData = filteredData.filter(c => c.isPH);
    } else if (showOnlyMIN && minFilter) {
        filteredData = filteredData.filter(c => c.isMIN);
    }
    
    // Apply sorting
    const sortBy = document.getElementById('sortSelect').value;
    filteredData = sortResults(filteredData, sortBy);
    
    displayResults(filteredData);

    // Reset hamburger filters after every search
    document.getElementById('showOnlyPH').checked = false;
    document.getElementById('showOnlyMIN').checked = false;
}

function sortResults(data, sortBy) {
    const [field, order] = sortBy.split('-');
    
    return data.sort((a, b) => {
        let aVal, bVal;
        
        switch(field) {
            case 'rank':
                aVal = a.rank;
                bVal = b.rank;
                break;
            case 'year':
                aVal = parseInt(a.year);
                bVal = parseInt(b.year);
                break;
            case 'college':
                aVal = a.college;
                bVal = b.college;
                break;
            default:
                aVal = a.rank;
                bVal = b.rank;
        }
        
        if (typeof aVal === 'string') {
            return order === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        } else {
            return order === 'asc' ? aVal - bVal : bVal - aVal;
        }
    });
}

function displayResults(data) {
    const dataContent = document.getElementById('dataContent');
    const countDiv = document.getElementById('resultCount');
    
    countDiv.textContent = `Found ${data.length.toLocaleString()} results`;
    
    if (data.length === 0) {
        dataContent.innerHTML = '<div class="loading">No results found. Try adjusting your filters.</div>';
        return;
    }
    
    // Limit to first 200 results for performance
    const displayData = data.slice(0, 200);
    if (data.length > 200) {
        countDiv.textContent += ` (showing first 200)`;
    }
    
    // Group by college
    const groupedData = {};
    displayData.forEach(candidate => {
        if (!groupedData[candidate.college]) {
            groupedData[candidate.college] = [];
        }
        groupedData[candidate.college].push(candidate);
    });
    
    dataContent.innerHTML = Object.entries(groupedData).map(([college, candidates]) => {
        const candidateItems = candidates.map(candidate => {
            let detailsString = '';
            const tagParts = [];

            if (candidate.category === 'AIQ') {
                // AIQ Logic: Keep the existing format
                const detailsArray = [
                    candidate.allottedCategory,
                    getQuotaDescription(candidate.admissionType),
                    candidate.phase
                ].filter(Boolean);
                detailsString = detailsArray.join(' | ');
                if (candidate.isPH) tagParts.push('<span class="tag-ph">PH</span>');

            } else { // Telangana (CQ/MQ) Logic
                if (candidate.adm_details) {
                    // Show the raw adm_details string with inline styling for special parts
                    detailsString = candidate.adm_details.split('-').map(part => {
                        switch(part) {
                            case 'FEM': return `<span class="detail-fem">${part}</span>`;
                            case 'S': return `<span class="tag-service">${part}</span>`;
                            case 'MRC': return `<span class="tag-mrc">${part}</span>`;
                            case 'MSM': return `<span class="tag-min">${part}</span>`;
                            case 'UNR': return `<span class="detail-unr">${part}</span>`;
                            case 'PHO': return `<span class="tag-ph">${part}</span>`;
                            default: return part;
                        }
                    }).join('-');
                } else {
                    // Fallback for older Telangana data without adm_details
                    const detailsArray = [
                        candidate.candidateCategory,
                        getGenderDisplay(candidate.gender),
                        getQuotaDescription(candidate.admissionType),
                        candidate.phase
                    ].filter(Boolean);
                    detailsString = detailsArray.map(part => (part === 'FEM') ? `<span class="detail-fem">${part}</span>` : part).join(' | ');
                }
            }

            // Common tag logic for all data types (like stray from filename)
            if (candidate.fileName && candidate.fileName.toLowerCase().includes('stray')) tagParts.push('<span class="tag-stray">STRAY</span>');

            return `
                <div class="candidate-item">
                    <div class="candidate-rank">
                        <a href="#" onclick="showRankHistory(${candidate.rank}, '${candidate.year}', '${candidate.category}'); return false;">
                            ${candidate.rank.toLocaleString()}
                        </a>
                    </div>
                    <div class="candidate-info">
                        <div class="candidate-course">${candidate.course}</div>
                        <div class="candidate-year">Year: 20${candidate.year}</div>
                        <div class="candidate-details">
                            ${detailsString}
                        </div>
                        ${tagParts.length > 0 ? `<div class="candidate-tags">${tagParts.join('')}</div>` : ''}
                    </div>
                </div>
            `;
        }).join('');
        
        return `
            <div class="college-group">
                <div class="college-header">${college}</div>
                ${candidateItems}
            </div>
        `;
    }).join('');
}

function toggleHamburgerMenu(event) {
    event.stopPropagation();
    document.getElementById('hamburgerContent').parentElement.classList.toggle('show');
}

function refreshData() {
    console.log('Refreshing data and clearing cache...');
    
    // Clear local storage cache for both data sources to ensure a fresh fetch
    localStorage.removeItem('desireDataCache_telangana');
    localStorage.removeItem('desireDataCache_aiq');
    
    // Reset internal state before reloading
    allData = [];
    isDataLoaded = false;
    
    // Call the main data loading function. It will handle showing the spinner,
    // fetching data, populating filters, and restoring the search state.
    loadDataInternal();
}

function clearFilters() {
    document.getElementById('minRank').value = '';
    document.getElementById('maxRank').value = '';
    document.getElementById('collegeSearch').value = '';
    document.getElementById('courseSearch').value = '';
    
    // Reset data source to default (Telangana)
    if (currentDataSource !== 'telangana') {
        toggleDataSource('telangana');
    }
    // Clear all checkboxes
    document.querySelectorAll('.yearCheckbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.quotaCheckbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.categoryCheckbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.genderCheckbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.collegeCheckbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.courseCheckbox').forEach(cb => cb.checked = false);
    document.getElementById('minCheckbox').checked = false;
    document.getElementById('phCheckbox').checked = false;
    document.getElementById('localCheckbox').checked = true;
    document.getElementById('unrCheckbox').checked = true;
    document.getElementById('mrcCheckbox').checked = true;


    // Clear hamburger filters
    document.getElementById('showOnlyPH').checked = false;
    document.getElementById('showOnlyMIN').checked = false;
    
    // Reset search filters by showing all toggles
    if (allColleges.length > 0) filterCheckboxes('college', '');
    if (allCourses.length > 0) filterCheckboxes('course', '');
    
    const dataContent = document.getElementById('dataContent');
    const countDiv = document.getElementById('resultCount');
    
    dataContent.innerHTML = '<div class="loading">Use filters above to search through the data.</div>';
    countDiv.textContent = '';
}

function showRankHistory(rank, year, category) {
    // Find all instances of this rank in the same year/category
    const rankHistory = [];
    
    // Get manifest and load all files to find history
    fetch('./data_manifest.json')
        .then(response => response.json())
        .then(async manifest => {
            const filesToSearch = manifest.counsellingFiles.filter(f => f.year === year && f.category === category);

            for (const fileInfo of filesToSearch) {
                try {
                    const response = await fetch(`./${fileInfo.path}`);
                    if (response.ok) {
                        const data = await response.json();
                        
                        if (Array.isArray(data)) { // AIQ data
                            const candidates = data.filter(c => c.Rank === rank);
                            for (const candidate of candidates) {
                                rankHistory.push({
                                    phase: fileInfo.phase || '', // Get phase from manifest
                                    college: candidate.Institute,
                                    course: normalizeCourse(candidate.Course),
                                    fileName: fileInfo.path,
                                    admissionType: candidate.Quota
                                });
                            }
                        } else if (data && data.colleges) { // Telangana data
                            // Search for the rank in this file
                            for (const [collegeName, courses] of Object.entries(data.colleges)) {
                                for (const [courseName, candidates] of Object.entries(courses)) {
                                    const candidate = candidates.find(c => c.rank === rank);
                                    if (candidate) {
                                        rankHistory.push({
                                            phase: candidate.phase,
                                            college: collegeName, // College name is already correct
                                            course: normalizeCourse(courseName),
                                            fileName: data.fileName,
                                            admissionType: candidate.admissionType
                                        });
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.log(`Error loading ${fileInfo.path} for history:`, error);
                }
            }
            
            // Sort by phase
            rankHistory.sort((a, b) => {
                const phaseA = getPhaseValue(a.phase);
                const phaseB = getPhaseValue(b.phase);
                return phaseA - phaseB;
            });
            
            // Display history
            displayRankHistory(rank, year, category, rankHistory);
        });
}

function displayRankHistory(rank, year, category, history) {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0,0,0,0.5); z-index: 1000; display: flex;
        align-items: center; justify-content: center;
    `;
    
    const content = document.createElement('div');
    content.style.cssText = `
        background: white; padding: 20px; border-radius: 8px;
        max-width: 600px; max-height: 80%; overflow-y: auto;
    `;
    
    const historyHtml = history.length > 0 ? 
        history.map(h => `
            <div style="margin: 10px 0; padding: 10px; border-left: 3px solid #007cba;">
                <strong>${h.phase || 'Unknown'}</strong> - ${h.admissionType || 'NS'}<br>
                <small style="color: #666;">${h.college}</small><br>
                <small style="color: #007cba;">${h.course}</small><br>
                <small style="color: #999;">${h.fileName}</small>
            </div>
        `).join('') : 
        '<p>No counselling history found for this rank.</p>';
    
    content.innerHTML = `
        <h3>Rank ${rank.toLocaleString()} History (20${year} ${category})</h3>
        ${historyHtml}
        <button onclick="this.parentElement.parentElement.remove()" 
                style="margin-top: 15px; padding: 8px 16px; background: #007cba; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Close
        </button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    // Close on background click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
}

// Legacy function for backward compatibility
// function filterData() { // This function is no longer needed as searchData is called directly
//     searchData();
// }

// Load data when page loads
window.addEventListener('load', () => {
    // Load saved search state first to set currentDataSource
    loadSearchState(); 
    // Initialize data source toggle event listener and trigger initial data load
    document.getElementById('dataSourceToggle').addEventListener('click', () => {
        toggleDataSource(currentDataSource === 'telangana' ? 'aiq' : 'telangana');
    });
    toggleDataSource(currentDataSource); // Trigger initial data load and UI setup based on currentDataSource

    // Close hamburger menu if clicking outside
    window.addEventListener('click', () => {
        const menu = document.querySelector('.hamburger-menu.show');
        if (menu) {
            menu.classList.remove('show');
        }
    });
});