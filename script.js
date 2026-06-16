// --- MATHEMATICAL LOGIC ---
class TeamSpiritSimulator {
    constructor(coachLeadership, psychologistLevel = 0, decayMethod = 'lokes') {
        this.coachLeadership = coachLeadership;
        this.psychologistLevel = psychologistLevel;
        this.decayMethod = decayMethod;
        
        // Base TS effect on Midfield (Equivalent to NORMAL attitude)
        this.baseTsModifiers = {
            10: 1.42, 9: 1.35, 8: 1.28, 7: 1.21, 6: 1.14, 
            5: 1.07, 4: 1.00, 3: 0.93, 2: 0.86, 1: 0.72
        };

        // Exact engine multipliers
        this.multipliers = {
            attitude: { PIC: 0.83945, NORMAL: 1.0, MOTS: 1.1149 },
            venue: { HOME: 1.19892, AWAY: 1.0, DERBY_AWAY: 1.11493 },
            tactic: { NORMAL: 1.0, CA: 0.93 }
        };

        this.dropRates = {
            7: { 9: 1/3, 8: 1/5, 7: 1/7, 6: 1/13, 5: 1/33, 4: 1/35 },
            6: { 9: 1/3, 8: 1/5, 7: 1/7, 6: 1/13, 5: 1/33, 4: 1/35 },
            5: { 9: 1/2, 8: 1/4, 7: 1/6, 6: 1/10, 5: 1/26, 4: 1/30 },
            4: { 9: 1/1, 8: 1/3, 7: 1/5, 6: 1/7,  5: 1/20, 4: 1/25 },
            3: { 9: 1/1, 8: 1/2, 7: 1/2, 6: 1/5,  5: 1/13, 4: 1/15 },
            2: { 9: 1/1, 8: 1/1, 7: 1/1, 6: 1/2,  5: 1/6,  4: 1/10 },
            1: { 9: 1/1, 8: 1/1, 7: 1/1, 6: 1/2,  5: 1/6,  4: 1/10 }
        };

        this.riseRates = {
            7: { 0: 1/10, 1: 1/9,  2: 1/8,  3: 1/11, 4: 1/12 },
            6: { 0: 1/10, 1: 1/9,  2: 1/8,  3: 1/11, 4: 1/12 },
            5: { 0: 1/12, 1: 1/11, 2: 1/10, 3: 1/14, 4: 1/15 },
            4: { 0: 1/16, 1: 1/15, 2: 1/13, 3: 1/19, 4: 1/20 },
            3: { 0: 1/23, 1: 1/22, 2: 1/20, 3: 1/30, 4: 1/31 },
            2: { 0: 1/50, 1: 1/45, 2: 1/40, 3: 1/60, 4: 1/61 },
            1: { 0: 1/90, 1: 1/85, 2: 1/80, 3: 1/85, 4: 1/90 }
        };
    }

    getTargetSpirit() {
        let target = 4.5 + (this.psychologistLevel / 10.0);
        return target;
    }

    applyMatchEffect(preMatchTS, attitude) {
        let postMatchTS = preMatchTS;
        if (attitude === 'PIC') postMatchTS = preMatchTS * (1.0 + (1.0 / 3.0));
        else if (attitude === 'MOTS') postMatchTS = preMatchTS / 2.0;
        return Math.min(12.0, Math.max(0.0, postMatchTS));
    }

    // Apply TS effect from changing training intensity (e.g., dropping before a final)
    // Formula ported from Hattrick Organizer / HT-Tools
    applyTrainingIntensityChange(currentTS, oldIntensity, newIntensity) {
        if (oldIntensity === newIntensity || oldIntensity <= 0) return currentTS;
        // Mathematically identical to the HT tools logic
        const logBase07 = Math.log(newIntensity / oldIntensity) / Math.log(0.7);
        let newTS = currentTS * Math.pow(1.2, logBase07);
        
        // Match the exact precision rounding of external tools
        newTS = parseFloat(newTS.toFixed(2));
        return Math.min(12.0, Math.max(0.0, newTS));
    }

