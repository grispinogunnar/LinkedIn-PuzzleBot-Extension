(() => {
    function log(msg) {
        console.log("[Zip] " + msg);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Selector configuration based on provided DOM snippet.
    const SELECTORS = {
        boardRoot: '[data-testid="interactive-grid"]',
        cell: '[data-cell-idx]',
        cellContent: '[data-cell-content="true"]',
        dataIndexAttr: "data-cell-idx",
        dimensionCssVar: "--_58f3d303" // holds board size in inline style
    };
    function solveZip(board, wallsRight, wallsDown) {
        const rows = board.length;
        const cols = board[0].length;
        const totalCells = rows * cols;

        const clues = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const v = board[r][c];
                if (v > 0) {
                    clues.push({ v, r, c, idx: r * cols + c });
                }
            }
        }
        clues.sort((a, b) => a.v - b.v);
        if (clues.length === 0) {
            log("No clues found; cannot determine start.");
            return null;
        }
        let startR = clues[0].r;
        let startC = clues[0].c;
        const maxClueVal = clues[clues.length - 1].v;

        const visited = Array.from({ length: rows}, () =>
            Array(cols).fill(false)
        );
        const path = new Array(totalCells);
        let solved = false;

        const dirs = [
            [1, 0],
            [0, 1],
            [-1, 0],
            [0, -1]
        ];

        function inBounds(r, c) {
            return r >= 0 && r < rows && c >= 0  && c < cols;
        }

        function reachableCount(startR, startC) {
            const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
            const stack = [[startR, startC]];
            let count = 0;
            while (stack.length) {
                const [cr, cc] = stack.pop();
                if (!inBounds(cr, cc)) continue;
                if (seen[cr][cc]) continue;
                if (visited[cr][cc] && !(cr === startR && cc === startC)) continue;
                seen[cr][cc] = true;
                count += 1;
                for (const [dr, dc] of dirs) {
                    const nr = cr + dr;
                    const nc = cc + dc;
                    if (!inBounds(nr, nc)) continue;
                    if (visited[nr][nc] && !(nr === startR && nc === startC)) continue;
                    if (isBlocked(cr, cc, nr, nc)) continue;
                    stack.push([nr, nc]);
                }
            }
            return count;
        }

        function canReachTarget(startR, startC, targetIdx) {
            if (targetIdx < 0) return true;
            const targetR = Math.floor(targetIdx / cols);
            const targetC = targetIdx % cols;
            const seen = Array.from({ length: rows }, () => Array(cols).fill(false));
            const stack = [[startR, startC]];
            while (stack.length) {
                const [cr, cc] = stack.pop();
                if (!inBounds(cr, cc)) continue;
                if (seen[cr][cc]) continue;
                if (visited[cr][cc] && !(cr === startR && cc === startC)) continue;
                seen[cr][cc] = true;
                if (cr === targetR && cc === targetC) return true;
                for (const [dr, dc] of dirs) {
                    const nr = cr + dr;
                    const nc = cc + dc;
                    if (!inBounds(nr, nc)) continue;
                    if (visited[nr][nc] && !(nr === startR && nc === startC)) continue;
                    if (isBlocked(cr, cc, nr, nc)) continue;
                    stack.push([nr, nc]);
                }
            }
            return false;
        }

        function isBlocked(r1, c1, r2, c2)  {
            if (!wallsRight || !wallsDown) return false;

            if (r1 === r2) {
                if (c2 === c1 + 1) {
                    return !!wallsRight[r1][c1];
                } else if (c2 === c1 - 1) {
                    return !!wallsRight[r1][c2];
                }
            } else if (c1 === c2) {
                if (r2 === r1 + 1) {
                    return !!wallsDown[r1][c1];
                } else if (r2 === r1 - 1) {
                    return !!wallsDown[r2][c1];
                }
            }
            return false;
        }

        function dfs(r, c, visitedCount, clueIdx) {
            if (solved) return;

            const idx = r * cols + c;
            path[visitedCount - 1] = idx;

            if (visitedCount === totalCells) {
                if (clueIdx === clues.length) {
                    solved = true;
                }
                return;
            }

            const remaining = totalCells - visitedCount;
            if (remaining > 0) {
                const reachable = reachableCount(r, c);
                if (reachable < remaining) {
                    return;
                }
            }

            const neighbors = [];
            for (const [dr, dc] of dirs) {
                const nr = r + dr;
                const nc = c + dc;
                if (!inBounds(nr, nc)) continue;
                if (visited[nr][nc]) continue;
                if (isBlocked(r, c, nr, nc)) continue;

                const cellVal = board[nr][nc];
                const expectedClueVal = clueIdx < clues.length ? clues[clueIdx].v : null;
                if (cellVal > 0) {
                    if (cellVal < expectedClueVal) continue;
                    if (cellVal > expectedClueVal) continue; // do not skip ahead
                }

                let score = 0;
                if (cellVal > 0) score -= 10; // prefer landing on the current required clue
                else score += 1;

                neighbors.push({ nr, nc, score });
            }

            neighbors.sort((a, b) => a.score - b.score);

            for (const { nr, nc } of neighbors) {
                visited[nr][nc] = true;
                const v = board[nr][nc];
                const nextClueIdx = (v > 0 && clueIdx < clues.length && v === clues[clueIdx].v) ? clueIdx + 1 : clueIdx;

                dfs(nr, nc, visitedCount + 1, nextClueIdx);
                if (solved) return;
                visited[nr][nc] = false;
            }
        }

        visited[startR][startC] = true;
        dfs(startR, startC, 1, 1);

        if (!solved) {
            console.error("Zip: no solution found.")
            return null;
        }

        return path.slice();
    }

    function parseBoard() {
        const boardSection = document.querySelector(SELECTORS.boardRoot);
        if (!boardSection) {
            log("No Zip board found on this page.");
            return null;
        }

        const cells = Array.from(boardSection.querySelectorAll(SELECTORS.cell));
        if (!cells.length) {
            log("No cells found in board.");
            return null;
        }

        // Determine dimensions: inline CSS var -> sqrt of count -> sqrt of max idx + 1.
        let rows = null;
        const inlineSize = boardSection.style.getPropertyValue(SELECTORS.dimensionCssVar);
        if (inlineSize) {
            const parsed = parseInt(inlineSize.trim(), 10);
            if (!Number.isNaN(parsed) && parsed > 0) {
                rows = parsed;
            }
        }
        if (rows == null) {
            const guessed = Math.round(Math.sqrt(cells.length));
            rows = guessed > 0 ? guessed : null;
        }
        // Fallback; infer from maxIdx
        if (rows == null || cells.length % rows !== 0) {
            const maxIdx = cells.reduce((m, el) => {
                const attr = el.getAttribute(SELECTORS.dataIndexAttr);
                const v = attr ? parseInt(attr, 10) : -1;
                return v > m ? v : m;
            }, -1);
            const sizeFromIdx = maxIdx >= 0 ? Math.round(Math.sqrt(maxIdx + 1)) : null;
            if (sizeFromIdx && (maxIdx + 1) === sizeFromIdx * sizeFromIdx) {
                rows = sizeFromIdx;
            }
        }
        if (rows == null || cells.length % rows !== 0) {
            log("Unable to infer board dimensions from DOM.");
            return null;
        }
        const cols = cells.length / rows;

        const board = Array.from({ length: rows }, () => Array(cols).fill(0));
        const wallsRight = Array.from({ length: rows }, () => Array(cols).fill(false));
        const wallsDown = Array.from({ length: rows }, () => Array(cols).fill(false));

        const borderRights = Array.from({ length: rows }, () => Array(cols).fill(0));
        const borderLefts = Array.from({ length: rows }, () => Array(cols).fill(0));
        const borderBottoms = Array.from({ length: rows }, () => Array(cols).fill(0));
        const borderTops = Array.from({ length: rows }, () => Array(cols).fill(0));
        const WALL_THRESHOLD = 2; // TODO: Adjust px as needed

        function extractBorders(el) {
            const targets = [
                { pseudo: null, styles: getComputedStyle(el) },
                { pseudo: "::after", styles: getComputedStyle(el, "::after") },
                { pseudo: "::before", styles: getComputedStyle(el, "::before") }
            ];
            const widths = { left: 0, right: 0, top: 0, bottom: 0 };
            for (const t of targets) {
                const s = t.styles;
                widths.left = Math.max(widths.left, parseFloat(s.borderLeftWidth) || 0);
                widths.right = Math.max(widths.right, parseFloat(s.borderRightWidth) || 0);
                widths.top = Math.max(widths.top, parseFloat(s.borderTopWidth) || 0);
                widths.bottom = Math.max(widths.bottom, parseFloat(s.borderBottomWidth) || 0);
            }
            return widths;
        }

        for (const cell of cells) {
            const idxAttr = cell.getAttribute(SELECTORS.dataIndexAttr);
            const idx = idxAttr != null ? parseInt(idxAttr, 10) : -1;
            const r = idx >= 0 ? Math.floor(idx / cols) : null;
            const c = idx >= 0 ? idx % cols : null;
            if (r == null || c == null) {
                log("Missing cell index attribute; update SELECTORS.dataIndexAttr handling.");
                return null;
            }

            const content = cell.querySelector(SELECTORS.cellContent);
            const text = (content?.textContent || "").trim();
            if (text) {
                const num = parseInt(text, 10);
                if (!Number.isNaN(num)) {
                    board[r][c] = num;
                }
            }

            // Detect walls from computed ::after borders.
            let borders = extractBorders(cell);
            const toScan = [];
            for (const ch of cell.children) {
                toScan.push(ch);
                for (const gr of ch.children) {
                    toScan.push(gr);
                }
            }
            for (const el of toScan) {
                const b = extractBorders(el);
                borders = {
                    left: Math.max(borders.left, b.left),
                    right: Math.max(borders.right, b.right),
                    top: Math.max(borders.top, b.top),
                    bottom: Math.max(borders.bottom, b.bottom)
                };
            }

            const bL = borders.left;
            const bR = borders.right;
            const bT = borders.top;
            const bB = borders.bottom;
            // if (bL === 0 && bR === 0 && bT === 0 && bB === 0) {
            //     log(`Cell ${idx} (r${r},c${c}) has zero borders after scanning descendants.`);
            // }
            borderRights[r][c] = bR;
            borderLefts[r][c] = bL;
            borderBottoms[r][c] = bB;
            borderTops[r][c] = bT;

            if (bR > WALL_THRESHOLD) wallsRight[r][c] = true;
            if (bL > WALL_THRESHOLD && c > 0) wallsRight[r][c - 1] = true;
            if (bB > WALL_THRESHOLD) wallsDown[r][c] = true;
            if (bT > WALL_THRESHOLD && r > 0) wallsDown[r - 1][c] = true;

            // log(`Cell ${idx} (r${r},c${c}) bL=${bL} bR=${bR} bT=${bT} bB=${bB} -> right=${wallsRight[r][c]} down=${wallsDown[r][c]}`);
        }

        // log(`Parsed ${rows}x${cols} board.`);
        // log("Board values:");
        // board.forEach(row => log(row.join(" ")));
        // log("Walls right (true=wall):");
        // wallsRight.forEach((row, ri) => log(`r${ri}: ` + row.map(v => (v ? "1" : "0")).join("")));
        // log("Walls down (true=wall):");
        // wallsDown.forEach((row, ri) => log(`r${ri}: ` + row.map(v => (v ? "1" : "0")).join("")));
        // log("Border widths right:");
        // borderRights.forEach((row, ri) => log(`r${ri}: ` + row.map(v => v.toFixed(1)).join(" ")));
        // log("Border widths left:");
        // borderLefts.forEach((row, ri) => log(`r${ri}: ` + row.map(v => v.toFixed(1)).join(" ")));
        // log("Border widths top:");
        // borderTops.forEach((row, ri) => log(`r${ri}: ` + row.map(v => v.toFixed(1)).join(" ")));
        // log("Border widths down:");
        // borderBottoms.forEach((row, ri) => log(`r${ri}: ` + row.map(v => v.toFixed(1)).join(" ")));
        return { rows, cols, board, cells, wallsRight, wallsDown };
    }

    async function fillSolution(path, cells, cols, delayMs = 35) {
        log("Filling Zip path via arrow keys...");
        if (!path.length) {
            log("Empty path; nothing to fill.");
            return;
        }

        const startCell = cells[path[0]];
        if (!startCell) {
            log("Start cell missing; aborting fill.");
            return;
        }

        // Click the starting cell to focus/select it.
        startCell.scrollIntoView({ block: "center", behavior: "smooth" });
        startCell.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
        startCell.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        startCell.dispatchEvent(new MouseEvent("click", { bubbles: true }));
        await sleep(delayMs);

        const targetForKeys = document.activeElement && document.activeElement !== document.body
            ? document.activeElement
            : document.body;

        function sendArrow(key) {
            const init = {
                key,
                code: key,
                keyCode: key === "ArrowUp" ? 38 : key === "ArrowDown" ? 40 : key === "ArrowLeft" ? 37 : 39,
                which: key === "ArrowUp" ? 38 : key === "ArrowDown" ? 40 : key === "ArrowLeft" ? 37 : 39,
                bubbles: true
            };
            targetForKeys.dispatchEvent(new KeyboardEvent("keydown", init));
            targetForKeys.dispatchEvent(new KeyboardEvent("keyup", init));
        }

        let moved = 0;
        for (let i = 1; i < path.length; i++) {
            const prev = path[i - 1];
            const cur = path[i];
            const pr = Math.floor(prev / cols);
            const pc = prev % cols;
            const cr = Math.floor(cur / cols);
            const cc = cur % cols;
            const dr = cr - pr;
            const dc = cc - pc;

            let key = null;
            if (dr === 1 && dc === 0) key = "ArrowDown";
            else if (dr === -1 && dc === 0) key = "ArrowUp";
            else if (dr === 0 && dc === 1) key = "ArrowRight";
            else if (dr === 0 && dc === -1) key = "ArrowLeft";

            if (!key) {
                // log(`Non-adjacent move encountered between ${prev} and ${cur}; stopping fill.`);
                break;
            }

            sendArrow(key);
            moved += 1;
            await sleep(delayMs);
        }

        log(`Moved ${moved} steps.`);
    }

    async function main() {
        try {
            const parsed = parseBoard();
            if (!parsed) return;

            const { rows, cols, board, cells, wallsRight, wallsDown } = parsed;
            const path = solveZip(board, wallsRight, wallsDown);
            if (!path) {
                log("Solver failed; not filling.");
                return;
            }

            // Small delay to ensure the game is ready to accept input.
            await sleep(500);
            await fillSolution(path, cells, cols);
        } catch (e) {
            console.error("[Zip] Error:", e);
            alert("Zip solver error: " + e);
        }
    }

    main();
})();
