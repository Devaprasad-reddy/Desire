let allData = [];
let meritData = {};
let isDataLoaded = false;

// Load all JSON files using manifest
async function loadData() {
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
        const cacheBuster = Date.now();
        for (const fileInfo of manifest.counsellingFiles) {
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
        
        // Load merit list data
        for (const fileInfo of manifest.meritFiles) {
            try {
                const response = await fetch(`./${fileInfo.path}`);
                if (response.ok) {
                    const data = await response.json();
                    meritData[`${fileInfo.year}_${fileInfo.category}`] = data.rankMap;
                }
            } catch (error) {
                console.log(`Could not load merit file ${fileInfo.path}:`, error);
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

function getStateRank(neetRank, year, category) {
    const key = `${year}_${category}`;
    if (meritData[key] && meritData[key][neetRank]) {
        return meritData[key][neetRank];
    }
    
    // Find nearest state rank if exact match not found
    if (meritData[key]) {
        const neetRanks = Object.keys(meritData[key]).map(Number).sort((a, b) => a - b);
        let closest = null;
        let minDiff = Infinity;
        
        for (const rank of neetRanks) {
            const diff = Math.abs(rank - neetRank);
            if (diff < minDiff) {
                minDiff = diff;
                closest = rank;
            }
        }
        
        if (closest !== null) {
            return `~${meritData[key][closest]} (near ${closest})`;
        }
    }
    
    return 'N/A';
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

function getCollegeAbbreviation(collegeName) {
    // Extract abbreviation from college name like "GAND(010) - GANDHI MEDICAL COLLEGE"
    const match = collegeName.match(/^([A-Z]+)\(\d+\)/);
    return match ? match[1] : collegeName.substring(0, 4).toUpperCase();
}

function getGenderDisplay(gender) {
    return gender === 'M' ? 'GEN' : 'FEM';
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
    populateToggles('course', allCourses);
    
    // Populate quota toggles with descriptions, NS first
    const quotaContainer = document.getElementById('quotaToggles');
    
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
    
    // Add search functionality
    document.getElementById('collegeSearch').addEventListener('input', (e) => {
        filterCheckboxes('college', e.target.value, allColleges);
    });
    
    document.getElementById('courseSearch').addEventListener('input', (e) => {
        filterCheckboxes('course', e.target.value, allCourses);
    });
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

function filterCheckboxes(type, searchTerm, allItems) {
    const filteredItems = allItems.filter(item => 
        item.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    const toggleList = document.getElementById(`${type}ToggleList`);
    toggleList.innerHTML = '';
    
    filteredItems.forEach(item => {
        const label = document.createElement('label');
        label.className = 'toggle';
        const isChecked = document.querySelector(`input[value="${item}"].${type}Checkbox`)?.checked || false;
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = item;
        checkbox.className = `${type}Checkbox`;
        checkbox.checked = isChecked || true; // Keep checked by default
        
        const slider = document.createElement('span');
        slider.className = 'slider';
        
        const text = document.createTextNode(item);
        
        label.appendChild(checkbox);
        label.appendChild(slider);
        label.appendChild(text);
        toggleList.appendChild(label);
    });
}

function selectAll(type) {
    document.querySelectorAll(`.${type}Checkbox`).forEach(cb => cb.checked = true);
}

function clearAll(type) {
    document.querySelectorAll(`.${type}Checkbox`).forEach(cb => cb.checked = false);
}

function searchData() {
    if (!isDataLoaded) {
        alert('Data is still loading. Please wait...');
        return;
    }
    
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
    const selectedGenders = Array.from(document.querySelectorAll('.genderCheckbox:checked')).map(cb => cb.value);
    
    let filteredData = allData.filter(candidate => {
        if (selectedYears.length > 0 && !selectedYears.includes(candidate.year)) return false;
        if (selectedQuotas.length > 0 && !selectedQuotas.includes(candidate.admissionType)) return false;
        if (candidate.rank < minRank || candidate.rank > maxRank) return false;
        if (selectedCategories.length > 0 && !selectedCategories.includes(candidate.candidateCategory)) return false;
        if (selectedColleges.length > 0 && !selectedColleges.includes(candidate.college)) return false;
        if (selectedCourses.length > 0 && !selectedCourses.includes(candidate.course)) return false;
        if (selectedGenders.length > 0 && !selectedGenders.includes(candidate.gender)) return false;
        if (minFilter && !candidate.isMIN) return false;
        if (phFilter && !candidate.isPH) return false;
        
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
            const stateRank = getStateRank(candidate.rank, candidate.year, candidate.category);
            
            const collegeAbbr = getCollegeAbbreviation(candidate.college);
            
            return `
                <div class="result-item">
                    <div class="course-name">${candidate.course}</div>
                    <div class="rank-info">
                        NEET Rank: <span class="clickable-rank" onclick="showRankHistory(${candidate.rank}, '${candidate.year}', '${candidate.category}')">${candidate.rank.toLocaleString()}</span> | State Rank: ${stateRank} | ${collegeAbbr}
                    </div>
                    <div class="candidate-details">
                        ${candidate.candidateCategory} | ${getGenderDisplay(candidate.gender)} | 20${candidate.year} | ${getQuotaDescription(candidate.admissionType)} | ${candidate.phase}
                        ${candidate.isMIN ? ' | <span style="color: orange; font-weight: bold;">MIN</span>' : ''}
                        ${candidate.isPH ? ' | <span style="color: red; font-weight: bold;">PH</span>' : ''}
                        ${candidate.fileName && candidate.fileName.toLowerCase().includes('stray') ? ' | <span style="color: orange; font-weight: bold;">STRAY</span>' : ''}
                        ${candidate.admissionType === 'S' ? ' | <span style="color: orange; font-weight: bold;">SERVICE</span>' : ''}
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
    
    // Clear all checkboxes
    document.querySelectorAll('.yearCheckbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.quotaCheckbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.categoryCheckbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.genderCheckbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.collegeCheckbox').forEach(cb => cb.checked = false);
    document.querySelectorAll('.courseCheckbox').forEach(cb => cb.checked = false);
    document.getElementById('minCheckbox').checked = false;
    document.getElementById('phCheckbox').checked = false;
    
    // Reset search filters
    if (allColleges.length > 0) filterCheckboxes('college', '', allColleges);
    if (allCourses.length > 0) filterCheckboxes('course', '', allCourses);
    
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
function filterData() {
    searchData();
}

// Load data when page loads
window.addEventListener('load', loadData);