    // Daily decay uses Piecewise Linear Decay (Lokes Table)
    // Rising TS uses the asymptotic formula
    applyDailyUpdate(currentTS) {
        const target = this.getTargetSpirit();
        if (Math.abs(currentTS - target) < 0.001) return target;

        if (this.decayMethod === 'asymptotic') {
            // Unified smooth asymptotic formula for both rising and falling TS
            // A Solid coach (7) retains ~93% of the difference, Passable (6) retains ~91%
            const retentionFactor = 0.79 + (this.coachLeadership * 0.02);
            let newTS = target + (currentTS - target) * retentionFactor;
            return Math.min(10.0, Math.max(0.0, newTS));
        }

        if (currentTS > target) {
            // Clean up precision dust (e.g., 9.00000001 or 8.99999 become exactly 9)
            const cleanTS = parseFloat(currentTS.toFixed(4));
            
            // Map exact integers to the bucket below them (9.0 -> bucket 8)
            // Decimal values drop down to their integer floor (9.01 -> bucket 9)
            let bucket = Number.isInteger(cleanTS) ? cleanTS - 1 : Math.floor(cleanTS);

            if (bucket >= 9) bucket = 9;
            if (bucket < 4) bucket = 4; // Bounding at 4 since TS never drops below 4.5 in this block
            
            let drop = this.dropRates[this.coachLeadership]?.[bucket] || 0.1;
            return Math.max(target, currentTS - drop);
        } else if (currentTS < target) {
            // Rising TS (when currentTS < target) 
            
            // Preserved old asymptotic rise formula (can be toggled if needed):
            // if (this.decayMethod === 'lokes_old_rise') {
            //     let newTS = currentTS * (1.0 + (((target - currentTS) * (this.coachLeadership / 2.0)) / 100.0));
            //     return Math.min(target, newTS);
            // }

            const cleanTS = parseFloat(currentTS.toFixed(4));
            let bucket = Math.floor(cleanTS);
            
            if (bucket >= 4) bucket = 4;
            if (bucket <= 0) bucket = 0;

            // Note: Leadership 7 exact fractions derived from IanMajor's NT table.
            // Other leadership levels extrapolated by grouping (7&6, 2&1) and scaling denominators, 
            // mimicking the structure and logic of the dropRates table.
            let rise = this.riseRates[this.coachLeadership]?.[bucket] || 0.1;
            return Math.min(target, currentTS + rise);
        }
    }

    calculateMidfieldRating(baseRating, currentTS, attitude, venue, tactic) {
        const ts = Math.min(10.0, Math.max(1.0, currentTS));
        const lowerBound = Math.floor(ts);
        const upperBound = Math.ceil(ts);
        const lowerMod = this.baseTsModifiers[lowerBound];
        
        let interpolatedTsMod = lowerMod;
        if (lowerBound !== upperBound) {
            const upperMod = this.baseTsModifiers[upperBound];
            const decimalPart = ts - lowerBound;
            interpolatedTsMod = lowerMod + ((upperMod - lowerMod) * decimalPart);
        }
        
        let rating = baseRating * interpolatedTsMod;
        rating *= this.multipliers.attitude[attitude];
        rating *= this.multipliers.venue[venue];
        rating *= this.multipliers.tactic[tactic];
        
        return rating;
    }
}

// --- SEASON CONTROLLER ---
class SeasonController {
    constructor(simulator) {
        this.simulator = simulator;
        this.updatesBetweenSatAndTue = 3; 
        this.updatesBetweenTueAndSat = 4;
    }

    generateDefaultSchedule() {
        const schedule = [];
        for (let week = 1; week <= 15; week++) {
            schedule.push({ 
                week, day: 'Tue', type: 'Cup', attitude: 'NORMAL', 
                venue: 'AWAY', tactic: 'NORMAL', isActive: true, trainingIntensity: 100
            });
            schedule.push({ 
                week, day: 'Sat', type: week === 15 ? 'Qualifier' : 'League', 
                attitude: 'NORMAL', venue: week % 2 === 0 ? 'HOME' : 'AWAY', 
                tactic: 'NORMAL', isActive: true
            });
        }
        return schedule;
    }

