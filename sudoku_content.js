// sudoku_content.js
(() => {
  console.log("[LinkedIn PuzzleBot] Sudoku content script running");

  function log(msg) {
    console.log("[Sudoku] " + msg);
  }

  function parseBoard() {
    const boardSection = document.querySelector("section.sudoku-board[data-sudoku-grid]");
    if (!boardSection) {
      log("No Sudoku board found on this page.");
      return null;
    }

    const grid = boardSection.querySelector("div.sudoku-grid");
    if (!grid) {
      log("No .sudoku-grid found.");
      return null;
    }

    const style = grid.getAttribute("style") || "";
    const rowsMatch = style.match(/--rows:\s*(\d+)/);
    const colsMatch = style.match(/--cols:\s*(\d+)/);
    if (!rowsMatch || !colsMatch) {
      log("Could not parse --rows/--cols from style: " + style);
      return null;
    }

    const rows = parseInt(rowsMatch[1], 10);
    const cols = parseInt(colsMatch[1], 10);
    if (rows !== cols) {
      log(`Non-square grid: ${rows} x ${cols}`);
      return null;
    }
    const n = rows;

    const cells = Array.from(grid.querySelectorAll("div.sudoku-cell"));
    if (cells.length !== n * n) {
      log(`Expected ${n * n} cells, found ${cells.length}`);
      return null;
    }

    const board = Array.from({ length: n }, () => Array(n).fill(0));
    const horizDividers = new Set();
    const vertDividers = new Set();

    for (const cell of cells) {
      const idx = parseInt(cell.getAttribute("data-cell-idx"), 10);
      const r = Math.floor(idx / n);
      const c = idx % n;

      const content = cell.querySelector(".sudoku-cell-content");
      const text = (content?.textContent || "").trim();
      if (text) {
        board[r][c] = parseInt(text, 10);
      }

      const cls = cell.className;
      if (cls.includes("sudoku-cell-wall-bottom")) {
        horizDividers.add(r);
      }
      if (cls.includes("sudoku-cell-wall-right")) {
        vertDividers.add(c);
      }
    }

    log(`Parsed ${n}x${n} grid`);

    return { n, board, cells, horizDividers, vertDividers };
  }

  function computeSegmentIndices(n, dividersSet) {
    const divs = Array.from(dividersSet).sort((a, b) => a - b);
    const segIndices = [];
    let region = 0;
    let prevStart = 0;

    for (const d of divs) {
      const size = d + 1 - prevStart;
      for (let i = 0; i < size; i++) {
        segIndices.push(region);
      }
      region += 1;
      prevStart = d + 1;
    }

    if (prevStart < n) {
      for (let i = prevStart; i < n; i++) {
        segIndices.push(region);
      }
    }

    if (segIndices.length !== n) {
      throw new Error("Segment index length mismatch");
    }
    return segIndices;
  }

  function solveSudokuGeneric(board, rowRegions, colRegions) {
    const n = board.length;
    const nRowRegions = Math.max(...rowRegions) + 1;
    const nColRegions = Math.max(...colRegions) + 1;
    const nRegions = nRowRegions * nColRegions;

    const fullMask = (1 << (n + 1)) - 2; // bits 1..n set

    const rowMasks = new Array(n).fill(0);
    const colMasks = new Array(n).fill(0);
    const regionMasks = new Array(nRegions).fill(0);
    const empties = [];

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const v = board[r][c];
        const reg = rowRegions[r] * nColRegions + colRegions[c];
        if (v === 0) {
          empties.push({ r, c, reg });
        } else {
          const mask = 1 << v;
          rowMasks[r] |= mask;
          colMasks[c] |= mask;
          regionMasks[reg] |= mask;
        }
      }
    }

    log(`Initial empties: ${empties.length}`);

    function backtrack(i) {
      if (i === empties.length) return true;

      const { r, c, reg } = empties[i];
      const used = rowMasks[r] | colMasks[c] | regionMasks[reg];
      let avail = fullMask & ~used;

      while (avail) {
        const lsb = avail & -avail; // lowest set bit
        const digit = Math.clz32(lsb) ^ 31; // index of bit (1..n)

        const mask = 1 << digit;
        board[r][c] = digit;
        rowMasks[r] |= mask;
        colMasks[c] |= mask;
        regionMasks[reg] |= mask;

        if (backtrack(i + 1)) return true;

        board[r][c] = 0;
        rowMasks[r] ^= mask;
        colMasks[c] ^= mask;
        regionMasks[reg] ^= mask;

        avail &= avail - 1; // clear lowest set bit
      }
      return false;
    }

    const ok = backtrack(0);
    if (!ok) {
      log("No solution found by solver.");
    } else {
      log("Solver completed.");
    }
    return ok;
  }

  function fillSolution(n, board, cells) {
    log("Filling solution into page...");

    const body = document.querySelector("body");
    let filled = 0;

    for (const cell of cells) {
      const idx = parseInt(cell.getAttribute("data-cell-idx"), 10);
      const r = Math.floor(idx / n);
      const c = idx % n;

      const content = cell.querySelector(".sudoku-cell-content");
      const existing = (content?.textContent || "").trim();
      const classes = cell.className;

      if (classes.includes("sudoku-cell-prefilled")) {
        continue;
      }

      const val = board[r][c];
      if (existing === String(val)) continue;
      cell.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
      cell.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
      body.dispatchEvent(new KeyboardEvent("keydown", { key: String(val), bubbles: true }));
      body.dispatchEvent(new KeyboardEvent("keyup", { key: String(val), bubbles: true }));
      filled += 1;
    }

    log(`Filled ${filled} cells.`);
  }

  function main() {
    try {
      const parsed = parseBoard();
      if (!parsed) return;

      const { n, board, cells, horizDividers, vertDividers } = parsed;
      const rowRegions = computeSegmentIndices(n, horizDividers);
      const colRegions = computeSegmentIndices(n, vertDividers);

      const solvedBoard = board.map(row => row.slice());
      const ok = solveSudokuGeneric(solvedBoard, rowRegions, colRegions);
      if (!ok) {
        log("Solver failed; not filling values.");
        return;
      }
      setTimeout(() => fillSolution(n, solvedBoard, cells), 1000);
    } catch (e) {
      console.error("[Sudoku] Error:", e);
      alert("Sudoku solver error: " + e);
    }
  }

  main();
})();
