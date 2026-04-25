/**
 * Generates a standard BINGO card (5x5) based on card slot number (1-100).
 * B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
 * Center cell (row 2, col 2) is FREE SPACE = 0
 */
function generateCard(cardNumber) {
  // Use cardNumber as seed for deterministic generation
  const ranges = [
    [1, 15],   // B
    [16, 30],  // I
    [31, 45],  // N
    [46, 60],  // G
    [61, 75],  // O
  ];

  // Seeded shuffle using cardNumber
  function seededRandom(seed) {
    let s = seed;
    return function () {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  const rand = seededRandom(cardNumber * 7919);

  function pickUnique(min, max, count, rng) {
    const pool = [];
    for (let i = min; i <= max; i++) pool.push(i);
    // Fisher-Yates with seeded rng
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
  }

  const card = [];
  for (let col = 0; col < 5; col++) {
    const [min, max] = ranges[col];
    const nums = pickUnique(min, max, 5, rand);
    card.push(nums);
  }

  // Transpose: card[col][row] → grid[row][col]
  const grid = [];
  for (let row = 0; row < 5; row++) {
    grid.push([]);
    for (let col = 0; col < 5; col++) {
      grid[row].push(card[col][row]);
    }
  }

  // Center free space
  grid[2][2] = 0;

  return grid;
}

/**
 * Returns all numbers on a card as a flat array (excluding free space)
 */
function getCardNumbers(grid) {
  return grid.flat().filter(n => n !== 0);
}

module.exports = { generateCard, getCardNumbers };