    simulateSeason(initialTS, baseMidfieldRating, scheduleConfig) {
        let currentTS = initialTS;
        const results = [];
        let isCupActive = true;
        let currentIntensity = 100;

        for (let i = 0; i < this.updatesBetweenSatAndTue; i++) {
            currentTS = this.simulator.applyDailyUpdate(currentTS);
        }

        for (let i = 0; i < scheduleConfig.length; i++) {
            const match = scheduleConfig[i];
            
            let effectivelyActive = match.isActive;
            let cupEliminatedBefore = false;

            if (match.type === 'Cup') {
                if (!isCupActive) {
                    effectivelyActive = false;
                    cupEliminatedBefore = true;
                }
                if (!match.isActive) {
                    isCupActive = false;
                }
            } else if (match.type === 'League') {
                effectivelyActive = true;
            }

            const preMatchTS = currentTS;
            const effectiveAttitude = effectivelyActive ? match.attitude : 'NORMAL';

            const midfieldRating = this.simulator.calculateMidfieldRating(
                baseMidfieldRating, preMatchTS, effectiveAttitude, match.venue, match.tactic
            );
            currentTS = this.simulator.applyMatchEffect(preMatchTS, effectiveAttitude);
            const postMatchTS = Math.min(10.0, currentTS);

            results.push({
                ...match,
                effectivelyActive,
                cupEliminatedBefore,
                preMatchTS: parseFloat(preMatchTS.toFixed(2)),
                midfieldRating: parseFloat(midfieldRating.toFixed(2)),
                postMatchTS: parseFloat(postMatchTS.toFixed(2))
            });

            // --- Post-Match Timeline to Next Match ---
            if (match.day === 'Tue') {
                // Tuesday to Saturday interval
                // 1. Training Event (Intensity change applied right before Thu 04:30 update)
                let newIntensity = match.trainingIntensity !== undefined ? Number(match.trainingIntensity) : currentIntensity;
                const tsBeforeBoost = currentTS;

                if (newIntensity !== currentIntensity) {
                    currentTS = this.simulator.applyTrainingIntensityChange(currentTS, currentIntensity, newIntensity);
                    currentIntensity = newIntensity;
                }
                
                results[results.length - 1].preBoostTS = tsBeforeBoost;
                results[results.length - 1].boostedTS = currentTS;
                results[results.length - 1].boostDirection = currentTS > tsBeforeBoost ? 'up' : (currentTS < tsBeforeBoost ? 'down' : 'none');

                // First update caps TS at 10
                currentTS = Math.min(10.0, currentTS);

                // 2. Remaining updates: Thu 04:30, Thu 23:45, Fri 12:00, Sat 02:00 (4 updates after training)
                for (let u = 0; u < 4; u++) {
                    currentTS = this.simulator.applyDailyUpdate(currentTS);
                }
            } else {
                // Saturday to Tuesday interval
                currentTS = Math.min(10.0, currentTS);
                // Updates: Mon 04:30, Mon 23:00, Tue 02:00 (3 updates)
                for (let u = 0; u < this.updatesBetweenSatAndTue; u++) {
                    currentTS = this.simulator.applyDailyUpdate(currentTS);
                }
            }
        }
        return results;
    }
}

// --- STORAGE & APP STATE ---
class StorageManager {
    constructor() { this.storageKey = 'ht_ts_season_simulator_data'; }
    saveData(settings, schedule) { localStorage.setItem(this.storageKey, JSON.stringify({ settings, schedule })); }
    loadData() { return JSON.parse(localStorage.getItem(this.storageKey)); }
    clearData() { localStorage.removeItem(this.storageKey); }
}

class SeasonApp {
    constructor() {
        this.storage = new StorageManager();
        this.defaultSettings = {
            coachLeadership: 6,
            psychologistLevel: 0,
            baseMidfieldRating: 10.0,
            decayMethod: 'lokes'
        };
        this.settings = { ...this.defaultSettings };
        this.schedule = [];
        this.init();
    }

