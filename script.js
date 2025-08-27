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
                    processData(data);
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
            const phaseA = parseInt(a.phase?.replace('P', '') || '0');
            const phaseB = parseInt(b.phase?.replace('P', '') || '0');
            return phaseB - phaseA;
        });
        
        for (const candidate of allData) {
            const key = `${candidate.rank}_${candidate.year}_${candidate.category}`;
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
    document.getElementById('specialFilter').style.display = source === 'telangana' ? 'block' : 'none';
    document.getElementById('femaleQuotaFilter').style.display = source === 'telangana' ? 'block' : 'none';
    document.getElementById('courseTypeSection').style.display = source === 'aiq' ? 'block' : 'none';
    
    // Hide/show category filter based on source (AIQ has different categories)
    document.getElementById('categoryFilterSection').style.display = source === 'telangana' ? 'block' : 'none';

    // Clear and repopulate dynamic filters
    document.getElementById('quotaToggles').innerHTML = '';
    document.getElementById('collegeToggles').innerHTML = '';
    document.getElementById('courseToggles').innerHTML = '';
    
    // Reset search inputs
    document.getElementById('collegeSearch').value = '';
    document.getElementById('courseSearch').value = '';

    if (source === 'telangana') {
        await loadDataInternal();
        populateDropdowns();
        document.getElementById('dataContent').innerHTML = '<div class="loading">Data loaded for Telangana. Use filters above to search.</div>';
    } else { // AIQ mode
        // For AIQ, we'll display a "Coming soon" message and not load data yet
        document.getElementById('dataContent').innerHTML = '<div class="loading">Coming soon... AIQ data and filters are under development.</div>';
        populateDropdowns(); // Still populate with empty data to show filter structure
    }
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

function processData(jsonData) {
    // First normalize the course structure
    const normalizedColleges = {};
    
    for (const [collegeName, courses] of Object.entries(jsonData.colleges)) {
        normalizedColleges[collegeName] = {};
        
        for (const [courseName, candidates] of Object.entries(courses)) {
            const normalizedCourseName = normalizeCourse(courseName);
            
            // Merge candidates if normalized course already exists
            if (!normalizedColleges[collegeName][normalizedCourseName]) {
                normalizedColleges[collegeName][normalizedCourseName] = [];
            }
            normalizedColleges[collegeName][normalizedCourseName].push(...candidates);
        }
    }
    
    // Now process the normalized structure
    for (const [collegeName, courses] of Object.entries(normalizedColleges)) {
        for (const [courseName, candidates] of Object.entries(courses)) {
            for (const candidate of candidates) {
                const candidateData = {
                    ...candidate,
                    college: collegeName,
                    course: courseName,
                    year: jsonData.year,
                    category: jsonData.category,
                    fileName: jsonData.fileName
                };
                
                // Normalize and add missing properties for consistent filtering
                const allottedCat = (candidate.allottedCategory || '').toUpperCase();
                const allottedGen = (candidate.allottedGender || '').toUpperCase();

                // 1. Set gender ('M' or 'F')
                candidateData.gender = allottedGen.includes('FEM') ? 'F' : 'M';

                // 2. Set special flags for PH (Physically Handicapped) and MIN (Minority)
                candidateData.isPH = allottedGen.includes('PHO');
                candidateData.isMIN = allottedCat === 'MIN';

                // 3. Set a unified candidateCategory for filtering
                candidateData.candidateCategory = (allottedCat === 'UNR' || allottedCat === 'OPEN') ? 'OC' : allottedCat;

                // Check for duplicates and keep latest phase
                const existingIndex = allData.findIndex(existing => 
                    existing.rank === candidate.rank && 
                    existing.year === jsonData.year && 
                    existing.category === jsonData.category
                );
                
                if (existingIndex >= 0) {
                    const existing = allData[existingIndex];
                    const currentPhase = parseInt(candidate.phase?.replace('P', '') || '0');
                    const existingPhase = parseInt(existing.phase?.replace('P', '') || '0');
                    
                    // Keep the higher phase (later assignment)
                    if (currentPhase > existingPhase) {
                        allData[existingIndex] = candidateData;
                    }
                    // If same phase, prefer non-stray files
                    else if (currentPhase === existingPhase && !jsonData.fileName.toLowerCase().includes('stray')) {
                        allData[existingIndex] = candidateData;
                    }
                } else {
                    allData.push(candidateData);
                }
            }
        }
    }
}


let allColleges = [];
let allCourses = [];

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
    const admissionTypes = [...new Set(allData.map(item => item.admissionType).filter(type => type))].sort();
    
    populateToggles('college', allColleges);
    populateToggles('course', allCourses); // This will populate for both AIQ and Telangana
    
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
        sortBy: document.getElementById('sortSelect').value,
        currentDataSource: currentDataSource // Save current data source
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
    }
}

