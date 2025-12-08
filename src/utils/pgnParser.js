import { Chess } from 'chess.js';

export const parsePGNToPositions = (pgn) => {
  const chess = new Chess();
  try {
    // Clean PGN string
    const cleanedPgn = pgn
      .replace(/\[.*?\]/g, '') // Remove headers
      .replace(/\{.*?\}/g, '') // Remove comments
      .replace(/\s+/g, ' ')    // Normalize whitespace
      .trim();

    chess.loadPgn(cleanedPgn);
    const history = chess.history({ verbose: true });
    
    if (history.length === 0 && cleanedPgn.length > 10) {
        // Fallback: If no moves parsed but text exists, maybe it's just moves without numbers?
        // chess.js requires move numbers usually.
    }

    const positions = [];
    let tempChess = new Chess(); // Fresh instance for incremental loading

    // Initial position (move 0)
    positions.push({
      moveNumber: 0,
      fen: tempChess.fen(),
      san: null,
    });

    // Positions after each move
    history.forEach((move, index) => {
      tempChess.move(move);
      positions.push({
        moveNumber: index + 1,
        fen: tempChess.fen(),
        san: move.san,
      });
    });

    return {
      valid: true,
      positions,
      totalMoves: history.length,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
};