    init() {
        const saved = this.storage.loadData();
        if (saved && saved.settings && saved.schedule) {
            this.settings = saved.settings;
            this.schedule = saved.schedule;
            this.ensureNewPropertiesExist();
        } else {
            this.instantiateController();
            this.schedule = this.controller.generateDefaultSchedule();
        }
    }
    
    ensureNewPropertiesExist() {
        if (!this.settings.decayMethod) this.settings.decayMethod = 'lokes';
        this.schedule.forEach(match => {
            if (!match.venue) match.venue = 'AWAY';
            if (!match.tactic) match.tactic = 'NORMAL';
            if (match.day === 'Tue' && match.trainingIntensity === undefined) match.trainingIntensity = 100;
            if (match.day === 'Sat' && match.trainingIntensity !== undefined) delete match.trainingIntensity;
        });
    }

    instantiateController() {
        const sim = new TeamSpiritSimulator(
            Number(this.settings.coachLeadership),
            Number(this.settings.psychologistLevel),
            this.settings.decayMethod
        );
        this.controller = new SeasonController(sim);
    }

    resetState() {
        this.storage.clearData();
        this.settings = { ...this.defaultSettings };
        this.instantiateController();
        this.schedule = this.controller.generateDefaultSchedule();
    }

    updateSetting(key, value) {
        this.settings[key] = value;
        this.storage.saveData(this.settings, this.schedule);
    }

    updateMatch(index, field, value) {
        this.schedule[index][field] = value;
        this.storage.saveData(this.settings, this.schedule);
    }

    runSimulation() {
        this.instantiateController();
        return this.controller.simulateSeason(
            4.5, 
            Number(this.settings.baseMidfieldRating), 
            this.schedule
        );
    }
}

// --- DOM BINDING & UI RENDERING ---
const app = new SeasonApp();

const domEls = {
    coach: document.getElementById('coachLeadership'),
    psychologist: document.getElementById('psychologistLevel'),
    midfield: document.getElementById('baseMidfieldRating'),
    decayMethod: document.getElementById('decayMethod'),
    reset: document.getElementById('btnReset'),
    tbody: document.getElementById('scheduleTableBody')
};

// Create Plot button dynamically if not present
let btnPlot = document.getElementById('btnPlot');
if (!btnPlot && domEls.reset) {
    btnPlot = document.createElement('button');
    btnPlot.id = 'btnPlot';
    btnPlot.textContent = 'Plot TS Curves';
    btnPlot.style.marginLeft = '10px';
    domEls.reset.parentNode.insertBefore(btnPlot, domEls.reset.nextSibling);
}

function updateCalculatedData() {
    const results = app.runSimulation();
    const rows = domEls.tbody.querySelectorAll('tr');
    results.forEach((match, idx) => {
        if (rows[idx]) {
            const preCell = rows[idx].querySelector('.cell-pre-ts');
            const midCell = rows[idx].querySelector('.cell-midfield');
            const postCell = rows[idx].querySelector('.cell-post-ts');
            const boostCell = rows[idx].querySelector('.cell-boosted-ts');
            if (preCell) preCell.textContent = match.preMatchTS;
            if (midCell) midCell.innerHTML = `<strong>${match.midfieldRating}</strong>`;
            if (postCell) postCell.textContent = match.postMatchTS;
            
            if (boostCell) {
                if (match.preBoostTS !== undefined && match.boostedTS !== undefined) {
                    const color = match.boostDirection === 'up' ? '#388e3c' : (match.boostDirection === 'down' ? '#d32f2f' : 'inherit');
                    boostCell.innerHTML = `${match.preBoostTS.toFixed(2)} => <strong style="color: ${color}">${match.boostedTS.toFixed(2)}</strong>`;
                    boostCell.style.cssText = `display: inline-block; width: 110px; text-align: left; font-size: 0.9em; margin-left: 6px;`;
                } else {
                    boostCell.innerHTML = '';
                    boostCell.style.cssText = `display: inline-block; width: 110px; margin-left: 6px;`;
                }
            }
        }
    });
}

