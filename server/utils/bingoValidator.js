/**
 * Server-side BINGO validation — 100% authoritative.
 * grid: 5x5 array (0 = free space)
 * drawnBalls: Set of numbers drawn so far
 * Returns: { valid: bool, pattern: string|null }
 */
function validateBingo(grid, drawnBalls) {
  // Build a 5x5 boolean "hit" matrix
  const hit = grid.map(row =>
    row.map(cell => cell === 0 || drawnBalls.has(cell))
  );

  // --- Horizontal ---
  for (let r = 0; r < 5; r++) {
    if (hit[r].every(Boolean)) {
      return { valid: true, pattern: 'HORIZONTAL' };
    }
  }

  // --- Vertical ---
  for (let c = 0; c < 5; c++) {
    if (hit.every(row => row[c])) {
      return { valid: true, pattern: 'VERTICAL' };
    }
  }

  // --- Diagonal (top-left → bottom-right) ---
  if ([0,1,2,3,4].every(i => hit[i][i])) {
    return { valid: true, pattern: 'DIAGONAL' };
  }

  // --- Diagonal (top-right → bottom-left) ---
  if ([0,1,2,3,4].every(i => hit[i][4 - i])) {
    return { valid: true, pattern: 'DIAGONAL' };
  }

  // --- Four Corners ---
  if (hit[0][0] && hit[0][4] && hit[4][0] && hit[4][4]) {
    return { valid: true, pattern: 'FOUR_CORNERS' };
  }

  return { valid: false, pattern: null };
}

module.exports = { validateBingo };
