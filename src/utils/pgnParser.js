import { Chess } from 'chess.js';

export const parsePGNToPositions = (pgn) => {
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
    const history = chess.history({ verbose: true });
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