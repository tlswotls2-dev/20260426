const API_CONFIG = {
    ATPT_OFCDC_SC_CODE: 'J10',
    SD_SCHUL_CODE: '7679064',
    BASE_URL: 'https://open.neis.go.kr/hub/mealServiceDietInfo'
};

const ALLERGY_INFO = [
    "난류", "우유", "메밀", "땅콩", "대두", 
    "밀", "고등어", "게", "새우", "돼지고기", 
    "복숭아", "토마토", "아황산염", "호두", "닭고기", 
    "쇠고기", "오징어", "조개류", "잣"
];

// State
let selectedAllergies = JSON.parse(localStorage.getItem('userAllergies') || '[]');
let favoriteDishes = JSON.parse(localStorage.getItem('favoriteDishes') || '[]');

// DOM Elements
const dateInput = document.getElementById('meal-date');
const refreshBtn = document.getElementById('refresh-btn');
const openSettingsBtn = document.getElementById('open-settings');
const mealContainer = document.getElementById('meal-container');
const modalOverlay = document.getElementById('modal-overlay');
const closeModalBtn = document.getElementById('close-modal');
const allergyGrid = document.getElementById('allergy-grid');
const saveSettingsBtn = document.getElementById('save-settings');

// Initialize
window.onload = () => {
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
    
    setupAllergyGrid();
    fetchMealData(today.replace(/-/g, ''));
};

// Functions
function setupAllergyGrid() {
    allergyGrid.innerHTML = '';
    ALLERGY_INFO.forEach((name, index) => {
        const id = index + 1;
        const div = document.createElement('div');
        div.className = `allergy-option ${selectedAllergies.includes(id) ? 'active' : ''}`;
        div.innerHTML = `
            <input type="checkbox" id="allergy-${id}" ${selectedAllergies.includes(id) ? 'checked' : ''}>
            <label for="allergy-${id}">${id}. ${name}</label>
        `;
        div.onclick = (e) => {
            if (e.target.tagName !== 'INPUT') {
                const checkbox = div.querySelector('input');
                checkbox.checked = !checkbox.checked;
            }
            div.classList.toggle('active', div.querySelector('input').checked);
        };
        allergyGrid.appendChild(div);
    });
}

async function fetchMealData(dateStr) {
    showLoading();
    
    // NEIS API URL (Type=xml added to ensure XML response as requested)
    const url = `${API_CONFIG.BASE_URL}?ATPT_OFCDC_SC_CODE=${API_CONFIG.ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${API_CONFIG.SD_SCHUL_CODE}&MLSV_YMD=${dateStr}&Type=xml`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('API request failed');
        
        const xmlText = await response.text();
        parseAndDisplayMeal(xmlText);
    } catch (error) {
        console.error('Fetch error:', error);
        mealContainer.innerHTML = `
            <div class="empty-msg" style="color: #ef4444;">
                데이터를 불러오는 중 오류가 발생했습니다.<br>
                (CORS 정책 등으로 인해 직접 호출이 제한될 수 있습니다)
            </div>
        `;
    }
}

function parseAndDisplayMeal(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    
    // Check if there is data
    const resultCode = xmlDoc.querySelector("RESULT CODE")?.textContent;
    if (resultCode && resultCode !== "INFO-000") {
        mealContainer.innerHTML = `<div class="empty-msg">해당 날짜에 급식 정보가 없습니다.</div>`;
        return;
    }

    const rows = xmlDoc.querySelectorAll("row");
    if (rows.length === 0) {
        mealContainer.innerHTML = `<div class="empty-msg">급식 데이터가 없습니다.</div>`;
        return;
    }

    mealContainer.innerHTML = '';

    rows.forEach(row => {
        const mealType = row.querySelector("MMEAL_SC_NM").textContent;
        const menuString = row.querySelector("DDISH_NM").textContent;
        const calInfo = row.querySelector("CAL_INFO").textContent;

        const card = document.createElement('div');
        card.className = 'meal-card';
        
        // Clean menu string (br tags are often encoded as &lt;br/&gt;)
        const items = menuString.split(/<br\s*\/?>/i).map(item => item.trim()).filter(item => item);

        let itemsHtml = items.map(item => {
            // Extract allergy numbers: "현미밥(5.6.13)" -> [5, 6, 13]
            const allergyMatch = item.match(/\(([\d.]+)\)/);
            const allergyNums = allergyMatch ? allergyMatch[1].split('.').map(Number) : [];
            const cleanName = item.replace(/\([\d.]+\)/, '').trim();
            
            const isAllergy = allergyNums.some(num => selectedAllergies.includes(num));
            const isFav = favoriteDishes.includes(cleanName);
            
            let classes = 'meal-item';
            if (isAllergy) classes += ' allergy';
            else if (isFav) classes += ' favorite';

            return `
                <li class="${classes}" data-name="${cleanName}">
                    <span>${cleanName}</span>
                    ${isAllergy ? '<span class="allergy-tag">주의</span>' : ''}
                </li>
            `;
        }).join('');

        card.innerHTML = `
            <div class="meal-title">
                <span>${mealType}</span>
                <span style="font-size: 0.8rem; font-weight: 400; color: var(--text-muted);">${calInfo}</span>
            </div>
            <ul class="meal-list">${itemsHtml}</ul>
        `;
        
        mealContainer.appendChild(card);
    });

    // Add click events for toggling favorites
    document.querySelectorAll('.meal-item').forEach(el => {
        el.onclick = () => {
            const name = el.getAttribute('data-name');
            if (el.classList.contains('allergy')) return; // Don't favorite allergy items

            if (favoriteDishes.includes(name)) {
                favoriteDishes = favoriteDishes.filter(d => d !== name);
                el.classList.remove('favorite');
            } else {
                favoriteDishes.push(name);
                el.classList.add('favorite');
            }
            localStorage.setItem('favoriteDishes', JSON.stringify(favoriteDishes));
        };
    });
}

function showLoading() {
    mealContainer.innerHTML = `
        <div class="loading-spinner">
            <div class="dot"></div>
            <div class="dot"></div>
            <div class="dot"></div>
        </div>
    `;
}

// Event Listeners
refreshBtn.onclick = () => {
    const date = dateInput.value.replace(/-/g, '');
    if (date) fetchMealData(date);
};

openSettingsBtn.onclick = () => {
    modalOverlay.style.display = 'flex';
};

closeModalBtn.onclick = () => {
    modalOverlay.style.display = 'none';
};

saveSettingsBtn.onclick = () => {
    const checked = Array.from(allergyGrid.querySelectorAll('input:checked'))
                         .map(input => parseInt(input.id.split('-')[1]));
    selectedAllergies = checked;
    localStorage.setItem('userAllergies', JSON.stringify(selectedAllergies));
    modalOverlay.style.display = 'none';
    
    // Refresh current display
    const date = dateInput.value.replace(/-/g, '');
    if (date) fetchMealData(date);
};

window.onclick = (event) => {
    if (event.target == modalOverlay) {
        modalOverlay.style.display = 'none';
    }
};