function searchData() {
    if (!isDataLoaded) {
        alert('Data is still loading. Please wait...');
        return;
    }
    
    saveSearchState();
    
    const minRank = parseInt(document.getElementById('minRank').value) || 0;
    const maxRank = parseInt(document.getElementById('maxRank').value) || Infinity;
    
    // Get selected filters
    const selectedYears = Array.from(document.querySelectorAll('.yearCheckbox:checked')).map(cb => cb.value);
    const selectedQuotas = Array.from(document.querySelectorAll('.quotaCheckbox:checked')).map(cb => cb.value);
    const selectedColleges = Array.from(document.querySelectorAll('.collegeCheckbox:checked')).map(cb => cb.value);
    const selectedCourses = Array.from(document.querySelectorAll('.courseCheckbox:checked')).map(cb => cb.value);
    const selectedCategories = Array.from(document.querySelectorAll('.categoryCheckbox:checked')).map(cb => cb.value);
    
    // Get special filters
    const minFilter = document.getElementById('minCheckbox').checked;
    const phFilter = document.getElementById('phCheckbox').checked;
    const showGen = document.querySelector('.genderCheckbox[value="M"]').checked;
    const showFem = document.querySelector('.genderCheckbox[value="F"]').checked;
    
    let filteredData = allData.filter(candidate => {
        if (selectedYears.length > 0 && !selectedYears.includes(candidate.year)) return false;
        if (selectedQuotas.length > 0 && !selectedQuotas.includes(candidate.admissionType)) return false;
        if (candidate.rank < minRank || candidate.rank > maxRank) return false;
        if (selectedCategories.length > 0 && !selectedCategories.includes(candidate.candidateCategory)) return false;
        if (selectedColleges.length > 0 && !selectedColleges.includes(candidate.college)) return false;
        if (selectedCourses.length > 0 && !selectedCourses.includes(candidate.course)) return false;
        if (showGen !== showFem) { // Only apply filter if one is checked, not both
            if (showGen && candidate.gender === 'F') return false; // If GEN is checked, hide FEM quota
            if (showFem && candidate.gender === 'M') return false; // If FEM is checked, hide GEN
        }
        if (minFilter && !candidate.isMIN) return false; // If MIN is checked, hide non-MIN
        if (!minFilter && candidate.isMIN) return false; // If MIN is UNchecked, hide MIN
        if (phFilter && !candidate.isPH) return false; // If PH is checked, hide non-PH
        if (!phFilter && candidate.isPH) return false; // If PH is UNchecked, hide PH

        return true;
    });
    
    // Apply sorting
    const sortBy = document.getElementById('sortSelect').value;
    filteredData = sortResults(filteredData, sortBy);
    
    displayResults(filteredData);
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
            // Build details parts, filtering out empty values
            const detailsArray = [
                candidate.candidateCategory,
                getGenderDisplay(candidate.gender),
                `20${candidate.year}`,
                getQuotaDescription(candidate.admissionType),
                candidate.phase
            ].filter(Boolean);
            
            const detailsString = detailsArray.map(part => {
                if (part === 'FEM') {
                    return `<span class="detail-fem">${part}</span>`;
                }
                return part;
            }).join(' | ');
            
            const tagParts = [];
            if (candidate.isMIN) tagParts.push('<span class="tag-min">MIN</span>');
            if (candidate.isPH) tagParts.push('<span class="tag-ph">PH</span>');
            if (candidate.fileName && candidate.fileName.toLowerCase().includes('stray')) tagParts.push('<span class="tag-stray">STRAY</span>');
            if (candidate.admissionType === 'S') tagParts.push('<span class="tag-service">SERVICE</span>');

            return `
                <div class="candidate-item">
                    <div class="candidate-rank">
                        <a href="#" onclick="showRankHistory(${candidate.rank}, '${candidate.year}', '${candidate.category}'); return false;">
                            ${candidate.rank.toLocaleString()}
                        </a>
                    </div>
                    <div class="candidate-info">
                        <div class="candidate-course">${candidate.course}</div>
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
            for (const fileInfo of manifest.counsellingFiles) {
                if (fileInfo.year === year && fileInfo.category === category) {
                    try {
                        const response = await fetch(`./${fileInfo.path}`);
                        if (response.ok) {
                            const data = await response.json();
                            
                            // Search for the rank in this file
                            for (const [collegeName, courses] of Object.entries(data.colleges)) {
                                for (const [courseName, candidates] of Object.entries(courses)) {
                                    const candidate = candidates.find(c => c.rank === rank);
                                    if (candidate) {
                                        rankHistory.push({
                                            phase: candidate.phase,
                                            college: collegeName,
                                            course: courseName,
                                            fileName: data.fileName,
                                            admissionType: candidate.admissionType
                                        });
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        console.log(`Error loading ${fileInfo.path}`);
                    }
                }
            }
            
            // Sort by phase
            rankHistory.sort((a, b) => {
                const phaseA = parseInt(a.phase?.replace('P', '') || '0');
                const phaseB = parseInt(b.phase?.replace('P', '') || '0');
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
});