function renderUI() {
    domEls.coach.value = app.settings.coachLeadership;
    domEls.psychologist.value = app.settings.psychologistLevel;
    domEls.midfield.value = app.settings.baseMidfieldRating;
    if (domEls.decayMethod) domEls.decayMethod.value = app.settings.decayMethod;

    const results = app.runSimulation();
    domEls.tbody.innerHTML = '';
    
    let currentWeek = null;

    results.forEach((match, idx) => {
        const tr = document.createElement('tr');
        
        if (currentWeek !== null && match.week !== currentWeek) {
            tr.classList.add('new-week-row');
        }
        currentWeek = match.week;

        let playedCheck = '';
        if (match.type === 'Cup') {
            const checkedAttr = match.effectivelyActive ? 'checked' : '';
            const disabledAttr = match.cupEliminatedBefore ? 'disabled' : '';
            playedCheck = `<input type="checkbox" class="toggle-active" data-idx="${idx}" ${checkedAttr} ${disabledAttr}>`;
        } else if (match.type === 'Qualifier') {
            playedCheck = `<input type="checkbox" class="toggle-active" data-idx="${idx}" ${match.isActive ? 'checked' : ''}>`;
        }

        const venueSelect = `
            <select class="select-control match-venue" data-idx="${idx}">
                <option value="HOME" ${match.venue === 'HOME' ? 'selected' : ''}>Home</option>
                <option value="AWAY" ${match.venue === 'AWAY' ? 'selected' : ''}>Away</option>
                <option value="DERBY_AWAY" ${match.venue === 'DERBY_AWAY' ? 'selected' : ''}>Derby (Away)</option>
            </select>
        `;
        
        const tacticSelect = `
            <select class="select-control match-tactic" data-idx="${idx}">
                <option value="NORMAL" ${match.tactic === 'NORMAL' ? 'selected' : ''}>Normal</option>
                <option value="CA" ${match.tactic === 'CA' ? 'selected' : ''}>Counter-Attack</option>
            </select>
        `;

        const displayAttitude = match.effectivelyActive ? match.attitude : 'NORMAL';
        const attitudeDisabled = !match.effectivelyActive ? 'disabled' : '';
        const attitudeStyle = !match.effectivelyActive ? 'style="opacity: 0.5;"' : '';

        const attitudeSelect = `
            <select class="select-control attitude-${displayAttitude} match-attitude" data-idx="${idx}" ${attitudeDisabled} ${attitudeStyle}>
                <option value="PIC" ${displayAttitude === 'PIC' ? 'selected' : ''}>PIC</option>
                <option value="NORMAL" ${displayAttitude === 'NORMAL' ? 'selected' : ''}>NORMAL</option>
                <option value="MOTS" ${displayAttitude === 'MOTS' ? 'selected' : ''}>MOTS</option>
            </select>
        `;

        let boostStyle = `display: inline-block; width: 110px; margin-left: 6px;`;
        let boostHtml = '';
        if (match.preBoostTS !== undefined && match.boostedTS !== undefined) {
            const color = match.boostDirection === 'up' ? '#388e3c' : (match.boostDirection === 'down' ? '#d32f2f' : 'inherit');
            boostHtml = `${match.preBoostTS.toFixed(2)} => <strong style="color: ${color}">${match.boostedTS.toFixed(2)}</strong>`;
            boostStyle = `display: inline-block; width: 110px; text-align: left; font-size: 0.9em; margin-left: 6px;`;
        }

        const trainingInput = match.day === 'Tue' ? `
            <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
                <input type="range" class="match-training-slider" data-idx="${idx}" value="${match.trainingIntensity}" min="1" max="100" step="1" style="width: 50px;">
                <input type="number" class="match-training-number" data-idx="${idx}" value="${match.trainingIntensity}" min="1" max="100" step="1" style="width: 50px; text-align: center;">
                <span class="cell-boosted-ts" style="${boostStyle}" title="Thursday Boosted TS">${boostHtml}</span>
            </div>
        ` : '<span style="color: #999;">-</span>';

        tr.innerHTML = `
            <td>${match.week}</td>
            <td>${match.day}</td>
            <td>${match.type}</td>
            <td>${playedCheck}</td>
            <td>${venueSelect}</td>
            <td>${tacticSelect}</td>
            <td>${attitudeSelect}</td>
            <td class="cell-pre-ts">${match.preMatchTS}</td>
            <td class="cell-midfield"><strong>${match.midfieldRating}</strong></td>
            <td class="cell-post-ts">${match.postMatchTS}</td>
            <td>${trainingInput}</td>
        `;
        domEls.tbody.appendChild(tr);
    });

    attachTableListeners();
}

