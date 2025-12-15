(() => {
    const SUN = 0;
    const MOON = 1;
    const EMPTY = -1;

    const SIZE = 6;
    const CELL_COUNT = SIZE * SIZE;

    console.log("[LinkedIn PuzzleBot] Tango content script running");

    function log(msg) {
        console.log("[Tango] " + msg);
    }

    function findGrid() {
        return document.querySelector('[data-testid="interactive-grid"]');
    }

    function getCells(gridEl) {
        return Array.from(gridEl.querySelectorAll('[id^="tango-cell-"]'));
    }

    function readCellValue(cellEl) {
        if (cellEl.querySelector('svg[aria-label="Sun"], [data-testid="cell-zero"]')) return SUN;
        if (cellEl.querySelector('svg[aria-label="Moon"], [data-testid="cell-one"]')) return MOON;
        return EMPTY;
    }



    function getCellCenters(cells) {
        return cells.map((cell) => {
            const r = cell.getBoundingClientRect();
            return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
        });
    }

    function pairEdgeWithCells(edgeEl, centers) {
        const er = edgeEl.getBoundingClientRect();
        const ex = (er.left + er.right) / 2;
        const ey = (er.top + er.bottom) / 2;

        const nearest = centers
            .map((pt, idx) => {
                const dx = pt.x - ex;
                const dy = pt.y - ey;
                return { idx, d2: dx * dx + dy * dy };
            })
            .sort((a, b) => a.d2 - b.d2);

        for (let i = 0; i < Math.min(8, nearest.length); i++) {
            for (let j = i + 1; j < Math.min(10, nearest.length); j++) {
                const a = nearest[i].idx;
                const b = nearest[j].idx;
                const ar = Math.floor(a / SIZE);
                const ac = a % SIZE;
                const br = Math.floor(b / SIZE);
                const bc = b % SIZE;
                if (Math.abs(ar - br) + Math.abs(ac - bc) === 1) return [a, b];
            }
        }

        return null;
    }

    function buildAdjacency(gridEl, cells) {
        const adj = Array.from({ length: CELL_COUNT }, () => []);

        const centers = cells.map((cell) => {
            const r = cell.getBoundingClientRect();
            return {
                x: (r.left + r.right) / 2,
                y: (r.top + r.bottom) / 2,
            };
        });

        function addEdge(a, b, kind) {
            if (a < 0 || b < 0 || a >= CELL_COUNT || b >= CELL_COUNT) return;
            adj[a].push({ other: b, kind });
            adj[b].push({ other: a, kind });
        }

        const edgeEls = Array.from(
            gridEl.querySelectorAll('[data-testid="edge-cross"], [data-testid="edge-equal"]')
        );

        for (const edgeEl of edgeEls) {
            const kind = edgeEl.getAttribute("data-testid") === "edge-cross" ? "neq" : "eq";

            const er = edgeEl.getBoundingClientRect();
            const ex = (er.left + er.right) / 2;
            const ey = (er.top + er.bottom) / 2;

            // Find nearest two adjacent cells
            const candidates = centers
                .map((pt, idx) => {
                    const dx = pt.x - ex;
                    const dy = pt.y - ey;
                    return { idx, d2: dx * dx + dy * dy };
                })
                .sort((a, b) => a.d2 - b.d2);

            let a = -1, b = -1;

            for (let i = 0; i < candidates.length; i++) {
                for (let j = i + 1; j < candidates.length; j++) {
                    const i1 = candidates[i].idx;
                    const i2 = candidates[j].idx;

                    const r1 = Math.floor(i1 / SIZE);
                    const c1 = i1 % SIZE;
                    const r2 = Math.floor(i2 / SIZE);
                    const c2 = i2 % SIZE;

                    // must be non-diagonally adjacent
                    if (Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1) {
                        a = i1;
                        b = i2;
                        break;
                    }
                }
                if (a !== -1) break;
            }

            if (a !== -1) addEdge(a, b, kind);
        }

        const count = adj.reduce((s, v) => s + v.length, 0) / 2;
        log(`Parsed ${count} constraints`);

        return adj;
    }



    function parseBoard() {
        const gridEl = findGrid();
        if (!gridEl) throw new Error("Grid not found");

        const allCells = getCells(gridEl);
        if (!allCells.length) throw new Error("No cells found");

        const byIdx = new Array(CELL_COUNT).fill(null);
        for (const el of allCells) {
            const n = parseInt(el.getAttribute("data-cell-idx") ?? "-1", 10);
            if (n >= 0 && n < CELL_COUNT) byIdx[n] = el;
        }

        if (byIdx.some((x) => x === null)) {
            const missing = byIdx.map((x, i) => (x ? null : i)).filter((x) => x !== null);
            throw new Error("Missing expected cells: " + missing.join(", "));
        }

        const cells = byIdx;

        const values = new Array(CELL_COUNT).fill(EMPTY);
        const locked = new Array(CELL_COUNT).fill(false);

        for (let i = 0; i < CELL_COUNT; i++) {
            const cell = cells[i];
            const disabled = cell.getAttribute("aria-disabled") === "true";
            const v = readCellValue(cell);
            values[i] = v;

            if (v !== EMPTY) locked[i] = true;
        }

        const half = SIZE / 2;
        const rowCounts = Array.from({ length: SIZE }, () => [0, 0]);
        const colCounts = Array.from({ length: SIZE }, () => [0, 0]);

        for (let idx = 0; idx < CELL_COUNT; idx++) {
            const v = values[idx];
            if (v === EMPTY) continue;
            const r = Math.floor(idx / SIZE);
            const c = idx % SIZE;
            rowCounts[r][v]++;
            colCounts[c][v]++;
        }

        const adj = buildAdjacency(gridEl, cells);

        return { gridEl, cells, values, locked, rowCounts, colCounts, half, adj };
    }


    function checkNoTriplesLine(values, r, c) {
        const rowStart = r * SIZE;
        for (let j = Math.max(0, c - 2); j <= Math.min(SIZE - 3, c); j++) {
            const a = values[rowStart + j];
            const b = values[rowStart + j + 1];
            const d = values[rowStart + j + 2];
            if (a !== EMPTY && a === b && b === d) return false;
        }

        for (let i = Math.max(0, r - 2); i <= Math.min(SIZE - 3, r); i++) {
            const a = values[i * SIZE + c];
            const b = values[(i + 1) * SIZE + c];
            const d = values[(i + 2) * SIZE + c];
            if (a !== EMPTY && a === b && b === d) return false;
        }

        return true;
    }

    function respectsEdgesAt(values, idx, adj) {
        const v = values[idx];
        if (v === EMPTY) return true;
        for (const e of adj[idx]) {
            const ov = values[e.other];
            if (ov === EMPTY) continue;
            if (e.kind === "eq" && ov !== v) return false;
            if (e.kind === "neq" && ov === v) return false;
        }
        return true;
    }

    function countsFeasible(rowCounts, colCounts, half, r, c) {
        if (rowCounts[r][SUN] > half || rowCounts[r][MOON] > half) return false;
        if (colCounts[c][SUN] > half || colCounts[c][MOON] > half) return false;
        return true;
    }

    function setCell(state, idx, v) {
        const { values, rowCounts, colCounts, half, adj } = state;
        const cur = values[idx];
        if (cur === v) return true;
        if (cur !== EMPTY && cur !== v) return false;

        const r = Math.floor(idx / SIZE);
        const c = idx % SIZE;

        values[idx] = v;
        rowCounts[r][v]++;
        colCounts[c][v]++;

        if (!countsFeasible(rowCounts, colCounts, half, r, c)) return false;
        if (!checkNoTriplesLine(values, r, c)) return false;
        if (!respectsEdgesAt(values, idx, adj)) return false;

        for (const e of adj[idx]) {
            if (!respectsEdgesAt(values, e.other, adj)) return false;
        }

        return true;
    }

    function unsetCell(state, idx) {
        const { values, rowCounts, colCounts } = state;
        const cur = values[idx];
        if (cur === EMPTY) return;
        const r = Math.floor(idx / SIZE);
        const c = idx % SIZE;
        rowCounts[r][cur]--;
        colCounts[c][cur]--;
        values[idx] = EMPTY;
    }

    function preCompute(state) {
        const { values, locked, rowCounts, colCounts, half, adj } = state;

        function force(idx, v, stack) {
            if (locked[idx]) return false;
            if (values[idx] === v) return true;
            if (values[idx] !== EMPTY && values[idx] !== v) return false;

            if (!setCell(state, idx, v)) return false;
            stack.push(idx);
            return true;
        }

        function fillEdges(stack) {
            let changed = false;

            for (let a = 0; a < CELL_COUNT; a++) {
                const av = values[a];
                if (av === EMPTY) continue;
                for (const e of adj[a]) {
                    const b = e.other;
                    const bv = values[b];
                    if (bv !== EMPTY) continue;

                    const want = e.kind === "eq" ? av : 1 - av;
                    if (!force(b, want, stack)) return null;
                    changed = true;
                }
            }

            return changed;
        }

        function fillNoTriplesPatterns(stack) {
            let changed = false;

            const tryForce = (idx, v) => {
                if (values[idx] !== EMPTY || locked[idx]) return true;
                if (!force(idx, v, stack)) return false;
                changed = true;
                return true;
            };

            for (let r = 0; r < SIZE; r++) {
                for (let c = 0; c < SIZE; c++) {
                    const i = r * SIZE + c;
                    if (values[i] !== EMPTY) continue;

                    if (c - 2 >= 0) {
                        const a = values[r * SIZE + (c - 2)];
                        const b = values[r * SIZE + (c - 1)];
                        if (a !== EMPTY && a === b) if (!tryForce(i, 1 - a)) return null;
                    }
                    if (c + 2 < SIZE) {
                        const a = values[r * SIZE + (c + 1)];
                        const b = values[r * SIZE + (c + 2)];
                        if (a !== EMPTY && a === b) if (!tryForce(i, 1 - a)) return null;
                    }
                    if (c - 1 >= 0 && c + 1 < SIZE) {
                        const a = values[r * SIZE + (c - 1)];
                        const b = values[r * SIZE + (c + 1)];
                        if (a !== EMPTY && a === b) if (!tryForce(i, 1 - a)) return null;
                    }

                    if (r - 2 >= 0) {
                        const a = values[(r - 2) * SIZE + c];
                        const b = values[(r - 1) * SIZE + c];
                        if (a !== EMPTY && a === b) if (!tryForce(i, 1 - a)) return null;
                    }
                    if (r + 2 < SIZE) {
                        const a = values[(r + 1) * SIZE + c];
                        const b = values[(r + 2) * SIZE + c];
                        if (a !== EMPTY && a === b) if (!tryForce(i, 1 - a)) return null;
                    }
                    if (r - 1 >= 0 && r + 1 < SIZE) {
                        const a = values[(r - 1) * SIZE + c];
                        const b = values[(r + 1) * SIZE + c];
                        if (a !== EMPTY && a === b) if (!tryForce(i, 1 - a)) return null;
                    }
                }
            }

            return changed;
        }

        function fillRowColByCounts(stack) {
            let changed = false;

            for (let r = 0; r < SIZE; r++) {
                if (rowCounts[r][SUN] === half || rowCounts[r][MOON] === half) {
                    const must = rowCounts[r][SUN] === half ? MOON : SUN;
                    for (let c = 0; c < SIZE; c++) {
                        const idx = r * SIZE + c;
                        if (values[idx] === EMPTY && !locked[idx]) {
                            if (!force(idx, must, stack)) return null;
                            changed = true;
                        }
                    }
                }
            }

            for (let c = 0; c < SIZE; c++) {
                if (colCounts[c][SUN] === half || colCounts[c][MOON] === half) {
                    const must = colCounts[c][SUN] === half ? MOON : SUN;
                    for (let r = 0; r < SIZE; r++) {
                        const idx = r * SIZE + c;
                        if (values[idx] === EMPTY && !locked[idx]) {
                            if (!force(idx, must, stack)) return null;
                            changed = true;
                        }
                    }
                }
            }

            return changed;
        }

        const stack = [];
        let progressed = true;

        while (progressed) {
            progressed = false;

            const a = fillEdges(stack);
            if (a === null) return null;
            progressed = progressed || a;

            const b = fillNoTriplesPatterns(stack);
            if (b === null) return null;
            progressed = progressed || b;

            const c = fillRowColByCounts(stack);
            if (c === null) return null;
            progressed = progressed || c;
        }

        return stack;
    }

    function pickNextCell(state) {
        const { values, locked, rowCounts, colCounts, half, adj } = state;

        let best = -1;
        let bestCount = 3;
        let bestCandidates = [];

        for (let idx = 0; idx < CELL_COUNT; idx++) {
            if (locked[idx]) continue;
            if (values[idx] !== EMPTY) continue;

            const r = Math.floor(idx / SIZE);
            const c = idx % SIZE;

            const candidates = [];
            for (let v = 0; v <= 1; v++) {
                if (rowCounts[r][v] >= half) continue;
                if (colCounts[c][v] >= half) continue;

                let ok = true;

                values[idx] = v;
                rowCounts[r][v]++;
                colCounts[c][v]++;

                if (!checkNoTriplesLine(values, r, c)) ok = false;
                if (ok && !respectsEdgesAt(values, idx, adj)) ok = false;
                for (const e of adj[idx]) {
                    if (ok && !respectsEdgesAt(values, e.other, adj)) ok = false;
                }

                rowCounts[r][v]--;
                colCounts[c][v]--;
                values[idx] = EMPTY;

                if (ok) candidates.push(v);
            }

            if (candidates.length === 0) return { idx: -1, candidates: [] };

            if (candidates.length < bestCount) {
                best = idx;
                bestCount = candidates.length;
                bestCandidates = candidates;
                if (bestCount === 1) break;
            }
        }

        if (best === -1) return null;
        return { idx: best, candidates: bestCandidates };
    }

    function isComplete(state) {
        for (let i = 0; i < CELL_COUNT; i++) if (state.values[i] === EMPTY) return false;
        return true;
    }

    function solveTangoGeneric(state) {
        const implied = preCompute(state);
        if (implied === null) return null;

        const backtrack = () => {
            if (isComplete(state)) return true;

            const choice = pickNextCell(state);
            if (!choice) return true;
            if (choice.idx === -1) return false;

            const idx = choice.idx;

            for (const v of choice.candidates) {
                if (!setCell(state, idx, v)) {
                    unsetCell(state, idx);
                    continue;
                }

                const implied2 = preCompute(state);
                if (implied2 !== null) {
                    if (backtrack()) return true;
                    for (let i = implied2.length - 1; i >= 0; i--) unsetCell(state, implied2[i]);
                }

                unsetCell(state, idx);
            }

            return false;
        };

        return backtrack() ? state.values.slice() : null;
    }

    function dispatchClick(cellEl) {
        cellEl.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        cellEl.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    }

    function fillSolution(state, solution) {
        const { cells, locked } = state;
        const cycle = [EMPTY, SUN, MOON];

        for (let i = 0; i < CELL_COUNT; i++) {
            if (locked[i]) continue;
            const target = solution[i];
            if (target === EMPTY) continue;

            const cell = cells[i];
            const cur = readCellValue(cell);

            if (cur === target) continue;

            const from = cycle.indexOf(cur);
            const to = cycle.indexOf(target);
            const clicks = (to - from + cycle.length) % cycle.length;

            for (let k = 0; k < clicks; k++) dispatchClick(cell);
        }
    }

    function main() {
        try {
            const state = parseBoard();
            log(`Parsed ${SIZE}x${SIZE} board`);
            log(`cells=${state.cells.length}, givens=${state.values.filter(v => v !== EMPTY).length}`);


            const solution = solveTangoGeneric(state);
            if (!solution) {
                log("No solution found");
                return;
            }

            fillSolution(state, solution);
            log("Solved & filled");
        } catch (e) {
            console.error("[Tango] Error:", e);
        }
    }

    main();
})();