function attachTableListeners() {
    document.querySelectorAll('.toggle-active').forEach(chk => {
        chk.addEventListener('change', (e) => {
            app.updateMatch(e.target.dataset.idx, 'isActive', e.target.checked);
            renderUI();
        });
    });

    document.querySelectorAll('.match-venue').forEach(sel => {
        sel.addEventListener('change', (e) => {
            app.updateMatch(e.target.dataset.idx, 'venue', e.target.value);
            renderUI();
        });
    });
    
    document.querySelectorAll('.match-tactic').forEach(sel => {
        sel.addEventListener('change', (e) => {
            app.updateMatch(e.target.dataset.idx, 'tactic', e.target.value);
            renderUI();
        });
    });

    document.querySelectorAll('.match-attitude').forEach(sel => {
        sel.addEventListener('change', (e) => {
            app.updateMatch(e.target.dataset.idx, 'attitude', e.target.value);
            renderUI();
        });
    });

    document.querySelectorAll('.match-training-slider').forEach(inp => {
        inp.addEventListener('input', (e) => {
            e.target.nextElementSibling.value = e.target.value;
            let val = parseInt(e.target.value, 10);
            if (!isNaN(val)) {
                if (val <= 0) val = 1; // Prevent zero or negative intensity which breaks the boost formula
                if (val > 100) val = 100;
                app.schedule[e.target.dataset.idx].trainingIntensity = val;
                updateCalculatedData();
            }
        });
        inp.addEventListener('change', (e) => {
            let val = parseInt(e.target.value, 10);
            if (isNaN(val) || val <= 0) val = 1; // Prevent zero or negative intensity which breaks the boost formula
            if (val > 100) val = 100;
            app.updateMatch(e.target.dataset.idx, 'trainingIntensity', val);
            renderUI();
        });
    });

    document.querySelectorAll('.match-training-number').forEach(inp => {
        inp.addEventListener('input', (e) => {
            e.target.previousElementSibling.value = e.target.value;
            let val = parseInt(e.target.value, 10);
            if (!isNaN(val)) {
                if (val <= 0) val = 1; // Prevent zero or negative intensity which breaks the boost formula
                if (val > 100) val = 100;
                app.schedule[e.target.dataset.idx].trainingIntensity = val;
                updateCalculatedData();
            }
        });
        inp.addEventListener('change', (e) => {
            let val = parseInt(e.target.value, 10);
            if (isNaN(val) || val <= 0) val = 1; // Prevent zero or negative intensity which breaks the boost formula
            if (val > 100) val = 100;
            app.updateMatch(e.target.dataset.idx, 'trainingIntensity', val);
            renderUI();
        });
    });
}

domEls.coach.addEventListener('change', (e) => { app.updateSetting('coachLeadership', e.target.value); renderUI(); });
domEls.psychologist.addEventListener('change', (e) => { app.updateSetting('psychologistLevel', e.target.value); renderUI(); });
domEls.midfield.addEventListener('change', (e) => { app.updateSetting('baseMidfieldRating', e.target.value); renderUI(); });
if (domEls.decayMethod) domEls.decayMethod.addEventListener('change', (e) => { app.updateSetting('decayMethod', e.target.value); renderUI(); });

domEls.reset.addEventListener('click', () => {
    if(confirm("Are you sure you want to reset all data?")) {
        app.resetState();
        renderUI();
    }
});

if (btnPlot) {
    btnPlot.addEventListener('click', () => {
        if (!window.Chart) {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
            script.onload = () => plotTSCurves();
            document.head.appendChild(script);
        } else {
            plotTSCurves();
        }
    });
}

function plotTSCurves() {
    let container = document.getElementById('tsChartContainer');
    const isDark = document.body.classList.contains('dark-mode');
    if (!container) {
        container = document.createElement('div');
        container.id = 'tsChartContainer';
        container.style.cssText = `max-width: 800px; margin: 20px auto; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); background: ${isDark ? '#2d2d2d' : '#fff'};`;
        
        const canvas = document.createElement('canvas');
        canvas.id = 'tsChart';
        container.appendChild(canvas);
        
        const mainContent = document.querySelector('.container') || document.body;
        mainContent.appendChild(container);
    }

    const ctx = document.getElementById('tsChart').getContext('2d');
    const sim = new TeamSpiritSimulator(7, 0, 'lokes');
    
    const labels = [
        '0-1', '1-2', '2-3', '3-4', '4-4.5 (Rise)', 
        '4.5-5 (Drop)', '5-6', '6-7', '7-8', '8-9', '9-10'
    ];
    const datasets = [];
    const colors = {
        7: '#4CAF50', 6: '#8BC34A', 5: '#FFEB3B', 
        4: '#FFC107', 3: '#FF9800', 2: '#FF5722', 1: '#F44336'
    };
    const leadershipLabels = {
        7: 'Solid', 6: 'Passable', 5: 'Inadequate', 4: 'Weak',
        3: 'Poor', 2: 'Wretched', 1: 'Disastrous'
    };

    for (let l = 7; l >= 1; l--) {
        const data = [
            sim.riseRates[l][0], sim.riseRates[l][1],
            sim.riseRates[l][2], sim.riseRates[l][3],
            sim.riseRates[l][4], -(sim.dropRates[l][4]),
            -(sim.dropRates[l][5]), -(sim.dropRates[l][6]),
            -(sim.dropRates[l][7]), -(sim.dropRates[l][8]),
            -(sim.dropRates[l][9])
        ];
        datasets.push({
            label: `Ld. ${l} (${leadershipLabels[l]})`,
            data: data, borderColor: colors[l],
            backgroundColor: colors[l], fill: false, tension: 0.1
        });
    }

    if (window.tsChartInstance) {
        window.tsChartInstance.destroy();
    }

    const textColor = isDark ? '#fff' : '#666';

    window.tsChartInstance = new Chart(ctx, {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: 'Team Spirit Daily Change by Leadership', color: textColor },
                legend: { labels: { color: textColor } },
                tooltip: { callbacks: { label: context => `${context.dataset.label}: ${context.parsed.y > 0 ? '+' : ''}${Number(context.parsed.y).toFixed(3)}` } }
            },
            scales: {
                x: { title: { display: true, text: 'Team Spirit Bucket', color: textColor }, ticks: { color: textColor } },
                y: { title: { display: true, text: 'Daily TS Change', color: textColor }, ticks: { color: textColor } }
            }
        }
    });
}

renderUI();

// --- THEME TOGGLE ---
const btnThemeToggle = document.getElementById('btnThemeToggle');
const savedTheme = localStorage.getItem('ht_ts_theme') || 'light';
if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    btnThemeToggle.textContent = '☀️ Light Mode';
} else {
    btnThemeToggle.textContent = '🌙 Dark Mode';
}

btnThemeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('ht_ts_theme', isDark ? 'dark' : 'light');
    btnThemeToggle.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
    
    if (window.tsChartInstance) {
        const textColor = isDark ? '#fff' : '#666';
        window.tsChartInstance.options.plugins.title.color = textColor;
        window.tsChartInstance.options.plugins.legend.labels.color = textColor;
        window.tsChartInstance.options.scales.x.title.color = textColor;
        window.tsChartInstance.options.scales.x.ticks.color = textColor;
        window.tsChartInstance.options.scales.y.title.color = textColor;
        window.tsChartInstance.options.scales.y.ticks.color = textColor;
        document.getElementById('tsChartContainer').style.background = isDark ? '#2d2d2d' : '#fff';
        window.tsChartInstance.update();
    }
});
